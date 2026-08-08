'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, ArrowRight, CornerDownLeft, Sparkles } from 'lucide-react'
import { SECTIONS, ALL_ARTICLES, POPULAR_ARTICLES, type Article } from './content'
import { cn } from '@/lib/utils/cn'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Reset query & selection when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Filtered articles with section headers
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []

    const matched: { article: Article; sectionLabel: string; matchType?: string }[] = []

    SECTIONS.forEach((section) => {
      section.articles.forEach((article) => {
        const titleMatch = article.title.toLowerCase().includes(q)
        const descMatch = article.description.toLowerCase().includes(q)
        const tocMatch = article.toc.some((t) => t.label.toLowerCase().includes(q))

        if (titleMatch || descMatch || tocMatch) {
          let matchType = 'title'
          if (!titleMatch && descMatch) matchType = 'description'
          if (!titleMatch && !descMatch && tocMatch) matchType = 'heading'

          matched.push({
            article,
            sectionLabel: section.label,
            matchType,
          })
        }
      })
    })

    return matched
  }, [query])

  // Reset active index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results, query])

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const activeEl = listRef.current.querySelector('[data-selected="true"]')
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const handleSelect = (slug: string) => {
    onClose()
    router.push(`/docs/${slug}`)
  }

  // Keyboard navigation inside modal
  useEffect(() => {
    if (!isOpen) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      const totalItems = query.trim() ? results.length : POPULAR_ARTICLES.length
      if (totalItems === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % totalItems)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (query.trim() && results[selectedIndex]) {
          handleSelect(results[selectedIndex].article.slug)
        } else if (!query.trim() && POPULAR_ARTICLES[selectedIndex]) {
          handleSelect(POPULAR_ARTICLES[selectedIndex].slug)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, results, selectedIndex, query, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Dialog container */}
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/[0.12] bg-[#09090b] shadow-2xl shadow-black/80 animate-in zoom-in-95 duration-150">
        {/* Input Bar */}
        <div className="relative flex items-center border-b border-white/[0.08] px-4 py-3.5">
          <Search className="h-5 w-5 shrink-0 text-white/40" strokeWidth={1.8} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documentation..."
            className="w-full bg-transparent pl-3 pr-8 text-[15px] font-medium text-white placeholder:text-white/35 focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="rounded-md p-1 text-white/40 hover:bg-white/[0.06] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center rounded border border-white/[0.12] bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-white/40">
              ESC
            </kbd>
          )}
        </div>

        {/* Results / Suggestions List */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2 docs-scroll">
          {query.trim() ? (
            results.length > 0 ? (
              <div className="space-y-1">
                <div className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-white/40">
                  Search Results ({results.length})
                </div>
                {results.map(({ article, sectionLabel }, idx) => {
                  const isSelected = idx === selectedIndex
                  const Icon = article.icon

                  return (
                    <button
                      key={article.slug}
                      data-selected={isSelected}
                      onClick={() => handleSelect(article.slug)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left transition-all duration-150',
                        isSelected
                          ? 'bg-accent/[0.1] border border-accent/30 text-white'
                          : 'border border-transparent hover:bg-white/[0.03] text-white/80'
                      )}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
                            isSelected
                              ? 'border-accent/40 bg-accent/20 text-accent'
                              : 'border-white/[0.08] bg-white/[0.04] text-white/50'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[14.5px] font-medium text-white">
                              {article.title}
                            </span>
                            <span className="font-mono text-[10px] uppercase tracking-wider text-accent/80 border border-accent/20 rounded px-1.5 py-0.2">
                              {sectionLabel}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[13px] text-white/45">
                            {article.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <ArrowRight
                          className={cn(
                            'h-4 w-4 transition-all duration-150',
                            isSelected
                              ? 'text-accent opacity-100 translate-x-0'
                              : 'opacity-0 -translate-x-1'
                          )}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-[14px] text-white/50">
                  No documentation matching &ldquo;<span className="text-white">{query}</span>&rdquo;
                </p>
                <p className="mt-1 text-[12px] text-white/35">
                  Try searching for terms like &ldquo;PR&rdquo;, &ldquo;Escrow&rdquo;, or &ldquo;XP&rdquo;
                </p>
              </div>
            )
          ) : (
            <div>
              <div className="flex items-center justify-between px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-white/40">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-accent" /> Popular documentation
                </span>
                <span>Quick links</span>
              </div>
              <div className="space-y-1 mt-1">
                {POPULAR_ARTICLES.map((article, idx) => {
                  const isSelected = idx === selectedIndex
                  const Icon = article.icon

                  return (
                    <button
                      key={article.slug}
                      data-selected={isSelected}
                      onClick={() => handleSelect(article.slug)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition-all duration-150',
                        isSelected
                          ? 'bg-white/[0.06] border border-white/[0.12] text-white'
                          : 'border border-transparent hover:bg-white/[0.03] text-white/70'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={cn(
                            'h-4 w-4 shrink-0',
                            isSelected ? 'text-accent' : 'text-white/40'
                          )}
                        />
                        <div className="min-w-0">
                          <div className="text-[14px] font-medium text-white">{article.title}</div>
                          <div className="truncate text-[12px] text-white/40">
                            {article.description}
                          </div>
                        </div>
                      </div>
                      <ArrowRight
                        className={cn(
                          'h-3.5 w-3.5 text-white/40 transition-transform',
                          isSelected && 'text-accent translate-x-0.5'
                        )}
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer shortcuts info */}
        <div className="flex items-center justify-between border-t border-white/[0.08] bg-[#070709] px-4 py-2.5 text-[12px] text-white/40 font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[10px]">
                ↑
              </kbd>
              <kbd className="rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[10px]">
                ↓
              </kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" />
              <span>select</span>
            </span>
          </div>
          <div>
            <span className="text-accent/80 font-sans font-medium">Forke Docs</span>
          </div>
        </div>
      </div>
    </div>
  )
}
