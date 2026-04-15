import React, { useState, useRef, useEffect } from 'react';

interface SymbolPopoverProps {
  x: number;
  y: number;
  onSubmit: (symbols: string[]) => void;
  onCancel: () => void;
  initialSymbols?: string[];
}

const SymbolPopover: React.FC<SymbolPopoverProps> = ({
  x,
  y,
  onSubmit,
  onCancel,
  initialSymbols,
}) => {
  const [value, setValue] = useState(initialSymbols?.join(', ') || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const symbols = value
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (symbols.length === 0) {
      onCancel();
      return;
    }

    onSubmit(symbols);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 animate-scale-in"
      style={{ left: x, top: y }}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-border rounded-lg shadow-2xl shadow-black/40 p-3 min-w-[200px]"
      >
        <label className="block text-xs text-text-muted mb-1.5 font-medium">
          Transition symbols (comma-separated)
        </label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="a, b, c"
            className="input-field text-sm flex-1 font-mono"
          />
          <button
            type="submit"
            className="btn-primary text-sm px-3 py-1.5"
          >
            OK
          </button>
        </div>
      </form>
    </div>
  );
};

export default SymbolPopover;
