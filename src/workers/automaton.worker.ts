import { nfaToDfa }  from '../engine/nfaToDfa';
import { minimize }   from '../engine/minimize';
import { thompson }   from '../engine/thompson';
import type { WorkerInMessage, WorkerOutMessage, WorkerErrorCode } from '../types';

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;

  try {
    let result;

    switch (msg.type) {
      case 'NFA_TO_DFA':
        result = nfaToDfa(msg.payload);
        break;

      case 'NFA_TO_MIN_DFA':
        result = minimize(nfaToDfa(msg.payload));
        break;

      case 'MINIMIZE_DFA':
        result = minimize(msg.payload);
        break;

      case 'THOMPSON':
        result = thompson(msg.payload.regex);
        break;

      case 'THOMPSON_TO_MIN_DFA': {
        const builtNfa = thompson(msg.payload.regex);
        const mergedAlphabet = [
          ...new Set([...(builtNfa.alphabet ?? []), ...(msg.payload.extraAlphabet ?? []).filter(s => s !== 'ε')]),
        ];
        const nfaWithAlphabet = { ...builtNfa, alphabet: mergedAlphabet };
        result = minimize(nfaToDfa(nfaWithAlphabet));
        break;
      }

      default: {
        const _exhaustive: never = msg;
        void _exhaustive;
        throw new Error('Unknown message type');
      }
    }

    const out: WorkerOutMessage = { type: 'RESULT', payload: result };
    self.postMessage(out);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    let code: WorkerErrorCode;
    if (message.includes('MAX_STATE_LIMIT_EXCEEDED')) {
      code = 'MAX_STATE_LIMIT_EXCEEDED';
    } else if (message.includes('INVALID_REGEX')) {
      code = 'INVALID_REGEX';
    } else {
      code = 'UNKNOWN';
    }

    const out: WorkerOutMessage = { type: 'ERROR', code, message };
    self.postMessage(out);
  }
};
