import { useStore } from "../../store/useStore";

const STATE_LIMIT_MSG =
  "Computational Halt: The resulting deterministic automaton exceeds the " +
  "system-safe threshold of 100 states. Proceeding with this structural " +
  "transformation will result in exponential memory allocation (O(2^n)) " +
  "and may severely degrade or crash your browser environment.";

export default function ErrorBanner() {
  const { workerStatus, workerError } = useStore();
  if (workerStatus !== "error" || !workerError) return null;

  const msg = workerError.includes("MAX_STATE_LIMIT_EXCEEDED")
    ? STATE_LIMIT_MSG
    : workerError.replace("INVALID_REGEX: ", "");

  return (
    <div className="sidebar-section">
      <div className="error-banner">
        <span style={{ fontSize: 16 }}>⚠</span>
        <span>{msg}</span>
      </div>
    </div>
  );
}
