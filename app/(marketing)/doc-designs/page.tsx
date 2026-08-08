import React from 'react'
import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'

// Remix Icons (Solid Fill)
import {
  RiGraduationCapFill,
  RiInformationFill,
  RiCodeSSlashFill,
  RiBuilding4Fill,
} from '@remixicon/react'

import { SECTIONS, type Article } from '../docs/content'

export const metadata: Metadata = {
  title: { absolute: 'Docs card icon set comparisons' },
}

type IconComp = React.ComponentType<{ className?: string; size?: number | string; weight?: string }>

const REMIX_ICONS: Record<string, IconComp> = {
  welcome: RiGraduationCapFill as IconComp,
  'core-concepts': RiInformationFill as IconComp,
  'for-developers': RiCodeSSlashFill as IconComp,
  'for-founders': RiBuilding4Fill as IconComp,
}

const CARD_BASE =
  'group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/[0.08] bg-[#070709] p-4 text-left transition-all duration-200 hover:border-accent/30 hover:bg-[#0a0a0e]'

function CardBody({
  article,
  className = '',
}: {
  article: Article
  className?: string
}) {
  return (
    <div className={`relative z-10 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[14.5px] font-medium tracking-tight text-white transition-colors group-hover:text-accent">
          {article.title}
        </h3>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-white/20 opacity-50 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-accent group-hover:opacity-100"
          strokeWidth={1.7}
        />
      </div>
      <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-white/50 group-hover:text-white/65">
        {article.description}
      </p>
      {article.readTime && (
        <div className="mt-3.5 flex items-center gap-2 border-t border-white/[0.04] pt-2 font-mono text-[11px] text-white/40">
          <span>{article.readTime}</span>
        </div>
      )}
    </div>
  )
}

/* ── SET 1: Remix Icons Solid Watermark ──────────────────────────────────── */
function RemixWatermarkCard({ article }: { article: Article }) {
  const Icon = REMIX_ICONS[article.slug]
  return (
    <div className={CARD_BASE}>
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -right-8 text-white opacity-[0.07] transition-all duration-300 group-hover:-translate-y-1 group-hover:text-accent group-hover:opacity-[0.15]"
      >
        {Icon && <Icon className="h-40 w-40" />}
      </div>
      <CardBody article={article} className="pr-16" />
    </div>
  )
}

/* ── SET 2: Remix Solid Icon Badge Tile ─────────────────────────────────── */
function RemixBadgeCard({ article }: { article: Article }) {
  const Icon = REMIX_ICONS[article.slug]
  return (
    <div className={CARD_BASE}>
      <div className="relative z-10 flex flex-col justify-between h-full">
        <div>
          <div className="mb-3.5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-accent/25 bg-accent/[0.1] text-accent transition-all duration-200 group-hover:scale-105 group-hover:border-accent/40 group-hover:bg-accent/[0.16]">
            {Icon && <Icon className="h-6 w-6" />}
          </div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[14.5px] font-medium tracking-tight text-white transition-colors group-hover:text-accent">
              {article.title}
            </h3>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-white/20 opacity-50 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-accent group-hover:opacity-100"
              strokeWidth={1.7}
            />
          </div>
          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-white/50 group-hover:text-white/65">
            {article.description}
          </p>
        </div>
        {article.readTime && (
          <div className="mt-3.5 flex items-center gap-2 border-t border-white/[0.04] pt-2 font-mono text-[11px] text-white/40">
            <span>{article.readTime}</span>
          </div>
        )}
      </div>
    </div>
  )
}

const SETS = [
  {
    key: '1',
    name: 'Remix Solid Watermark (Selected)',
    tag: 'SELECTED',
    note: 'Sleek, sharp modern dev-tool aesthetics. Extremely clean solid vectors at 160px.',
    Card: RemixWatermarkCard,
  },
  {
    key: '2',
    name: 'Remix Solid Badge Tile',
    tag: 'BADGE TILE',
    note: 'Solid accent-tinted icon tile top-left at 24px.',
    Card: RemixBadgeCard,
  },
] as const

export default function DocDesignsPage() {
  const articles = SECTIONS[0].articles.slice(0, 4)

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-12">
          <p className="font-mono text-[11px] uppercase tracking-widest text-accent">
            Icon Set & Style Preview
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Remix Solid Icon Treatments
          </h1>
        </header>

        <div className="space-y-14">
          {SETS.map(({ key, name, tag, note, Card }) => (
            <section key={key}>
              <div className="mb-4 border-b border-white/[0.06] pb-3">
                <h2 className="flex items-center gap-3 text-[15px] font-medium text-white">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-accent/30 bg-accent/[0.08] font-mono text-[11px] text-accent">
                    {key}
                  </span>
                  {name}
                  <span className="rounded-full bg-accent/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-accent">
                    {tag}
                  </span>
                </h2>
                <p className="mt-1.5 pl-9 text-[13px] leading-relaxed text-white/45">
                  {note}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {articles.map((article) => (
                  <Card key={article.slug} article={article} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
