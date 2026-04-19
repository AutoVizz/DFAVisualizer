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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
      style="flex-shrink:0">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
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
