'use client'

import React, {
  useState,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, Search, Menu, X, ArrowLeft } from 'lucide-react'
import { useWaitlisterView } from '@/components/landing/useWaitlisterView'
import { SECTIONS } from './content'
import { cn } from '@/lib/utils/cn'
import CopyPageButton from './CopyPageButton'
import SearchModal from './SearchModal'

/**
 * Modern developer documentation shell inspired by Linear Docs visual restraint
 * and GitHub Docs information architecture.
 */

const NAV_STATE_KEY = 'forke-docs-nav-open'

const EMPTY_STATE: Record<string, boolean> = {}

const navStore = (() => {
  const listeners = new Set<() => void>()
  let cache: Record<string, boolean> = EMPTY_STATE

  function read(): Record<string, boolean> {
    if (typeof window === 'undefined') return EMPTY_STATE
    try {
      const raw = sessionStorage.getItem(NAV_STATE_KEY)
      const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : EMPTY_STATE
      if (JSON.stringify(parsed) !== JSON.stringify(cache)) cache = parsed
      return cache
    } catch {
      return cache
    }
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: read,
    getServerSnapshot: () => EMPTY_STATE,
    set(id: string, open: boolean) {
      if (typeof window === 'undefined') return
      try {
        const next = { ...read(), [id]: open }
        sessionStorage.setItem(NAV_STATE_KEY, JSON.stringify(next))
        cache = next
      } catch {
        /* storage unavailable — degrade gracefully */
      }
      listeners.forEach((l) => l())
    },
  }
})()

function useActiveSlug() {
  const pathname = usePathname()
  const parts = pathname.split('/').filter(Boolean)
  return parts[0] === 'docs' ? parts[1] ?? null : null
}

function Sidebar({
  onNavigate,
  onOpenSearch,
}: {
  onNavigate?: () => void
  onOpenSearch: () => void
}) {
  const activeSlug = useActiveSlug()

  return (
    <div className="flex h-full flex-col">
      {/* Brand — logo (→ home) · divider · Docs (→ /docs) */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <Link
          href="/"
          onClick={onNavigate}
          aria-label="Forke home"
          className="shrink-0 transition-opacity hover:opacity-80 text-xl font-semibold tracking-[-0.04em] text-white"
        >
          forke<span className="text-accent">*</span>
        </Link>
        <span aria-hidden className="h-5 w-px bg-white/[0.12]" />
        <Link
          href="/docs"
          onClick={onNavigate}
          className="text-[16px] font-medium tracking-[-0.01em] text-white transition-colors hover:text-white/80"
        >
          Docs
        </Link>
      </div>

      {/* Command Search Trigger */}
      <div className="px-4 py-2">
        <button
          onClick={onOpenSearch}
          className="flex w-full items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 px-3 text-[13px] text-white/40 transition-colors hover:border-white/[0.16] hover:bg-white/[0.05] hover:text-white/70"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-white/40" />
            <span>Search docs...</span>
          </div>
          <kbd className="rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-white/40">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Nav Sections */}
      <nav className="mt-3 flex-1 overflow-y-auto px-3 pb-8 docs-scroll space-y-2">
        {SECTIONS.map((section) => (
          <NavGroup
            key={section.id}
            section={section}
            activeSlug={activeSlug}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {/* Footer link back to main platform */}
      <div className="border-t border-white/[0.06] px-4 py-3.5">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2 font-mono text-[12px] text-white/45 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Forke App
        </Link>
      </div>
    </div>
  )
}

function NavGroup({
  section,
  activeSlug,
  onNavigate,
}: {
  section: (typeof SECTIONS)[number]
  activeSlug: string | null
  onNavigate?: () => void
}) {
  const containsActive = section.articles.some((a) => a.slug === activeSlug)
  const fallbackOpen = Boolean(section.defaultOpen) || containsActive

  const saved = useSyncExternalStore(
    navStore.subscribe,
    navStore.getSnapshot,
    navStore.getServerSnapshot
  )
  const hasSaved = Object.prototype.hasOwnProperty.call(saved, section.id)
  const open = containsActive ? true : hasSaved ? saved[section.id] : fallbackOpen

  const [animate, setAnimate] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const toggle = useCallback(() => {
    navStore.set(section.id, !open)
  }, [section.id, open])

  return (
    <div>
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.03] group"
      >
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.09em] text-white/40 group-hover:text-white/60">
          {section.label}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-white/30 transition-transform duration-200',
            open ? '' : '-rotate-90'
          )}
        />
      </button>
      <div
        className={cn(
          'grid',
          animate && 'transition-all duration-200',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <ul className="space-y-0.5 py-1 pl-1">
            {section.articles.map((a) => {
              const Icon = a.icon
              const active = a.slug === activeSlug
              return (
                <li key={a.slug}>
                  <Link
                    href={`/docs/${a.slug}`}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] transition-all duration-150',
                      active
                        ? 'border-l-2 border-accent bg-accent/[0.08] text-white font-medium pl-2'
                        : 'text-white/55 hover:bg-white/[0.03] hover:text-white/90'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        active ? 'text-accent' : 'text-white/35'
                      )}
                    />
                    <span className="truncate">{a.title}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function DocsShell({
  breadcrumb,
  copy,
  isLoggedIn = false,
  children,
}: {
  breadcrumb?: { label: string; href?: string }[]
  copy?: { markdown: string; viewHref: string }
  isLoggedIn?: boolean
  children: React.ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const showWaitlisterView = useWaitlisterView()

  // Cmd/Ctrl+K keyboard listener
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setMobileOpen(false)
        setSearchOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-accent selection:text-white">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-white/[0.06] bg-[#070708] lg:block">
        <Sidebar onOpenSearch={() => setSearchOpen(true)} />
      </aside>

      {/* Mobile Drawer */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden transition-all duration-300 ease-in-out',
          mobileOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
        )}
      >
        <div
          className={cn(
            'absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ease-in-out',
            mobileOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={cn(
            'absolute inset-y-0 left-0 w-72 border-r border-white/[0.08] bg-[#070708] transition-transform duration-300 ease-out',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute right-3 top-5 z-10 rounded-lg p-1.5 text-white/50 hover:bg-white/[0.06]"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
          <Sidebar
            onNavigate={() => setMobileOpen(false)}
            onOpenSearch={() => {
              setMobileOpen(false)
              setSearchOpen(true)
            }}
          />
        </div>
      </div>

      <div className="lg:pl-72">
        {/* Top Header */}
        <header className="fixed inset-x-0 top-0 z-20 border-b border-white/[0.06] bg-[#050505]/85 backdrop-blur-xl lg:left-72">
          <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-8">
            {/* Left: Mobile trigger & Breadcrumb */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setMobileOpen(true)}
                className="rounded-lg p-1.5 text-white/60 hover:bg-white/[0.06] lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Breadcrumb - Desktop */}
              <nav className="hidden lg:flex min-w-0 items-center gap-2 text-[13px]">
                <Link
                  href="/docs"
                  className="shrink-0 font-medium text-white/50 transition-colors hover:text-white"
                >
                  Docs
                </Link>
                {breadcrumb?.map((b) => (
                  <React.Fragment key={b.label}>
                    <span className="text-white/20">/</span>
                    {b.href ? (
                      <Link
                        href={b.href}
                        className="shrink-0 text-white/50 transition-colors hover:text-white"
                      >
                        {b.label}
                      </Link>
                    ) : (
                      <span className="truncate text-white/90 font-medium">{b.label}</span>
                    )}
                  </React.Fragment>
                ))}
              </nav>

              {/* Active Heading - Mobile */}
              <div className="flex lg:hidden min-w-0 items-center text-[14px] font-semibold text-white truncate">
                {breadcrumb && breadcrumb.length > 0
                  ? breadcrumb[breadcrumb.length - 1].label
                  : 'Docs'}
              </div>
            </div>

            {/* Right cluster */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Top search trigger button */}
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden sm:flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12.5px] text-white/50 transition-colors hover:border-white/[0.16] hover:text-white"
              >
                <Search className="h-3.5 w-3.5 text-white/40" />
                <span>Search</span>
                <kbd className="rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.2 font-mono text-[10px] text-white/40">
                  ⌘K
                </kbd>
              </button>

              {/* Copy page split button */}
              {copy && <CopyPageButton markdown={copy.markdown} viewHref={copy.viewHref} />}

              {/* Auth CTA */}
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="rounded-lg bg-white px-3.5 py-1.5 text-[13px] font-semibold tracking-tight text-[#0a0a0a] transition-colors hover:bg-white/90"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  href={showWaitlisterView ? '/waitlist' : '/signin'}
                  className="rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold tracking-tight text-[#0a0a0a] transition-colors hover:bg-accent-hover"
                >
                  {showWaitlisterView ? 'Join waitlist' : 'Sign up'}
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Content Container */}
        <div className="pt-14">{children}</div>
      </div>

      {/* Global Command Search Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
