import React from 'react';

const BANNER_ID = 'dfa-global-banner';
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

export function emitGlobalAlert(message: string | null) {
  const existing = document.getElementById(BANNER_ID);
  if (existing) existing.remove();
  if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
  if (!message) return;

  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  Object.assign(banner.style, {
    position:   'fixed',
    top:        '0',
    left:       '0',
    right:      '0',
    zIndex:     '2147483647',
    background: '#dc2626',
    color:      '#fff',
    padding:    '11px 20px',
    display:    'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap:        '10px',
    boxShadow:  '0 4px 16px rgba(0,0,0,0.22)',
    fontFamily: 'inherit',
    fontSize:   '13.5px',
    fontWeight: '500',
  });

  banner.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"
      style="flex-shrink:0">
      <path d="M12 5.99L19.53 19H4.47L12 5.99M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"/>
    </svg>
    <span style="flex:1;text-align:center">${message}</span>
    <button id="${BANNER_ID}-close" style="
      background:rgba(255,255,255,0.2);border:none;border-radius:4px;
      color:#fff;cursor:pointer;font-size:15px;line-height:1;padding:3px 8px;flex-shrink:0
    " title="Dismiss">✕</button>
  `;

  document.body.appendChild(banner);

  const close = () => {
    banner.remove();
    if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
  };

  document.getElementById(`${BANNER_ID}-close`)?.addEventListener('click', close);
  dismissTimer = setTimeout(close, 8000);
}
