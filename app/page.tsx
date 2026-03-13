"use client";

import { useState } from "react";

const DEFAULT_SCRIPT = `*NARRATOR*: Welcome to the text to speech tool.
<pause 1000>
*MAN*: You can use this tool to create realistic dialogues.
*WOMAN*: It supports automatic pausing and multiple voices.
*NARRATOR*: Just type your script here and click Generate!
`;

const VOICES = [
  { tag: "NARRATOR", voice: "Joanna", accent: "US English Female" },
  { tag: "MAN / MAN1", voice: "Joey", accent: "US English Male" },
  { tag: "MAN2", voice: "Matthew", accent: "US English Male" },
  { tag: "MAN3", voice: "Justin", accent: "US English Male" },
  { tag: "MAN4", voice: "Brian", accent: "British English Male" },
  { tag: "MAN5", voice: "Russell", accent: "Australian English Male" },
  { tag: "MAN6", voice: "Geraint", accent: "Welsh English Male" },
  { tag: "WOMAN / WOMAN1", voice: "Salli", accent: "US English Female" },
  { tag: "WOMAN2", voice: "Kendra", accent: "US English Female" },
  { tag: "WOMAN3", voice: "Ivy", accent: "US English Female" },
  { tag: "WOMAN4", voice: "Kimberly", accent: "US English Female" },
  { tag: "WOMAN5", voice: "Amy", accent: "British English Female" },
  { tag: "WOMAN6", voice: "Emma", accent: "British English Female" },
  { tag: "WOMAN7", voice: "Nicole", accent: "Australian English Female" },
];

export default function Home() {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);

  const handlePlaySample = async (tag: string, voiceName: string) => {
    if (playingVoice) return; // Prevent multiple simultaneous plays
    setPlayingVoice(tag);
    try {
      const mainTag = tag.split(" / ")[0];
      const sampleScript = `*${mainTag}*: Hello, my name is ${voiceName}.`;

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: sampleScript }),
      });

      if (!res.ok) throw new Error("Sample generation failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const audio = new Audio(url);

      audio.onended = () => {
        setPlayingVoice(null);
        window.URL.revokeObjectURL(url);
      };

      audio.onerror = () => {
        setPlayingVoice(null);
        window.URL.revokeObjectURL(url);
      };

      audio.play().catch(() => {
        setPlayingVoice(null);
        window.URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error("Failed to play sample", error);
      setPlayingVoice(null);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
      });

      if (!res.ok) {
        let errorMessage = "Generation failed";
        try {
          const data = await res.json();
          errorMessage = data.error || data.details || errorMessage;
        } catch {
          // ignore JSON parse error
        }
        throw new Error(errorMessage);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "generated_audio.mp3";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <header className="space-y-2 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-sm">
            Text to Speech Tool
          </h1>
          <p className="text-slate-400 text-lg">
            Generate professional audio dialogues from your text script.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl relative">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-slate-200">Script</h2>
                <div className="text-xs text-slate-500 bg-slate-950/50 px-3 py-1 rounded-full border border-slate-800">
                  Tip: Use &lt;pause ms=&quot;1000&quot;&gt; for silence.
                </div>
              </div>

              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                <textarea
                  className="relative w-full h-[500px] bg-slate-950 border border-slate-700 rounded-lg p-5 font-mono text-sm leading-relaxed text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y placeholder-slate-600 shadow-inner custom-scrollbar"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Paste your script here..."
                />
              </div>

              {/* Action Bar */}
              <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-sm text-slate-500 italic pb-2 md:pb-0">
                  {loading ? (
                    <span className="animate-pulse text-indigo-400">Generating audio, please wait...</span>
                  ) : "Ready to generate your masterpiece."}
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className={`
                    px-8 py-3 w-full md:w-auto rounded-full font-bold text-white shadow-lg transform transition-all duration-300 flex justify-center items-center gap-2
                    ${loading
                      ? "bg-slate-800 cursor-not-allowed text-slate-400 border border-slate-700"
                      : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"}
                  `}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                      </svg>
                      Generate MP3
                    </>
                  )}
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-6 p-4 bg-red-950/30 border border-red-500/30 rounded-lg flex items-start gap-3 text-red-400 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar / Voices List */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl sticky top-6">
              <h2 className="text-xl font-semibold text-slate-200 mb-6 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-purple-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                </svg>
                Available Voices
              </h2>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {VOICES.map((v, i) => (
                  <div
                    key={i}
                    onClick={() => handlePlaySample(v.tag, v.voice)}
                    className={`group relative p-3 rounded-xl border transition-all duration-200 cursor-pointer ${playingVoice === v.tag
                      ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                      : "border-slate-800/60 bg-slate-950/40 hover:bg-slate-800/50 hover:border-slate-700/80"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                        *{v.tag.split(" / ")[0]}*
                      </span>
                      {playingVoice === v.tag ? (
                        <svg className="w-5 h-5 text-indigo-400 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" opacity="0.2" />
                          <path d="M9 8h2v8H9zm4 0h2v8h-2z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-200">{v.voice}</span>
                      <span className="text-xs text-slate-500">· {v.accent}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div >
  );
}
