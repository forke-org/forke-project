import React from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { auth } from '@/auth'
import DocsShell from './DocsShell'
import { SECTIONS, POPULAR_ARTICLES, getDocsIndexMarkdown, type Article } from './content'

export const metadata: Metadata = {
  title: { absolute: 'Forke Docs' },
}

function ArticleCard({ article }: { article: Article }) {
  const Icon = article.icon
  return (
    <Link
      href={`/docs/${article.slug}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/[0.08] bg-[#070709] p-4 text-left transition-all duration-200 hover:border-accent/30 hover:bg-[#0a0a0e]"
    >
      {/* Solid background watermark logo/icon */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -right-8 text-white opacity-[0.07] transition-all duration-300 group-hover:-translate-y-1 group-hover:text-accent group-hover:opacity-[0.15]"
      >
        <Icon className="h-40 w-40" />
      </div>

      {/* Card Content - Text is primary */}
      <div className="relative z-10 pr-16">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[14.5px] font-medium tracking-tight text-white transition-colors group-hover:text-accent">
            {article.title}
          </h3>
          <ArrowRight
            className="h-4 w-4 shrink-0 text-white/20 opacity-50 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-accent group-hover:opacity-100"
            strokeWidth={1.7}
          />
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-white/50 group-hover:text-white/65 line-clamp-2">
          {article.description}
        </p>

        {/* Feature B: Metadata Badge (Read Time) */}
        {article.readTime && (
          <div className="mt-3.5 flex items-center gap-2 pt-2 border-t border-white/[0.04] font-mono text-[11px] text-white/40">
            <span>{article.readTime}</span>
          </div>
        )}
      </div>
    </Link>
  )
}

export default async function DocsHome() {
  const session = await auth()
  return (
    <DocsShell
      copy={{ markdown: getDocsIndexMarkdown(), viewHref: '/docs/raw' }}
      isLoggedIn={Boolean(session?.user)}
    >
      <main className="mx-auto max-w-5xl px-5 py-8 md:px-10 md:py-12">
        {/* Compact Editorial Hero */}
        <div className="max-w-2xl">
          <h1 className="text-3xl font-medium tracking-tight text-white md:text-5xl">
            Forke <span className="text-accent">Docs</span>
          </h1>
          <p className="mt-3 text-base md:text-lg font-light leading-relaxed text-white/60">
            Everything you need to ship work, earn trust, and get paid on Forke.
          </p>

          {/* Quick links tag bar */}
          <div className="mt-5 flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.06]">
            <span className="font-mono text-[11px] uppercase tracking-wider text-white/35 mr-1">
              Quick links:
            </span>
            {POPULAR_ARTICLES.slice(0, 4).map((a) => (
              <Link
                key={a.slug}
                href={`/docs/${a.slug}`}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[12px] text-white/65 transition-colors hover:border-accent/40 hover:bg-accent/[0.08] hover:text-white"
              >
                {a.title}
              </Link>
            ))}
          </div>
        </div>

        {/* Section Blocks Architecture */}
        <div className="mt-10 space-y-8">
          {SECTIONS.map((section) => {
            return (
              <section key={section.id} id={section.id} className="scroll-mt-20">
                <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#09090b]/90 p-5 md:p-6 shadow-xl backdrop-blur-sm">
                  {/* Soft top-left section glow */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-accent/[0.03] blur-2xl"
                  />

                  {/* Connected Section Header */}
                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.06] pb-4 mb-4 gap-2">
                    <div>
                      <h2 className="font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-accent">
                        {section.label}
                      </h2>
                      <p className="text-[13px] text-white/50 mt-0.5">
                        {section.description}
                      </p>
                    </div>
                    <span className="self-start sm:self-auto rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 font-mono text-[11px] font-medium text-white/45">
                      {section.articles.length} {section.articles.length === 1 ? 'article' : 'articles'}
                    </span>
                  </div>

                  {/* Connected Article Grid */}
                  <div className="relative z-10 grid gap-3 sm:grid-cols-2">
                    {section.articles.map((a) => (
                      <ArticleCard key={a.slug} article={a} />
                    ))}
                  </div>
                </div>
              </section>
            )
          })}
        </div>

        {/* Help footer */}
        <section className="mt-14 rounded-2xl border border-white/[0.08] bg-[#09090b] p-8 text-center shadow-xl">
          <h2 className="text-xl font-medium tracking-tight text-white">Still stuck?</h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-white/50">
            If the documentation doesn&apos;t answer your question, our team is always ready to assist.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/support"
              className="rounded-lg bg-accent px-5 py-2.5 text-[13px] font-semibold tracking-tight text-[#0a0a0a] transition-colors hover:bg-accent-hover"
            >
              Contact support
            </Link>
            <Link
              href="/contact"
              className="rounded-lg border border-white/[0.12] bg-white/[0.02] px-5 py-2.5 text-[13px] font-medium text-white/80 transition-colors hover:border-white/25 hover:text-white"
            >
              Contact us
            </Link>
          </div>
        </section>
      </main>
    </DocsShell>
  )
}
