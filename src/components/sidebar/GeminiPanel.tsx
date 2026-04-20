import { useState } from "react";
import { useStore } from "../../store/useStore";
import { simulate } from "../../engine/simulate";
import { nfaToDfa } from "../../engine/nfaToDfa";
import { minimize } from "../../engine/minimize";
import { canonicalize } from "../../engine/equivalence";
import { djb2Hash } from "../../lib/utils";
import { fetchAiSummary, writeAiSummary } from "../../lib/firestoreHelpers";
import { SparkleIcon } from "../ui/Icons";
import type { Automaton } from "../../types";

type ProbeResult = { string: string; accepted: boolean };

type Phase =
  | "idle"
  | "minimizing"
  | "probe1"
  | "running1"
  | "probe2"
  | "running2"
  | "predicting"
  | "summarising"
  | "done";

const PHASE_LABELS: Record<Phase, string> = {
  idle: "",
  minimizing: "Minimising...",
  probe1: "Thinking...",
  running1: "Simulating...",
  probe2: "Rethinking",
  running2: "Resimulating...",
  predicting: "Analysing...",
  summarising: "Summarising...",
  done: "",
};

function prepareAutomaton(automaton: Automaton): { result: Automaton; reduced: boolean } {
  const before = automaton.states.length;
  let working = automaton.type === "NFA" ? nfaToDfa(automaton) : automaton;
  working = minimize(working);
  return {
    result: working,
    reduced: automaton.type === "NFA" || working.states.length < before,
  };
}

async function callGemma(
  token: string,
  model: string,
  userText: string,
  maxTokens: number,
  prefill?: string,
  stopSequences?: string[],
): Promise<string> {
  const contents: object[] = [{ role: "user", parts: [{ text: userText }] }];
  if (prefill) {
    contents.push({ role: "model", parts: [{ text: prefill }] });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.0,
          ...(stopSequences ? { stopSequences } : {}),
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }

  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
}

function parseStrings(raw: string): string[] {
  const matches = [...raw.matchAll(/\[(.*?)\]/gs)];
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(matches[i][0]);
      if (Array.isArray(parsed)) {
        const strings = parsed.map(String).map((s) => s.trim());
        if (strings.length > 0) return strings.slice(0, 5);
      }
    } catch { }
  }

  const quoteRegex = /(["'])(.*?)\1/g;
  const quotes = [...raw.matchAll(quoteRegex)];
  if (quotes.length > 0) {
    const strings = quotes.map((m) => m[2].trim()).filter((s) => s.length <= 20);
    if (strings.length > 0) return strings.slice(-5);
  }

  const tokens = raw
    .split(/[\n, ]+/)
    .map((s) => s.replace(/^[\s\-\d.)"'`*\[\]]+|[\s"'`*\[\]]+$/g, "").trim())
    .filter((s) => s.length > 0 && s.length <= 15 && !/[:{}]/.test(s));
  return tokens.slice(-5);
}

function runProbe(automaton: Automaton, strings: string[]): ProbeResult[] {
  return strings.map((str) => {
    try {
      const result = simulate(automaton, str);
      return { string: str === "" ? "ε" : str, accepted: result.accepted };
    } catch {
      return { string: str === "" ? "ε" : str, accepted: false };
    }
  });
}

function automatonContext(automaton: Automaton): string {
  const states = automaton.states
    .map((s) => {
      const tags: string[] = [];
      if (s.isStart) tags.push("start");
      if (s.isAccept) tags.push("accept");
      return `${s.label}${tags.length ? ` (${tags.join(", ")})` : ""}`;
    })
    .join(", ");

  const transitions = automaton.transitions
    .map((t) => {
      const from = automaton.states.find((s) => s.id === t.from)?.label ?? t.from;
      const to = automaton.states.find((s) => s.id === t.to)?.label ?? t.to;
      return `  ${from} --[${t.symbols.join(",")}]--> ${to}`;
    })
    .join("\n");

  return (
    `Type: ${automaton.type}\n` +
    `Alphabet: ${automaton.alphabet.join(", ") || "(none)"}\n` +
    `States: ${states || "(none)"}\n` +
    `Transitions:\n${transitions || "  (none)"}`
  );
}

function probeTable(results: ProbeResult[]): string {
  return results.map((r) => `  "${r.string}" → ${r.accepted ? "ACCEPT" : "REJECT"}`).join("\n");
}

function probePrompt(ctx: string, seen: ProbeResult[]): string {
  const seenNote = seen.length > 0 ? `\nAlready tested:\n${probeTable(seen)}\n` : "";
  return (
    `Identify the pattern in this automaton:\n${ctx}${seenNote}\n\n` +
    `Provide 5 unique test strings to help determine the logic. ` +
    `Include very short strings and strings that test specific letter sequences. ` +
    `Output ONLY a JSON array of strings. Use "epsilon" for empty.`
  );
}

function predictPrompt(ctx: string, results: ProbeResult[]): string {
  return (
    `Analyze this automaton and its simulation results to find the pattern:\n` +
    `Automaton:\n${ctx}\n\n` +
    `Simulation Results:\n${probeTable(results)}\n\n` +
    `Task: What is the simplest rule that describes why strings are ACCEPTED vs REJECTED? ` +
    `Look for specific substrings, prefixes, suffixes, or counts of characters. ` +
    `You may think out loud to get to a good explanation. ` +
    `Ensure that the explanation fits BOTH the automaton logic and the simulation results. ` +
    `Keep the explanation under 200 words. Do not use jargon unless absolutely necessary.`
  );
}

function summarisePrompt(prediction: string, alphabet: string[]): string {
  return (
    `Summarize the following rule into a short sentence of 10-15 words. ` +
    `Do not explicitly mention state names like q0, q1, etc or "the accepting state" and "the rejecting state". ` +
    `The language uses the alphabet: {${alphabet.join(", ") || "none"}}.\n` +
    `Start with "Accepts strings that...". Be literal and direct.\n\n` +
    `Rule: ${prediction}`
  );
}

export default function GeminiPanel() {
  const { activeProject, user } = useStore();
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wasReduced, setWasReduced] = useState(false);

  if (!activeProject) return null;

  const isEmpty = activeProject.states.length === 0;
  const token = import.meta.env.VITE_GEMINI_TOKEN as string | undefined;
  const isLoading = phase !== "idle" && phase !== "done";

  const reset = () => {
    setPhase("idle");
    setResults([]);
    setSummary(null);
    setError(null);
    setWasReduced(false);
  };

  const handleSummarize = async () => {
    if (!token) {
      setError(
        "Gemini API token is missing. Please set VITE_GEMINI_TOKEN in your .env file to enable AI features.",
      );
      return;
    }
    if (isEmpty) return;

    reset();

    try {
      setPhase("minimizing");
      const { result: working, reduced } = prepareAutomaton(activeProject);
      setWasReduced(reduced);
      const ctx = automatonContext(working);

      const canonical = canonicalize(working);
      const cacheKey = djb2Hash(canonical);

      if (user) {
        const cached = await fetchAiSummary(cacheKey);
        if (cached) {
          setSummary(cached);
          setPhase("done");
          return;
        }
      }
      const prefill = '["epsilon", ';

      setPhase("probe1");
      const raw1 = await callGemma(token, "gemma-3-4b-it", probePrompt(ctx, []), 40, prefill, [
        "]",
      ]);

      setPhase("running1");
      const strings1 = parseStrings((prefill + raw1 + "]").replace(/epsilon/gi, ""));
      const probeRes1 = runProbe(working, strings1);
      setResults(probeRes1);

      setPhase("probe2");
      const raw2 = await callGemma(
        token,
        "gemma-3-4b-it",
        probePrompt(ctx, probeRes1),
        40,
        prefill,
        ["]"],
      );

      setPhase("running2");
      const strings2 = parseStrings((prefill + raw2 + "]").replace(/epsilon/gi, ""));
      const probeRes2 = runProbe(working, strings2);
      const allResults = [...probeRes1, ...probeRes2];
      setResults(allResults);

      setPhase("predicting");
      const prediction = await callGemma(
        token,
        "gemma-3-12b-it",
        predictPrompt(ctx, allResults),
        300,
      );

      setPhase("summarising");
      const finalSummary = await callGemma(
        token,
        "gemma-3-12b-it",
        summarisePrompt(prediction, working.alphabet),
        40,
      );

      setSummary(finalSummary);
      if (user) {
        writeAiSummary(cacheKey, working, canonical, user.uid, finalSummary);
      }
      setPhase("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setPhase("idle");
    }
  };

  return (
    <div className="sidebar-section gemini-panel">
      <p
        className="sidebar-section-title"
        style={{ display: "flex", alignItems: "center", gap: 6 }}
      >
        <SparkleIcon sx={{ fontSize: 13, color: "var(--accent)" }} />
        AI Summary
      </p>

      {phase !== "done" ? (
        <button
          id="gemini-summarize-btn"
          className="btn btn-ghost gemini-btn"
          disabled={isEmpty || isLoading}
          onClick={handleSummarize}
          title={isEmpty ? "Add states first" : "Minimize, probe & summarize with Gemma 3"}
        >
          {isLoading ? (
            <>
              <span className="spinner" />
              <span style={{ marginLeft: 8 }}>{PHASE_LABELS[phase] || "Processing..."}</span>
            </>
          ) : (
            <>
              <SparkleIcon sx={{ fontSize: 14 }} />
              <span style={{ marginLeft: 8 }}>Summarize automaton</span>
            </>
          )}
        </button>
      ) : (
        <button className="btn btn-ghost gemini-btn" onClick={reset}>
          <SparkleIcon sx={{ fontSize: 14 }} />
          <span style={{ marginLeft: 8 }}>Run again</span>
        </button>
      )}

      {wasReduced && phase !== "minimizing" && (
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
          ✦ Automaton was minimized before analysis
        </p>
      )}

      {summary && (
        <div className="gemini-result" role="region" aria-label="AI summary">
          <p className="gemini-result-text">{summary}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
            <span className="gemini-badge">Gemma 3 · 4B/12B</span>
            <span style={{ fontSize: 9, color: "var(--text-muted)", lineHeight: 1.3 }}>
              AI can make mistakes. The description may not be representative of the actual
              language. Always double-check answers.
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="error-banner" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}
