import { useState, useEffect, useRef } from "react";

interface EdgePopoverProps {
  x: number;
  y: number;
  isNFA?: boolean;
  onConfirm: (symbols: string[]) => void;
  onCancel: () => void;
}

export default function EdgePopover({ x, y, isNFA, onConfirm, onCancel }: EdgePopoverProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const handleConfirm = () => {
    let raw = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (raw.length === 0) {
      if (isNFA) {
        raw = ["ε"];
      } else {
        setError("Please enter at least one transition symbol.");
        return;
      }
    }
    onConfirm(raw);
  };

  const px = Math.min(x, window.innerWidth - 220);
  const py = Math.min(y, window.innerHeight - 140);

  return (
    <div className="popover" style={{ left: px, top: py }}>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
        Transition symbol(s) — comma separated
      </p>
      <input
        ref={inputRef}
        className="input"
        placeholder={isNFA ? "e.g. a, b (leave empty for ε)" : "e.g. a, b"}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleConfirm();
        }}
        style={{ marginBottom: 4 }}
      />
      {error && <p style={{ fontSize: 11, color: "var(--red)", marginBottom: 6 }}>{error}</p>}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={handleConfirm}>
          Add
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
