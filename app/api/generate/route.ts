import { NextRequest, NextResponse } from "next/server";
import { PollyClient, SynthesizeSpeechCommand, OutputFormat, TextType, VoiceId } from "@aws-sdk/client-polly";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";

export const runtime = "nodejs";

// FORCE path resolution for local dev if ffmpeg-static fails or returns weird paths
const getFfmpegPath = () => {
  if (ffmpegPath && !ffmpegPath.startsWith("/ROOT")) return ffmpegPath;
  // Fallback for local node_modules
  return path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg");
};

const EFFECTIVE_FFMPEG_PATH = getFfmpegPath();
console.log("Using FFmpeg path:", EFFECTIVE_FFMPEG_PATH);

// --- Voice Configuration ---
const NARRATOR_VOICE: VoiceId = "Joanna"; // Standard US English Female

// Expanded Voice List (Standard Engine)
// Includes US, UK, Australian, Welsh, Indian English accents for variety
const MAN_VOICES: VoiceId[] = [
  "Joey", "Matthew", "Justin",  // US
  "Brian",                      // British
  "Russell",                    // Australian
  "Geraint"                     // Welsh
];

const WOMAN_VOICES: VoiceId[] = [
  "Salli", "Kendra", "Ivy", "Kimberly", // US
  "Amy", "Emma",                        // British
  "Nicole",                             // Australian
];

// --- Types ---
type Segment =
  | { type: "line"; speaker: string; text: string }
  | { type: "pause"; ms: number };

// --- Helper Functions ---

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
    return c;
  });
}

/**
 * Parses the raw script into segments.
 */
function parseScript(script: string): Segment[] {
  const lines = script.replace(/\r\n/g, "\n").split("\n");
  const segments: Segment[] = [];

  const speakerRegex = /^\*([A-Z0-9_]+)\*\s*:\s*(.+)$/;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // ROBUST PAUSE DETECTION: Check if line starts with "<pause"
    if (line.toLowerCase().startsWith("<pause")) {
      const numberMatch = line.match(/\d+/);
      let ms = 1000;
      if (numberMatch) {
        ms = parseInt(numberMatch[0], 10);
      }
      segments.push({ type: "pause", ms: ms });
      console.log(`[Parser] Found pause: ${ms}ms`);
      continue;
    }

    const speakerMatch = line.match(speakerRegex);
    if (speakerMatch) {
      segments.push({
        type: "line",
        speaker: speakerMatch[1].toUpperCase(),
        text: speakerMatch[2].trim(),
      });
      continue;
    }

    // Default to Narrator
    segments.push({ type: "line", speaker: "NARRATOR", text: line });
  }

  console.log("Parsed Segments:", JSON.stringify(segments, null, 2));
  return segments;
}



/**
 * Maps a speaker token to a Polly Voice ID.
 */
function getVoiceId(speaker: string): VoiceId {
  if (speaker === "NARRATOR") return NARRATOR_VOICE;

  if (speaker.startsWith("MAN")) {
    const suffix = speaker.replace("MAN", "");
    let index = 0;
    if (suffix && /^\d+$/.test(suffix)) {
      index = parseInt(suffix, 10) - 1;
    }
    // Wrap around
    if (index < 0) index = 0;
    return MAN_VOICES[index % MAN_VOICES.length];
  }

  if (speaker.startsWith("WOMAN")) {
    const suffix = speaker.replace("WOMAN", "");
    let index = 0;
    if (suffix && /^\d+$/.test(suffix)) {
      index = parseInt(suffix, 10) - 1;
    }
    // Wrap around
    if (index < 0) index = 0;
    return WOMAN_VOICES[index % WOMAN_VOICES.length];
  }

  return NARRATOR_VOICE;
}

const polly = new PollyClient({ region: process.env.AWS_REGION || "us-east-1" });

/**
 * Synthesizes text using Amazon Polly.
 * Supports SSML for Narrator speed control.
 */
async function synthesizeSpeech(text: string, voiceId: VoiceId, outputPath: string, isNarrator: boolean = false) {
  let textToSynthesize = text;
  let textType: TextType = TextType.TEXT;

  if (isNarrator) {
    // Slow down narrator using SSML
    textType = TextType.SSML;
    // Medium speed is default, "slow" is 80%. Let's try slow for clarity per feedback.
    textToSynthesize = `<speak><prosody rate="slow">${escapeXml(text)}</prosody></speak>`;
  }

  const command = new SynthesizeSpeechCommand({
    Engine: "standard",
    OutputFormat: OutputFormat.MP3,
    Text: textToSynthesize,
    TextType: textType,
    VoiceId: voiceId,
  });

  const response = await polly.send(command);
  if (response.AudioStream) {
    const buffer = await response.AudioStream.transformToByteArray();
    await fs.writeFile(outputPath, buffer);
  } else {
    throw new Error("Polly did not return an audio stream.");
  }
}

/**
 * Generates a silence MP3 file using ffmpeg.
 */
async function generateSilence(ms: number, outputPath: string) {
  const seconds = ms / 1000;
  if (!EFFECTIVE_FFMPEG_PATH) throw new Error("ffmpeg binary not found");

  return new Promise<void>((resolve, reject) => {
    // Generate silence directly as MP3 with 22050Hz to match Polly
    const p = spawn(EFFECTIVE_FFMPEG_PATH, [
      "-y",
      "-f", "lavfi",
      "-i", "anullsrc=r=22050:cl=mono",
      "-t", seconds.toString(),
      "-f", "mp3",
      "-acodec", "libmp3lame",
      "-ar", "22050",
      "-ac", "1",
      outputPath
    ]);

    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg silence generation failed with code ${code}`));
    });

    p.on("error", reject);
  });
}

/**
 * Concatenates media files listed in concat.txt.
 */
async function concatenateFiles(concatListPath: string, outputPath: string) {
  if (!EFFECTIVE_FFMPEG_PATH) throw new Error("ffmpeg binary not found");

  return new Promise<void>((resolve, reject) => {
    const p = spawn(EFFECTIVE_FFMPEG_PATH, [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", concatListPath,
      "-ar", "44100",
      "-ac", "1",
      "-b:a", "128k",
      outputPath
    ]);

    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg concatenation failed with code ${code}`));
    });

    p.on("error", reject);
  });
}


export async function POST(req: NextRequest) {
  const tempId = uuidv4();
  const tempDir = path.join(os.tmpdir(), `ielts-tts-${tempId}`);

  try {
    const body = await req.json();
    const { script } = body;

    if (!script || typeof script !== "string") {
      return NextResponse.json({ error: "Invalid script" }, { status: 400 });
    }

    const segments = parseScript(script);
    if (segments.length === 0) {
      return NextResponse.json({ error: "Empty script" }, { status: 400 });
    }

    // Limit check (simple)
    if (segments.length > 500) {
      return NextResponse.json({ error: "Script too long (max 500 segments)" }, { status: 400 });
    }

    await fs.mkdir(tempDir, { recursive: true });

    // Generate a shared 500ms pause file for auto-spacing
    const autoPausePath = path.join(tempDir, "auto_pause_500ms.mp3");
    await generateSilence(500, autoPausePath);

    const processedFiles: string[] = [];

    // Process segments
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const filePrefix = String(i + 1).padStart(3, "0");

      if (segment.type === "line") {
        const voiceId = getVoiceId(segment.speaker);
        const fileName = `${filePrefix}.mp3`;
        const filePath = path.join(tempDir, fileName);
        // Apply SSML only for Narrator if requested
        const isNarrator = (segment.speaker === "NARRATOR");
        await synthesizeSpeech(segment.text, voiceId, filePath, isNarrator);
        processedFiles.push(filePath);

        // Auto-inject 500ms pause after every line for natural spacing
        processedFiles.push(autoPausePath);

      } else {
        const fileName = `${filePrefix}_pause.mp3`;
        const filePath = path.join(tempDir, fileName);
        await generateSilence(segment.ms, filePath);
        processedFiles.push(filePath);
      }
    }

    // Create concat.txt
    const concatTxtPath = path.join(tempDir, "concat.txt");
    const concatContent = processedFiles.map(f => `file '${f}'`).join("\n");
    await fs.writeFile(concatTxtPath, concatContent);

    // Concatenate
    const finalMp3Path = path.join(tempDir, "final.mp3");
    await concatenateFiles(concatTxtPath, finalMp3Path);

    // Read final file
    const fileBuffer = await fs.readFile(finalMp3Path);

    // Return response
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'attachment; filename="generated_audio.mp3"',
      },
    });

  } catch (error: any) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  } finally {
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.error("Failed to cleanup temp dir:", e);
    }
  }
}
