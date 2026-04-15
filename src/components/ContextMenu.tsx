import React, { useEffect, useRef } from 'react';

interface ContextMenuItem {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 animate-scale-in"
      style={{ left: x, top: y }}
    >
      <div className="bg-surface border border-border rounded-lg shadow-2xl shadow-black/40 overflow-hidden min-w-[180px] py-1">
        {items.map((item, index) => (
          <button
            key={index}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
            disabled={item.disabled}
            className={`
              w-full text-left px-3 py-2 text-sm transition-colors duration-100
              ${item.disabled
                ? 'text-text-muted cursor-not-allowed'
                : item.variant === 'danger'
                ? 'text-reject-red hover:bg-red-900/20'
                : 'text-text-primary hover:bg-surface-light'
              }
            `}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ContextMenu;
