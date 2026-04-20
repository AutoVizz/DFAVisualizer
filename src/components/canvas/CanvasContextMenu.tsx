import { useEffect, useRef } from 'react';

interface MenuItem {
  label:  string;
  action: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  x:       number;
  y:       number;
  items:   MenuItem[];
  onClose: () => void;
}

export default function CanvasContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const menuX = Math.min(x, window.innerWidth  - 180);
  const menuY = Math.min(y, window.innerHeight - items.length * 36 - 16);

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: menuX, top: menuY }}
      onContextMenu={e => e.preventDefault()}
    >
      {items.map((item, i) =>
        item.label === '---' ? (
          <div key={i} className="context-menu-separator" />
        ) : (
          <button
            key={i}
            className={`context-menu-item${item.danger ? ' danger' : ''}`}
            disabled={item.disabled}
            onClick={() => { item.action(); onClose(); }}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
}
