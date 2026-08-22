import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, Clock, Users } from 'lucide-react'
import Navbar from '@/components/shared/Navbar'
import Footer from '@/components/shared/Footer'
import { getPublishedBlogBySlug, getPublishedBlogs, getBlogViewCount } from '@/lib/blog-actions'
import { instrumentSerif } from '@/app/fonts'
import RelatedArticles, { type RelatedCard } from './RelatedArticles'
import BlogViewTracker from './BlogViewTracker'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

/**
 * Trim a description to a social-preview-friendly length. Google truncates
 * around 150–160 chars and most social cards show ~125, so we cap at 155 and
 * cut on a word boundary with an ellipsis rather than mid-word.
 */
function truncateDescription(text: string | null | undefined, max = 155): string | undefined {
  if (!text) return undefined
  const clean = text.trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:!\-\s]+$/, '')}…`
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const post = await getPublishedBlogBySlug(slug)
  if (!post) return { title: 'Post not found' }
  const url = `https://www.forke.space/blogs/${post.slug}`
  const description = truncateDescription(post.excerpt)
  return {
    title: post.title,
    description,
    alternates: { canonical: `/blogs/${post.slug}` },
    openGraph: {
      title: post.title,
      description,
      url,
      type: 'article',
      // Next.js replaces (not deep-merges) the parent openGraph block, so the
      // root layout's siteName would be dropped here unless we re-declare it.
      siteName: 'Forke',
      images: post.coverImage
        ? [{ url: post.coverImage, width: 1200, height: 630, alt: post.title }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: post.coverImage ? [post.coverImage] : undefined,
    },
  }
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params
  const post = await getPublishedBlogBySlug(slug)
  if (!post) notFound()

  // Independent of each other — fetch concurrently.
  const [viewCount, publishedBlogs] = await Promise.all([
    getBlogViewCount(post.id),
    getPublishedBlogs(),
  ])

  // Recent posts for the "You may also like these" section — exclude the
  // current post and cap at three (already ordered newest-first).
  const related: RelatedCard[] = publishedBlogs
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3)
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      coverImage: p.coverImage,
      authorName: p.authorName,
      readingMinutes: p.readingMinutes,
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    }))

  return (
    <div className="min-h-screen bg-bg text-white">
      <BlogViewTracker slug={slug} />
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-28 sm:px-6">
        <Link
          href="/blogs"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> All posts
        </Link>

        <article>
          <h1 className={`${instrumentSerif.className} text-4xl leading-tight text-white sm:text-5xl`}>
            {post.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-muted)]">
            {post.authorName && <span>{post.authorName}</span>}
            <span className="inline-flex items-center gap-1 font-mono">
              <Clock className="h-3 w-3" /> {post.readingMinutes} min read
            </span>
            {post.publishedAt && (
              <span className="font-mono">
                {new Date(post.publishedAt).toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
            <span className="inline-flex items-center gap-1 font-mono">
              <Users className="h-3 w-3" />
              {viewCount.toLocaleString()} {viewCount === 1 ? 'reader' : 'readers'}
            </span>
          </div>

          {post.coverImage && (
            <div className="mt-8 overflow-hidden rounded-xl border border-[var(--color-border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.coverImage} alt={post.title} className="block h-auto w-full" />
            </div>
          )}

          {/* Stored Tiptap HTML — same .blog-prose styles as the editor. */}
          <div
            className="blog-prose mt-10"
            dangerouslySetInnerHTML={{ __html: post.contentHtml || '' }}
          />
        </article>
      </main>
      <RelatedArticles posts={related} />
      <Footer />
    </div>
  )
}
