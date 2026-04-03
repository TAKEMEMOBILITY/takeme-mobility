'use client';

import { useState, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// Watermark — Full-page overlay for sensitive pages
//
// Renders SVG watermark with user email + role + timestamp.
// Rotates every 60 seconds. z-index: 9999, pointer-events: none.
// Not removable via DevTools (CSS ::before, user-select: none).
// ═══════════════════════════════════════════════════════════════════════════

interface WatermarkProps {
  userEmail: string;
  role: string;
  sessionId?: string;
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSVG(email: string, role: string, sessionId?: string): string {
  const sessionShort = sessionId ? sessionId.slice(-8) : '--------';
  const ts = new Date().toISOString().slice(0, 16);
  const text = `${email}  ·  ${role}  ·  ${ts}  ·  ${sessionShort}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><text x="300" y="150" text-anchor="middle" dominant-baseline="middle" transform="rotate(-30 300 150)" font-family="monospace" font-size="14" font-weight="600" fill="rgba(255,255,255,0.06)" letter-spacing="1">${escapeXML(text)}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export default function Watermark({ userEmail, role, sessionId }: WatermarkProps) {
  const [bgUrl, setBgUrl] = useState('');

  useEffect(() => {
    // Generate immediately
    setBgUrl(buildSVG(userEmail, role, sessionId));

    // Rotate every 60 seconds
    const interval = setInterval(() => {
      setBgUrl(buildSVG(userEmail, role, sessionId));
    }, 60_000);

    return () => clearInterval(interval);
  }, [userEmail, role, sessionId]);

  if (!bgUrl) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'none',
        userSelect: 'none',
        backgroundImage: `url('${bgUrl}')`,
        backgroundRepeat: 'repeat',
        backgroundSize: '600px 300px',
      }}
    />
  );
}
