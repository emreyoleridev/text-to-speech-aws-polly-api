"use client";

import { useState } from "react";

const DEFAULT_SCRIPT = `*NARRATOR*: Welcome to the text to speech tool.
<pause 1000>
*MAN*: You can use this tool to create realistic dialogues.
*WOMAN*: It supports automatic pausing and multiple voices.
*NARRATOR*: Just type your script here and click Generate!
`;

export default function Home() {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <header className="space-y-2 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Text to Speech Tool
          </h1>
          <p className="text-slate-400 text-lg">
            Generate professional audio dialogues from your text script.
          </p>
        </header>

        {/* Main Card */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-slate-200">Script</h2>
            <div className="text-xs text-slate-500 max-w-md text-right">
              Supported: *NARRATOR*, *MAN*, *MAN2*, *WOMAN*, *WOMAN2*... <br />
              Use &lt;pause ms="5000"&gt; for silence.
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
            <textarea
              className="relative w-full h-96 bg-slate-950 border border-slate-700 rounded-lg p-4 font-mono text-sm leading-relaxed text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y placeholder-slate-600 shadow-inner"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Paste your script here..."
            />
          </div>

          {/* Action Bar */}
          <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-slate-500 italic">
              {loading ? "Generating audio, please wait..." : "Ready to generate."}
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className={`
                px-8 py-3 rounded-full font-bold text-white shadow-lg transform transition-all duration-200
                ${loading
                  ? "bg-slate-700 cursor-not-allowed opacity-70"
                  : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 hover:scale-105 active:scale-95 hover:shadow-indigo-500/25"}
              `}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                "Generate MP3"
              )}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 text-red-400 animate-fadeIn">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
