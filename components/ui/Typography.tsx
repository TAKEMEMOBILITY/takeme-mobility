'use client';

import Link from 'next/link';
import type { ReactNode, CSSProperties, MouseEventHandler } from 'react';

// ── Font family tokens (map to CSS variables in app/layout.tsx) ─────────

const SERIF = 'var(--font-dm-serif), Georgia, serif';
const SANS = 'var(--font-dm-sans), var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

// ── Color tokens (matches global typography spec) ───────────────────────

const COLOR_HEADING = '#0A0A0A';
const COLOR_BODY = '#3A3A3C';
const COLOR_SUB = '#636366';
const COLOR_BLUE = '#1D6AE5';
const COLOR_BLUE_HOVER = '#1558C0';

// ── PageTitle — hero H1 ─────────────────────────────────────────────────

export function PageTitle({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <h1
      className={className}
      style={{
        fontFamily: SERIF,
        fontSize: 'clamp(2.5rem, 5.5vw, 4.25rem)',
        lineHeight: 1.05,
        letterSpacing: '-0.02em',
        color: COLOR_HEADING,
        fontWeight: 400,
        margin: 0,
        ...style,
      }}
    >
      {children}
    </h1>
  );
}

// ── SectionTitle — H2 / H3 ──────────────────────────────────────────────

export function SectionTitle({
  children,
  className,
  style,
  as: Tag = 'h2',
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: 'h2' | 'h3';
}) {
  return (
    <Tag
      className={className}
      style={{
        fontFamily: SERIF,
        fontSize: 'clamp(1.75rem, 4vw, 3rem)',
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
        color: COLOR_HEADING,
        fontWeight: 400,
        margin: 0,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

// ── Eyebrow — blue pill tag ─────────────────────────────────────────────

export function Eyebrow({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{
        fontFamily: SANS,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        color: COLOR_BLUE,
        backgroundColor: 'rgba(29, 106, 229, 0.1)',
        padding: '6px 14px',
        borderRadius: 980,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// ── BodyText — main paragraph copy ──────────────────────────────────────

export function BodyText({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <p
      className={className}
      style={{
        fontFamily: SANS,
        fontSize: 17,
        lineHeight: 1.65,
        color: COLOR_BODY,
        fontWeight: 400,
        margin: 0,
        ...style,
      }}
    >
      {children}
    </p>
  );
}

// ── SubText — quieter subtitle copy ─────────────────────────────────────

export function SubText({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <p
      className={className}
      style={{
        fontFamily: SANS,
        fontSize: 17,
        lineHeight: 1.6,
        color: COLOR_SUB,
        fontWeight: 400,
        margin: 0,
        ...style,
      }}
    >
      {children}
    </p>
  );
}

// ── Button tokens ───────────────────────────────────────────────────────

const BTN_BASE: CSSProperties = {
  fontFamily: SANS,
  fontSize: 15,
  fontWeight: 600,
  borderRadius: 980,
  padding: '17px 24px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  cursor: 'pointer',
  border: 'none',
  transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
  whiteSpace: 'nowrap',
};

// ── PrimaryButton — blue pill ───────────────────────────────────────────

export function PrimaryButton({
  children,
  href,
  onClick,
  className,
  style,
  type,
}: {
  children: ReactNode;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  style?: CSSProperties;
  type?: 'button' | 'submit';
}) {
  const computed: CSSProperties = {
    ...BTN_BASE,
    background: COLOR_BLUE,
    color: 'white',
    ...style,
  };

  const handleEnter = (e: React.MouseEvent<HTMLElement>) => {
    (e.currentTarget as HTMLElement).style.background = COLOR_BLUE_HOVER;
  };
  const handleLeave = (e: React.MouseEvent<HTMLElement>) => {
    (e.currentTarget as HTMLElement).style.background = COLOR_BLUE;
  };

  if (href) {
    return (
      <Link
        href={href}
        className={className}
        style={computed}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {children}
      </Link>
    );
  }
  return (
    <button
      type={type ?? 'button'}
      onClick={onClick}
      className={className}
      style={computed}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
    </button>
  );
}

// ── SecondaryButton — outline pill ──────────────────────────────────────

export function SecondaryButton({
  children,
  href,
  onClick,
  className,
  style,
  type,
}: {
  children: ReactNode;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  style?: CSSProperties;
  type?: 'button' | 'submit';
}) {
  const computed: CSSProperties = {
    ...BTN_BASE,
    background: 'transparent',
    color: COLOR_HEADING,
    border: '1px solid #d2d2d7',
    ...style,
  };

  const handleEnter = (e: React.MouseEvent<HTMLElement>) => {
    (e.currentTarget as HTMLElement).style.background = '#f5f5f7';
  };
  const handleLeave = (e: React.MouseEvent<HTMLElement>) => {
    (e.currentTarget as HTMLElement).style.background = 'transparent';
  };

  if (href) {
    return (
      <Link
        href={href}
        className={className}
        style={computed}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {children}
      </Link>
    );
  }
  return (
    <button
      type={type ?? 'button'}
      onClick={onClick}
      className={className}
      style={computed}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
    </button>
  );
}
