import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, ChevronRight } from 'lucide-react'
import DocsShell from '../DocsShell'
import DocToc from '../DocToc'
import { auth } from '@/auth'
import { ALL_ARTICLES, getArticleContext, getArticleMarkdown } from '../content'
import ArticleKeyboardNav from '../ArticleKeyboardNav'
import { buildOpenGraph, buildTwitter } from '@/lib/utils/og'

export function generateStaticParams() {
  return ALL_ARTICLES.map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const ctx = getArticleContext(slug)
  if (!ctx) return { title: 'Forke Docs' }
  const { article, section } = ctx

  const topics = article.toc.map((t) => t.label).slice(0, 4).join(', ')
  const description = `${article.description} Part of the "${section.label}" section of the Forke developer bounty marketplace documentation${
    topics ? `. Covers: ${topics}.` : '.'
  }`

  return {
    title: article.title,
    description,
    keywords: [
      `forke ${article.title.toLowerCase()}`,
      'forke docs',
      section.label.toLowerCase(),
      'developer bounty marketplace',
    ],
    alternates: { canonical: `/docs/${article.slug}` },
    openGraph: buildOpenGraph({
      title: `${article.title} - Forke Docs`,
      description,
      url: `https://www.forke.space/docs/${article.slug}`,
      type: 'article',
    }),
    twitter: buildTwitter({
      title: `${article.title} - Forke Docs`,
      description,
    }),
  }
}

export default async function DocArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const ctx = getArticleContext(slug)
  if (!ctx) notFound()
  const { article, section, prev, next } = ctx
  const markdown = getArticleMarkdown(slug) ?? ''
  const session = await auth()
  const Icon = article.icon

  return (
    <DocsShell
      breadcrumb={[{ label: section.label }, { label: article.title }]}
      copy={{ markdown, viewHref: `/docs/${article.slug}/raw` }}
      isLoggedIn={Boolean(session?.user)}
    >
      <div className="mx-auto flex max-w-6xl gap-12 px-5 py-8 md:px-10 md:py-12">
        {/* Article content */}
        <article className="min-w-0 flex-1 max-w-3xl">
          {/* Subtle breadcrumbs */}
          <div className="flex items-center gap-1.5 font-mono text-[12px] text-white/45 mb-6">
            <Link href="/docs" className="hover:text-white transition-colors">
              Docs
            </Link>
            <ChevronRight className="h-3 w-3 text-white/20" />
            <span className="text-accent/80 font-medium">{section.label}</span>
            <ChevronRight className="h-3 w-3 text-white/20" />
            <span className="text-white/80 font-medium truncate">{article.title}</span>
          </div>

          <ArticleKeyboardNav prevSlug={prev?.slug} nextSlug={next?.slug} />

          <header className="mb-8 border-b border-white/[0.08] pb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/25 bg-accent/[0.08] text-accent">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-accent font-semibold">
                  {section.label}
                </p>
              </div>

              {/* Feature B: Read Time Header Badge */}
              {article.readTime && (
                <div className="flex items-center gap-2 font-mono text-[11px] text-white/45">
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5">
                    {article.readTime}
                  </span>
                </div>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-medium tracking-tight text-white md:text-[2.5rem] md:leading-[1.15]">
              {article.title}
            </h1>
          </header>

          {/* Article Body */}
          {article.body}

          {/* Connected Prev / Next Navigation with Feature C Keyboard Hints */}
          <nav className="mt-16 grid gap-4 border-t border-white/[0.08] pt-8 sm:grid-cols-2">
            {prev ? (
              <Link
                href={`/docs/${prev.slug}`}
                className="group flex flex-col rounded-xl border border-white/[0.08] bg-[#070709] p-4 transition-all duration-150 hover:border-accent/40 hover:bg-white/[0.02]"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-white/35 group-hover:text-accent">
                    <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" /> Previous
                  </span>
                  <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-white/35">
                    [
                  </kbd>
                </div>
                <span className="mt-1 text-[15px] font-medium text-white/90 group-hover:text-white">
                  {prev.title}
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/docs/${next.slug}`}
                className="group flex flex-col items-end rounded-xl border border-white/[0.08] bg-[#070709] p-4 text-right transition-all duration-150 hover:border-accent/40 hover:bg-white/[0.02]"
              >
                <div className="flex w-full items-center justify-between">
                  <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-white/35">
                    ]
                  </kbd>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-white/35 group-hover:text-accent">
                    Next <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
                <span className="mt-1 text-[15px] font-medium text-white/90 group-hover:text-white">
                  {next.title}
                </span>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </article>

        {/* Right rail TOC */}
        <aside className="hidden w-56 shrink-0 xl:block">
          <DocToc items={article.toc} />
        </aside>
      </div>
    </DocsShell>
  )
}
