// ═══════════════════════════════════════════════════════════════════════════
// Zero Trust — Dynamic Watermark Generation
//
// SVG watermark: user email + role + timestamp + session ID (partial)
// Rotates every 60 seconds. Embedded as CSS background on sensitive pages.
// Semi-transparent (opacity 0.06), diagonal, repeating, per-user traceable.
// Not removable via DevTools (::before on body, pointer-events:none).
// ═══════════════════════════════════════════════════════════════════════════

export function generateWatermarkSVG(
  email: string,
  role: string,
  sessionId?: string,
): string {
  // Truncate session to last 8 chars for traceability without full exposure
  const sessionShort = sessionId ? sessionId.slice(-8) : '--------';
  // Timestamp rotates every 60 seconds
  const ts = new Date().toISOString().slice(0, 16);
  const text = `${email}  ·  ${role}  ·  ${ts}  ·  ${sessionShort}`;

  // SVG with rotated text, repeating tile
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300">
    <text
      x="300" y="150"
      text-anchor="middle"
      dominant-baseline="middle"
      transform="rotate(-30 300 150)"
      font-family="monospace"
      font-size="14"
      font-weight="600"
      fill="rgba(255,255,255,0.06)"
      letter-spacing="1"
    >${escapeXML(text)}</text>
  </svg>`;

  return svg;
}

export function generateWatermarkCSS(
  email: string,
  role: string,
  sessionId?: string,
): string {
  const svg = generateWatermarkSVG(email, role, sessionId);
  const encoded = Buffer.from(svg).toString('base64');

  return `
    .zt-watermark::before {
      content: '';
      position: fixed;
      inset: 0;
      z-index: 9999;
      pointer-events: none;
      user-select: none;
      background-image: url('data:image/svg+xml;base64,${encoded}');
      background-repeat: repeat;
      background-size: 600px 300px;
      opacity: 1;
    }
    @media print {
      .zt-watermark::before { opacity: 0.3 !important; }
      body * { display: none !important; }
    }
  `;
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
