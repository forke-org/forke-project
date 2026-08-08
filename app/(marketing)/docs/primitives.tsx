'use client'

import React, { useState } from 'react'
import Link from 'next/link'

/**
 * Prose + content primitives for docs articles.
 * Linear-style: generous line-height, muted body, accent links, monospace
 * inline tags. The `Visual` primitive renders mock product UI on the soft
 * radial-gradient backdrop (matching the screenshot-on-gradient reference).
 */

export function Prose({ children }: { children: React.ReactNode }) {
  return <div className="space-y-5">{children}</div>
}

export function Lead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-lg font-light leading-relaxed text-white/65 md:text-xl">{children}</p>
  )
}

export function H3({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-28 pt-6 text-[1.6rem] font-medium tracking-[-0.02em] text-white"
    >
      {children}
    </h2>
  )
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-[1.75] text-white/55">{children}</p>
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="space-y-2.5 pl-1 text-[15px] leading-[1.7] text-white/55 marker:text-accent/60 [&>li]:list-disc [&>li]:ml-5">
      {children}
    </ul>
  )
}

export function OL({ children }: { children: React.ReactNode }) {
  return (
    <ol className="space-y-2.5 pl-1 text-[15px] leading-[1.7] text-white/55 marker:font-mono marker:text-accent/60 [&>li]:list-decimal [&>li]:ml-5">
      {children}
    </ol>
  )
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[12.5px] text-accent-text">
      {children}
    </code>
  )
}

export function KBD({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-white/[0.12] bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-white/70">
      {children}
    </kbd>
  )
}

export function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith('http') || href.startsWith('mailto:')
  const className =
    'font-medium text-white underline decoration-accent/40 underline-offset-[3px] transition-colors hover:decoration-accent'
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-accent/20 border-l-4 border-l-accent bg-accent/[0.04] px-4 py-3.5 text-[14px] leading-relaxed text-white/70">
      <div className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-accent">
        Note
      </div>
      {children}
    </div>
  )
}

export function Steps({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3">{children}</div>
}

export function Step({
  n,
  title,
  children,
}: {
  n: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-4 rounded-xl border border-white/[0.07] border-l-2 border-l-accent/40 bg-white/[0.02] p-4 transition-all duration-200 hover:border-accent/30 hover:bg-white/[0.03]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent/[0.07] font-mono text-[13px] font-semibold text-accent">
        {n}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-[15px] font-medium tracking-[-0.01em] text-white">{title}</h4>
        <p className="mt-1 text-[14px] leading-relaxed text-white/50">{children}</p>
      </div>
    </div>
  )
}

export function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="group relative my-4 overflow-hidden rounded-xl border border-white/[0.08] bg-[#070709]">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-2 font-mono text-[11px] text-white/40">
        <span>{language}</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-white/50 hover:border-white/20 hover:text-white transition-colors"
        >
          {copied ? <span className="text-emerald-400 font-medium">Copied!</span> : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] text-accent/90 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function Table({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08]">
      <table className="w-full border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-white/[0.08] bg-white/[0.02]">
            {head.map((h) => (
              <th
                key={h}
                className="px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-widest text-white/40"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-white/[0.05] last:border-0">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-4 py-3 align-top ${ci === 0 ? 'font-medium text-white/80' : 'text-white/55'}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * A product visual: mock UI floating on the soft radial-gradient backdrop
 * (the screenshot-on-gradient look). Used for diagrams and mock cards.
 */
export function Visual({
  label,
  caption,
  children,
}: {
  label?: string
  caption?: string
  children: React.ReactNode
}) {
  return (
    <figure className="my-2">
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08]">
        {/* Gradient backdrop */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 50% 0%, rgba(255,122,0,0.10), transparent 55%), linear-gradient(180deg, #0c0c0f 0%, #050506 100%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(circle at 50% 30%, black, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(circle at 50% 30%, black, transparent 75%)',
          }}
        />
        <div className="relative px-6 py-10 sm:px-10 sm:py-14">
          {label && (
            <div className="mb-6 text-center font-mono text-[11px] uppercase tracking-widest text-white/35">
              {label}
            </div>
          )}
          {children}
        </div>
      </div>
      {caption && (
        <figcaption className="mt-3 text-center text-[13px] text-white/35">{caption}</figcaption>
      )}
    </figure>
  )
}
