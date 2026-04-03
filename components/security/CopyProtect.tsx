'use client';

import { useCallback, type ReactNode } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// CopyProtect — Wraps sensitive data containers
//
// On copy: intercepts clipboard content and replaces with [REDACTED].
// On right-click: shows custom context menu with only "Report Issue".
// Logs copy attempts to audit_logs with risk_score +15.
// ═══════════════════════════════════════════════════════════════════════════

interface CopyProtectProps {
  children: ReactNode;
  className?: string;
}

export default function CopyProtect({ children, className = '' }: CopyProtectProps) {
  const handleCopy = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    e.clipboardData.setData('text/plain', '[REDACTED - TakeMe Confidential]');

    // Log copy attempt (fire-and-forget)
    fetch('/api/security/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'copy_attempt',
        riskScore: 15,
        copiedContent: 'REDACTED',
      }),
    }).catch(() => {});
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    // Remove any existing custom menu
    const existing = document.getElementById('zt-context-menu');
    if (existing) existing.remove();

    // Create custom context menu
    const menu = document.createElement('div');
    menu.id = 'zt-context-menu';
    menu.style.cssText = `
      position: fixed;
      left: ${e.clientX}px;
      top: ${e.clientY}px;
      z-index: 10000;
      background: #0f0f17;
      border: 1px solid #1e1e2e;
      border-radius: 8px;
      padding: 4px;
      min-width: 160px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    `;

    const item = document.createElement('button');
    item.textContent = 'Report Issue';
    item.style.cssText = `
      display: block;
      width: 100%;
      padding: 8px 12px;
      text-align: left;
      background: none;
      border: none;
      color: #a1a1aa;
      font-size: 13px;
      cursor: pointer;
      border-radius: 4px;
    `;
    item.onmouseenter = () => { item.style.background = '#1e1e2e'; item.style.color = '#fff'; };
    item.onmouseleave = () => { item.style.background = 'none'; item.style.color = '#a1a1aa'; };
    item.onclick = () => {
      menu.remove();
      window.open('mailto:security@takememobility.com?subject=Security%20Issue%20Report', '_blank');
    };
    menu.appendChild(item);
    document.body.appendChild(menu);

    // Remove on click elsewhere
    const cleanup = () => {
      menu.remove();
      document.removeEventListener('click', cleanup);
    };
    setTimeout(() => document.addEventListener('click', cleanup), 0);
  }, []);

  return (
    <div
      onCopy={handleCopy}
      onContextMenu={handleContextMenu}
      className={className}
    >
      {children}
    </div>
  );
}
