import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { simulate } from '../../engine/simulate';
import { nfaToDfa } from '../../engine/nfaToDfa';
import { minimize } from '../../engine/minimize';
import { canonicalize } from '../../engine/equivalence';
import { djb2Hash } from '../../lib/utils';
import { fetchAiSummary, writeAiSummary } from '../../lib/firestoreHelpers';
import { SparkleIcon } from '../ui/Icons';
import type { Automaton } from '../../types';

type ProbeResult = { string: string; accepted: boolean };

type Phase =
    | 'idle'
    | 'minimizing'
    | 'probe'
    | 'running'
    | 'predicting'
    | 'summarising'
    | 'done';

const PHASE_LABELS: Record<Phase, string> = {
  idle: '',
  minimizing: 'Minimizing...',
  probe: 'Thinking...',
  running: 'Simulating strings...',
  predicting: 'Analysing...',
  summarising: 'Summarizing...',
  done: '',
};

function phaseStatus(phase: Phase, pass: number): string {
  switch (phase) {
    case 'probe':
      return pass > 1 ? `Rethinking (pass ${pass})...` : 'Thinking...';
    case 'running':
      return `Simulating strings (pass ${pass})...`;
    case 'predicting':
      return `Analysing results (pass ${pass})...`;
    case 'minimizing':
      return 'Minimizing automaton...';
    default:
      return PHASE_LABELS[phase];
  }
}

function prepareAutomaton(original: Automaton): {
  promptAutomaton: Automaton;
  canonicalAutomaton: Automaton;
  reduced: boolean
} {
  const dfa = original.type === 'NFA' ? nfaToDfa(original) : original;
  const minimized = minimize(dfa);
  const isSmaller = minimized.transitions.length < original.transitions.length;

  return {
    promptAutomaton: isSmaller ? minimized : original,
    canonicalAutomaton: minimized,
    reduced: isSmaller,
  };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGoogleLLM(
    api: string,
    model: string,
    userText: string,
    maxTokens: number,
    prefill?: string,
    stopSequences?: string[],
    maxRetries = 3
): Promise<string> {
  let prompt = userText;
  if (prefill) {
    prompt +=
        `\n\nDo not output brackets or keys. ` +
        `Your response continues the JSON array that begins as: ${prefill}. ` +
        `Start immediately with the next quoted string.`;
  }

  console.log(`[callGoogleLLM] request: model=${model} maxTokens=${maxTokens} temp=0.1` +
      `${prefill ? ` prefill=${JSON.stringify(prefill)}` : ''}` +
      `${stopSequences ? ` stopSequences=${JSON.stringify(stopSequences)}` : ''}`);
  console.log(`[callGoogleLLM] prompt:\n${prompt}`);

  let attempt = 0;
  const baseDelay = 1000;

  while (attempt <= maxRetries) {
    try {
      const res = await fetch(`${api}/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.1,
            ...(stopSequences ? { stopSequences } : {}),
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const errorMessage = body?.error?.message ?? `HTTP ${res.status}`;
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          const error = new Error(errorMessage);
          (error as any).isFatal = true;
          throw error;
        }

        throw new Error(errorMessage);
      }

      const data = await res.json();
      const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();

      if (attempt > 0) {
        console.log(`[callGoogleLLM] Succeeded after ${attempt} retries.`);
      }
      console.log(`[callGoogleLLM] response (${text.length} chars):\n${text}`);
      return text;

    } catch (error: any) {
      if (error.isFatal || attempt >= maxRetries) {
        console.error(`[callGoogleLLM] Failed permanently after ${attempt} retries:`, error);
        throw error;
      }

      const waitTime = baseDelay * Math.pow(2, attempt) + Math.random() * 500;

      console.warn(`[callGoogleLLM] Attempt ${attempt + 1} failed. Retrying in ${Math.round(waitTime)}ms... Error: ${error.message}`);

      await delay(waitTime);
      attempt++;
    }
  }

  throw new Error("Failed to call LLM API after maximum retries.");
}

function extractJsonArray(raw: string): string[] {
  let openBrackets = 0;
  let startIndex = -1;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '[') {
        if (openBrackets === 0) startIndex = i;
        openBrackets++;
      } else if (char === ']') {
        openBrackets--;
        if (openBrackets === 0 && startIndex !== -1) {
          try {
            const parsed = JSON.parse(raw.substring(startIndex, i + 1));
            if (Array.isArray(parsed)) return parsed.map(String).map(s => s.trim());
          } catch {
            startIndex = -1;
          }
        }
      }
    }
  }

  const fallback = [...raw.matchAll(/"([^"]*)"/g)].map(m => m[1].trim());
  return fallback.length > 0 ? fallback : [];
}

function runProbe(automaton: Automaton, strings: string[]): ProbeResult[] {
  return strings.map(str => {
    try {
      const result = simulate(automaton, str);
      return { string: str === '' ? 'ε' : str, accepted: result.accepted };
    } catch {
      return { string: str === '' ? 'ε' : str, accepted: false };
    }
  });
}

function automatonContext(automaton: Automaton): string {
  const states = automaton.states.map(s => `${s.label}${s.isStart ? ' (start)' : ''}${s.isAccept ? ' (accept)' : ''}`).join(', ');
  const transitions = automaton.transitions.map(t => {
    const from = automaton.states.find(s => s.id === t.from)?.label ?? t.from;
    const to = automaton.states.find(s => s.id === t.to)?.label ?? t.to;
    return `  ${from} --[${t.symbols.join(',')}]--> ${to}`;
  }).join('\n');

  return `Alphabet: {${automaton.alphabet.join(', ') || 'none'}}\nStates: ${states}\nTransitions:\n${transitions}`;
}

function probeTable(results: ProbeResult[]): string {
  return results.map(r => `  "${r.string}" → ${r.accepted ? 'ACCEPT' : 'REJECT'}`).join('\n');
}

function extractHypothesis(text: string): string {
  const match = text.match(/\[WORKING HYPOTHESIS\]\s*([\s\S]*?)(?=\[|$)/i);
  return match ? match[1].trim() : "";
}

function extractFinalRule(text: string): string {
  const match = text.match(/\[FINAL RULE\]\s*([\s\S]*)$/i);
  return match ? match[1].trim() : text;
}

const PROBE_PROMPT = (ctx: string, seen: ProbeResult[], previousHypothesis: string) => {
  const seenNote = seen.length > 0
      ? `\nPreviously tested outcomes (do NOT duplicate):\n${probeTable(seen)}\n`
      : '';

  const hasAccepts = seen.some(r => r.accepted);
  const hasRejects = seen.some(r => !r.accepted);

  let agenticDirective = '';

  if (seen.length > 0 && !hasAccepts) {
    agenticDirective = `\nCRITICAL DATA SKEW: All tested strings so far have been REJECTED. You MUST trace the transitions to an accept state and generate 9 strings that will be ACCEPTED.`;
  }
  else if (seen.length > 0 && !hasRejects) {
    agenticDirective = `\nCRITICAL DATA SKEW: All tested strings so far have been ACCEPTED. You MUST trace the transitions to a non-accept state and generate 9 strings that will be REJECTED.`;
  }
  else if (previousHypothesis) {
    agenticDirective = `\nCURRENT THEORY: The analyzer currently believes the rule is: "${previousHypothesis}".\nYour job is to generate 9 strings that will PROVE THIS THEORY WRONG if it is incorrect.`;
  }
  else {
    agenticDirective = `\nTask: Generate 9 novel test strings designed to uncover the underlying rule. Target boundary cases, single characters, and repeating sequences.`;
  }

  return (
      `You are an adversarial software tester analyzing a deterministic finite automaton (DFA).\n\n` +
      `Automaton Definition:\n${ctx}${seenNote}${agenticDirective}`
  );
};

const PREDICT_PROMPT = (ctx: string, results: ProbeResult[], previousHypothesis: string) => {
  const feedbackNote = previousHypothesis
      ? `\nNote: Your previous hypothesis was "${previousHypothesis}". Evaluate the new test strings to see if this hypothesis still holds up. If it is disproven, formulate a new one.\n\n`
      : `\n\n`;

  return `You are an expert computational linguist tasked with reverse-engineering the exact acceptance rule of a finite automaton.\n\n` +
      `Automaton Definition:\n${ctx}\n\n` +
      `Simulation Results (Test Strings and Outcomes):\n${probeTable(results)}${feedbackNote}` +
      `Format your response EXACTLY using the following structure:\n\n` +
      `[ANALYSIS]\n` +
      `(Step-by-step trace mapping the test strings against the state transitions.)\n\n` +
      `[WORKING HYPOTHESIS]\n` +
      `(State your current best guess for the rule in one sentence.)\n\n` +
      `[VALIDATION]\n` +
      `(Test your Working Hypothesis against EVERY SINGLE simulation result above. Does your hypothesis correctly predict the outcome for every string? Answer YES or NO for each string.)\n\n` +
      `[CONFIDENCE]\n` +
      `Write exactly one word: High, Medium, or Low.\n` +
      `- MUST output Low if your hypothesis failed ANY simulation result in the Validation step.\n` +
      `- MUST output Medium if you only have REJECT results or only have ACCEPT results (insufficient data).\n` +
      `- MUST output High ONLY if your hypothesis correctly predicted 100% of a mixed (Accept/Reject) dataset.\n\n` +
      `[FINAL RULE]\n` +
      `(If Confidence is High, finalize the rule here in plain language under 40 words.)`;
}

const SUMMARISE_PROMPT = (ruleText: string, alphabet: string[]) =>
    `Task: Translate the provided technical rule into a single, concise constraint.\n\n` +
    `Rule: "${ruleText}"\n\n` +
    `Strict Constraints:\n` +
    `1. Output EXACTLY ONE SENTENCE.\n` +
    `2. MUST begin with: "Accepts strings that "\n` +
    `3. MUST be under 20 words.\n` +
    `4. Explicitly reference characters from alphabet: {${alphabet.join(', ') || 'none'}}.\n` +
    `5. BANNED WORDS: state, q0, q1, automaton, machine, accepting, rejecting.\n\n` +
    `Output ONLY the final translated sentence. No introductory text.`;


export default function GeminiPanel() {
  const { activeProject, user } = useStore();
  const [phase, setPhase] = useState<Phase>('idle');
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wasReduced, setWasReduced] = useState(false);
  const [iterationsRun, setIterationsRun] = useState(0);

  if (!activeProject) return null;

  const isEmpty = activeProject.states.length === 0;
  const api = import.meta.env.VITE_GEMINI_API as string | undefined;
  const isLoading = phase !== 'idle' && phase !== 'done';

  const reset = () => {
    setPhase('idle');
    setSummary(null);
    setError(null);
    setWasReduced(false);
    setIterationsRun(0);
  };

  const handleSummarize = async (force = false) => {
    if (!api) {
      setError('Set VITE_GEMINI_API in your .env file or github secrets and restart the dev server.');
      return;
    }
    if (isEmpty) return;
    reset();

    try {
      setPhase('minimizing');

      const { promptAutomaton, canonicalAutomaton, reduced } = prepareAutomaton(activeProject);
      setWasReduced(reduced);
      const ctx = automatonContext(promptAutomaton);
      const canonical = canonicalize(canonicalAutomaton);
      const cacheKey = djb2Hash(canonical);

      if (user && !force) {
        const cached = await fetchAiSummary(cacheKey);
        if (cached) {
          setSummary(cached);
          setPhase('done');
          return;
        }
      }

      const PREFILL = '["epsilon", ';
      const MAX_ITERATIONS = 4;
      let allResults: ProbeResult[] = [];
      let prediction = "";
      let currentHypothesis = "";

      for (let i = 1; i <= MAX_ITERATIONS; i++) {
        setIterationsRun(i);
        setPhase('probe');
        console.log(`[GeminiPanel] === Iteration ${i}/${MAX_ITERATIONS} === (probe)`);

        const rawProbe = await callGoogleLLM(api, 'gemini-3.1-flash-lite', PROBE_PROMPT(ctx, allResults, currentHypothesis), 60, PREFILL, [']']);
        console.log(`[GeminiPanel] Probe ${i} raw (${rawProbe.length} chars):`, rawProbe);

        setPhase('running');

        const rawArrayStr = PREFILL + rawProbe + (rawProbe.endsWith(']') ? '' : ']');
        const extractedStrings = extractJsonArray(rawArrayStr).map(str => str.toLowerCase() === 'epsilon' ? '' : str);
        console.log(`[GeminiPanel] Probe ${i} extracted strings:`, extractedStrings);

        const probeRes = runProbe(promptAutomaton, extractedStrings);
        allResults = [...allResults, ...probeRes];
        console.log(`[GeminiPanel] Probe ${i} results (${probeRes.length}):`, probeRes);
        console.log(`[GeminiPanel] Running total results: ${allResults.length}`);

        setPhase('predicting');

        console.log(`[GeminiPanel] Predicting (iteration ${i}, ${allResults.length} results)...`);
        prediction = await callGoogleLLM(api, 'gemini-3.5-flash-lite', PREDICT_PROMPT(ctx, allResults, currentHypothesis), 1000);
        console.log(`[GeminiPanel] Prediction ${i}:\n${prediction}`);

        currentHypothesis = extractHypothesis(prediction);
        console.log(`[GeminiPanel] Hypothesis ${i}:`, JSON.stringify(currentHypothesis));

        const hasHighConfidence = /\[CONFIDENCE\]\s*:?\s*\n?\s*High/i.test(prediction);
        console.log(`[GeminiPanel] Confidence check: highConfidence=${hasHighConfidence}, atMaxIterations=${i === MAX_ITERATIONS}`);
        if (hasHighConfidence || i === MAX_ITERATIONS) {
          console.log(`[GeminiPanel] Exiting loop: ${hasHighConfidence ? 'High confidence' : 'max iterations reached'} (stopped at iteration ${i})`);
          break;
        }
      }

      setPhase('summarising');

      const ruleToSummarize = extractFinalRule(prediction) || currentHypothesis;
      console.log(`[GeminiPanel] Rule to summarize:`, JSON.stringify(ruleToSummarize));

      const finalSummary = await callGoogleLLM(api, 'gemini-3.5-flash-lite', SUMMARISE_PROMPT(ruleToSummarize, canonicalAutomaton.alphabet), 60);
      console.log(`[GeminiPanel] Final summary:`, finalSummary);

      setSummary(finalSummary);
      if (user) {
        writeAiSummary(cacheKey, canonicalAutomaton, canonical, user.uid, finalSummary);
      }
      setPhase('done');
    } catch (e: unknown) {
      console.error('[GeminiPanel] Error caught:', e);
      setError(e instanceof Error ? e.message : 'Analysis failed. Please try again.');
      setPhase('idle');
    }
  };

  return (
      <div className="sidebar-section gemini-panel">
        <p className="sidebar-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SparkleIcon sx={{ fontSize: 13, color: 'var(--accent)' }} />
          AI Summary
        </p>

        {phase !== 'done' ? (
            <button
                className="btn btn-ghost gemini-btn"
                disabled={isEmpty || isLoading}
                onClick={() => handleSummarize()}
            >
              {isLoading ? (
                  <>
                    <span className="spinner" />
                    <span style={{ marginLeft: 8 }}>
                {phaseStatus(phase, iterationsRun)}
              </span>
                  </>
              ) : (
                  <>
                    <SparkleIcon sx={{ fontSize: 14 }} />
                    <span style={{ marginLeft: 8 }}>Summarize automaton</span>
                  </>
              )}
            </button>
        ) : (
            <button className="btn btn-ghost gemini-btn" onClick={() => handleSummarize(true)}>
              <SparkleIcon sx={{ fontSize: 14 }} />
              <span style={{ marginLeft: 8 }}>Run again</span>
            </button>
        )}

        {wasReduced && phase !== 'minimizing' && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              ✦ Automaton was minimized before analysis
            </p>
        )}

        {summary && (
            <div className="gemini-result" role="region" aria-label="AI summary">
              <p className="gemini-result-text">{summary}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
                <span className="gemini-badge">Gemini Flash Lite • {iterationsRun} passes</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.3 }}>
              AI can make mistakes. The description may not be representative of the actual language. Always double-check answers.
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