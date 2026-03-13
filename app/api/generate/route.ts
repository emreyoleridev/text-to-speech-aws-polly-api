import { NextRequest, NextResponse } from "next/server";
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
const NARRATOR_VOICE = "e984fb89"; // Mauren (Announcer)

const MAN_VOICES = [
  "3e907bcc", // Robert (US)
  "3a02dc40", // Mike (US)
  "1864fd63", // Pete (US)
  "0c755526", // Ed Smart (UK)
  "6a3e095e", // Jason (US)
  "bec88a80"  // Brian (US)
];

const WOMAN_VOICES = [
  "ef49f972", // Olivia (US)
  "e28236ee", // Samantha (US)
  "96b91cf9", // Charlotte (US)
  "ecbe5d97", // Amelia (US)
  "a72d9fca", // Aurora (US)
  "33e64cd2"  // Paula J (UK)
];

// --- Types ---
type Segment =
  | { type: "line"; speaker: string; text: string }
  | { type: "pause"; ms: number };

// --- Helper Functions ---

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

    if (line.toLowerCase().startsWith("<pause")) {
      const numberMatch = line.match(/\d+/);
      let ms = 1000;
      if (numberMatch) {
        ms = parseInt(numberMatch[0], 10);
      }
      segments.push({ type: "pause", ms: ms });
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

  return segments;
}

/**
 * Maps a speaker token to a Resemble Voice UUID.
 */
function getVoiceId(speaker: string): string {
  if (speaker === "NARRATOR") return NARRATOR_VOICE;

  if (speaker.startsWith("MAN")) {
    const suffix = speaker.replace("MAN", "");
    let index = 0;
    if (suffix && /^\d+$/.test(suffix)) {
      index = parseInt(suffix, 10) - 1;
    }
    if (index < 0) index = 0;
    return MAN_VOICES[index % MAN_VOICES.length];
  }

  if (speaker.startsWith("WOMAN")) {
    const suffix = speaker.replace("WOMAN", "");
    let index = 0;
    if (suffix && /^\d+$/.test(suffix)) {
      index = parseInt(suffix, 10) - 1;
    }
    if (index < 0) index = 0;
    return WOMAN_VOICES[index % WOMAN_VOICES.length];
  }

  return NARRATOR_VOICE;
}

/**
 * Synthesizes text using Resemble AI v2 HTTP Streaming endpoint.
 */
async function synthesizeSpeech(text: string, voiceUuid: string, outputPath: string) {
  const apiKey = process.env.RESEMBLE_API_KEY;

  if (!apiKey) {
    throw new Error("Resemble AI credentials (RESEMBLE_API_KEY) are missing from environment variables.");
  }

  const url = `https://f.cluster.resemble.ai/stream`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-access-token": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      data: text,
      voice_uuid: voiceUuid
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Resemble API Error:", errorText);
    throw new Error(`Resemble returned ${response.status}: ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
}

/**
 * Generates a silence WAV file using ffmpeg.
 */
async function generateSilence(ms: number, outputPath: string) {
  const seconds = ms / 1000;
  if (!EFFECTIVE_FFMPEG_PATH) throw new Error("ffmpeg binary not found");

  return new Promise<void>((resolve, reject) => {
    // Generate silence directly as WAV with 44100Hz 
    const p = spawn(EFFECTIVE_FFMPEG_PATH, [
      "-y",
      "-f", "lavfi",
      "-i", "anullsrc=r=44100:cl=mono",
      "-t", seconds.toString(),
      "-f", "wav",
      "-acodec", "pcm_s16le",
      "-ar", "44100",
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
 * Concatenates media files listed in concat.txt to an mp3 file.
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
      "-f", "mp3",
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
  const tempDir = path.join(os.tmpdir(), `resemble-tts-${tempId}`);

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

    if (segments.length > 500) {
      return NextResponse.json({ error: "Script too long (max 500 segments)" }, { status: 400 });
    }

    await fs.mkdir(tempDir, { recursive: true });

    // Generate a shared 500ms pause file for auto-spacing
    const autoPausePath = path.join(tempDir, "auto_pause_500ms.wav");
    await generateSilence(500, autoPausePath);

    const processedFiles: string[] = [];

    // Process segments concurrently
    const segmentPromises = segments.map(async (segment, i) => {
      const filePrefix = String(i + 1).padStart(3, "0");
      const filesToPush: string[] = [];

      if (segment.type === "line") {
        const voiceId = getVoiceId(segment.speaker);
        const fileName = `${filePrefix}.wav`;
        const filePath = path.join(tempDir, fileName);

        await synthesizeSpeech(segment.text, voiceId, filePath);
        filesToPush.push(filePath);

        // Auto-inject 500ms pause after every line for natural spacing
        filesToPush.push(autoPausePath);
      } else {
        const fileName = `${filePrefix}_pause.wav`;
        const filePath = path.join(tempDir, fileName);
        await generateSilence(segment.ms, filePath);
        filesToPush.push(filePath);
      }

      return filesToPush;
    });

    const results = await Promise.all(segmentPromises);
    results.forEach(files => processedFiles.push(...files));

    // Create concat.txt
    const concatTxtPath = path.join(tempDir, "concat.txt");
    const concatContent = processedFiles.map(f => `file '${f}'`).join("\n");
    await fs.writeFile(concatTxtPath, concatContent);

    // Concatenate to MP3
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
