/**
 * Forke transactional email system.
 *
 * Design language mirrors the marketing site's "ledger" aesthetic:
 *  - dark canvas (#050505) with a single hairline-bordered card (#0A0A0B)
 *  - the `forke*` wordmark (lowercase, accent asterisk) instead of a heavy logo lockup
 *  - a mono eyebrow (NN ── LABEL) marking each message, like the site's <Eyebrow>
 *  - headings in Geist/system sans-medium with one serif-italic accent word
 *  - flat, refined buttons (no 3D drop-shadow / chunky uppercase) — felt, not shouted
 *  - accent #FF7A00, muted body copy, generous spacing
 *
 * All markup is inline-styled table HTML for broad email-client support. Web fonts
 * aren't reliable in email, so we use a system sans stack for UI/body and Georgia
 * as the serif stand-in for Instrument Serif's editorial italics.
 */

// ----------------------------------------------------------------------------
// Brand tokens (inlined everywhere — email clients ignore <style>/variables)
// ----------------------------------------------------------------------------
const BRAND = {
  accent: '#FF7A00',
  accentDeep: '#E66E00',
  canvas: '#050505',
  card: '#0A0A0B',
  cardSoft: '#0E0E10',
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.05)',
  textHigh: '#F5F5F7',
  textBody: 'rgba(255,255,255,0.55)',
  textMuted: 'rgba(255,255,255,0.40)',
  textFaint: 'rgba(255,255,255,0.28)',
  sans: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  serif: "Georgia,'Times New Roman',serif",
  mono: "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace",
  baseUrl: 'https://www.forke.space',
}

// ----------------------------------------------------------------------------
// Reusable markup primitives
// ----------------------------------------------------------------------------

/** The `forke*` wordmark — lowercase, tight tracking, accent asterisk. */
function wordmark(size = 22): string {
  return `<span style="font-family:${BRAND.sans};font-size:${size}px;font-weight:600;letter-spacing:-0.04em;color:${BRAND.textHigh};line-height:1;">forke<span style="color:${BRAND.accent};">*</span></span>`
}

/** Section heading: sans-medium with one serif-italic accent word/clause. */
function heading(lead: string, accent: string, size = 30): string {
  return `
    <h1 style="font-family:${BRAND.sans};font-size:${size}px;font-weight:500;letter-spacing:-0.035em;line-height:1.1;color:${BRAND.textHigh};margin:0 0 18px 0;">
      ${lead} <span style="font-family:${BRAND.serif};font-style:italic;font-weight:400;color:${BRAND.accent};letter-spacing:0;">${accent}</span>
    </h1>
  `
}

/** Body paragraph. */
function p(text: string, mb = 18): string {
  return `<p style="font-family:${BRAND.sans};font-size:15px;line-height:1.7;color:${BRAND.textBody};margin:0 0 ${mb}px 0;font-weight:400;">${text}</p>`
}

/** Flat, refined primary button (filled accent). */
function buttonPrimary(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 4px 0;">
      <tr>
        <td align="center" style="border-radius:10px;background:${BRAND.accent};">
          <a href="${href}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${BRAND.sans};font-size:14px;font-weight:600;letter-spacing:-0.01em;color:#0A0A0B;text-decoration:none;border-radius:10px;white-space:nowrap;">${label}&nbsp;&rarr;</a>
        </td>
      </tr>
    </table>
  `
}

/** Flat, refined secondary button (hairline outline). */
function buttonGhost(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 4px 0;">
      <tr>
        <td align="center" style="border-radius:10px;border:1px solid ${BRAND.hairline};background:rgba(255,255,255,0.02);">
          <a href="${href}" target="_blank" style="display:inline-block;padding:12px 24px;font-family:${BRAND.sans};font-size:14px;font-weight:500;letter-spacing:-0.01em;color:${BRAND.textHigh};text-decoration:none;border-radius:10px;white-space:nowrap;">${label}</a>
        </td>
      </tr>
    </table>
  `
}

/** Subtle "paste this link" fallback line under a button. */
function fallbackLink(href: string): string {
  return `<p style="font-family:${BRAND.sans};font-size:12px;line-height:1.7;color:${BRAND.textFaint};margin:14px 0 0 0;font-weight:400;">Button not working? Paste this into your browser:<br><a href="${href}" style="color:${BRAND.accent};text-decoration:none;word-break:break-all;">${href}</a></p>`
}

/** An accent-tinted callout box (used for reasons, key facts). */
function calloutBox(label: string, body: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px 0;">
      <tr>
        <td style="background:rgba(255,122,0,0.04);border:1px solid rgba(255,122,0,0.18);border-radius:12px;padding:16px 18px;">
          <p style="font-family:${BRAND.mono};font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.14em;color:${BRAND.accent};margin:0 0 8px 0;">${label}</p>
          <p style="font-family:${BRAND.sans};font-size:14px;line-height:1.65;color:rgba(255,255,255,0.72);margin:0;font-weight:400;">${body}</p>
        </td>
      </tr>
    </table>
  `
}

/** A row of feature "pills" (ledger chips). `items` is an array of labels. */
function featurePills(items: string[]): string {
  const cells = items
    .map(
      (item) => `
      <!--[if mso]></td><td style="padding:0 4px;"><![endif]-->
      <div style="display:inline-block;background:rgba(255,255,255,0.02);border:1px solid ${BRAND.hairline};border-radius:999px;padding:7px 14px;margin:4px;font-family:${BRAND.sans};font-size:12px;font-weight:500;color:rgba(255,255,255,0.6);">
        <span style="color:${BRAND.accent};font-weight:700;">+</span>&nbsp; ${item}
      </div>`
    )
    .join('')
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="left" style="margin:4px 0 28px 0;">
      <tr><td align="left" style="font-size:0;">
        <!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 4px;"><![endif]-->
        ${cells}
        <!--[if mso]></td></tr></table><![endif]-->
      </td></tr>
    </table>
  `
}

/** A thin hairline divider. */
function divider(mt = 8, mb = 24): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:${mt}px 0 ${mb}px 0;"><tr><td style="height:1px;background:${BRAND.hairlineSoft};font-size:0;line-height:0;">&nbsp;</td></tr></table>`
}

/**
 * The shared email shell — dark canvas, single hairline card, optional banner,
 * wordmark header bar, slot for body, and a consistent footer.
 */
function emailShell(opts: {
  title: string
  preheader?: string
  banner?: string
  bodyHtml: string
  footerLabel: string
  /** Optional extra <style> injected into <head> (progressive-enhancement only). */
  headStyle?: string
  /** Optional HTML appended in the footer (e.g. an unsubscribe line for broadcasts). */
  footerExtra?: string
  /** When true, the body cell carries no padding — bodyHtml manages its own edge
   *  spacing and full-bleed dividers (used by the newsletter layout). */
  fullBleedBody?: boolean
  /** Card max-width in px. Real sends use the email standard (600). The /email
   *  preview passes a wider value so the email fills the laptop frame. */
  maxWidth?: number
  /** Recent blogs to display at the bottom of the email. */
  recentPosts?: BlogEmailRecent[]
}): string {
  const cardW = opts.maxWidth ?? 600
  const bannerRow = opts.banner
    ? `<tr><td align="center" style="padding:0;line-height:0;font-size:0;">
         <img src="${BRAND.baseUrl}/forke-assets/email-banners/${opts.banner}" alt="Forke" width="${cardW}" style="width:100%;max-width:${cardW}px;height:auto;display:block;border-bottom:1px solid ${BRAND.hairlineSoft};" />
       </td></tr>`
    : ''

  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${opts.preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
    : ''

  const pad = opts.fullBleedBody ? '36px' : '32px'
  const recent = (opts.recentPosts || []).slice(0, 3)
  const recentRows = recent.length
    ? `
      <tr><td style="padding:0 ${pad};"><div style="height:1px;background:${BRAND.hairlineSoft};"></div></td></tr>
      <tr><td style="padding:32px ${pad} 14px ${pad};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
          <tr>
            <td style="font-family:${BRAND.sans};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${BRAND.textMuted};padding-right:12px;">Latest from the blog</td>
            <td><div style="width:60px;height:1px;background:${BRAND.hairlineSoft};"></div></td>
          </tr>
        </table>
        ${recent.map((r, i) => blogRecentRow(r, i % 2 === 1)).join('')}
      </td></tr>`
    : ''

  const socialsRow = `
    <tr><td style="padding:18px ${pad} 24px ${pad};border-top:1px solid ${BRAND.hairlineSoft};">
      <p style="font-family:${BRAND.mono};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.textMuted};margin:0 0 14px;">Follow along</p>
      ${blogSocials()}
    </td></tr>
  `

  const combinedStyle = `
    @media only screen and (max-width: 480px) {
      .nrow { direction: ltr !important; }
      .nrow .ncol { display: block !important; width: 100% !important; min-width: 0 !important; }
      .nrow .nthumb { margin-bottom: 12px !important; }
      .nrow .ngap { display: none !important; }
    }
    ${opts.headStyle || ''}
  `

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark only">
    <meta name="supported-color-schemes" content="dark">
    <title>${opts.title}</title>
    <!--[if mso]><style>table,td,a{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
    <style>${combinedStyle}</style>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.canvas};-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;">
    ${preheader}
    <!-- "Glow Halo" canvas: a soft orange radial glow blooms from the top, behind the card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.canvas};background-image:radial-gradient(circle at 50% 6%, rgba(255,122,0,0.18) 0%, rgba(5,5,5,0) 52%);">
      <tr>
        <td align="center" style="padding:52px 16px;">
          <table role="presentation" width="${cardW}" cellpadding="0" cellspacing="0" border="0" style="max-width:${cardW}px;width:100%;background:${BRAND.card};border:1px solid rgba(255,122,0,0.16);border-radius:24px;overflow:hidden;box-shadow:0 0 80px rgba(255,122,0,0.07);">

            <!-- Header bar: wordmark + tiny mono tag -->
            <tr>
              <td style="padding:22px 32px;border-bottom:1px solid ${BRAND.hairlineSoft};">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">${wordmark(22)}</td>
                    <td align="right" style="vertical-align:middle;font-family:${BRAND.mono};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.textFaint};">prove skill by shipping</td>
                  </tr>
                </table>
              </td>
            </tr>

            ${bannerRow}

            <!-- Body -->
            <tr>
              <td style="padding:${opts.fullBleedBody ? '0' : '40px 32px 36px 32px'};">
                ${opts.bodyHtml}
              </td>
            </tr>

            ${recentRows}
            ${socialsRow}

            <!-- Footer -->
            <tr>
              <td style="padding:24px 32px 30px 32px;border-top:1px solid ${BRAND.hairlineSoft};">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="left" style="vertical-align:top;">
                      ${wordmark(16)}
                      <p style="font-family:${BRAND.sans};font-size:12px;line-height:1.6;color:${BRAND.textFaint};margin:8px 0 0 0;">
                        The micro-task marketplace for developers.<br>
                        <a href="mailto:support@forke.space" style="color:${BRAND.textMuted};text-decoration:none;">support@forke.space</a>
                      </p>
                    </td>
                  </tr>
                </table>
                <p style="font-family:${BRAND.mono};font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.22em;color:rgba(255,255,255,0.20);margin:22px 0 0 0;">
                  &copy; 2026 Forke &nbsp;&middot;&nbsp; ${opts.footerLabel}
                </p>
                ${opts.footerExtra ?? ''}
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

// ----------------------------------------------------------------------------
// Resend transport helpers (quote-stripping kept identical to before)
// ----------------------------------------------------------------------------

function resolveResendApiKey(): string {
  let apiKey = process.env.RESEND_API_KEY || ''
  if (apiKey.startsWith('"') && apiKey.endsWith('"')) apiKey = apiKey.slice(1, -1)
  if (apiKey.startsWith("'") && apiKey.endsWith("'")) apiKey = apiKey.slice(1, -1)
  return apiKey
}

function resolveFromEmail(): string {
  let fromEmail = process.env.WAITLIST_EMAIL_FROM || 'Forke <onboarding@resend.dev>'
  if (fromEmail.startsWith('"') && fromEmail.endsWith('"')) fromEmail = fromEmail.slice(1, -1)
  if (fromEmail.startsWith("'") && fromEmail.endsWith("'")) fromEmail = fromEmail.slice(1, -1)
  return fromEmail
}

function resolveBaseUrl(): string {
  let baseUrl = process.env.AUTH_URL || 'https://www.forke.space'
  if (baseUrl.startsWith('"') && baseUrl.endsWith('"')) baseUrl = baseUrl.slice(1, -1)
  if (baseUrl.startsWith("'") && baseUrl.endsWith("'")) baseUrl = baseUrl.slice(1, -1)
  return baseUrl.replace(/\/$/, '')
}

/**
 * Posts an email through Resend. Fail-soft: logs and returns false, never throws,
 * so a Resend outage can never block the underlying action.
 */
/**
 * Low-level single send. Returns a structured result so callers can tell a
 * transient failure (429 / 5xx — worth retrying) from a permanent one.
 */
async function sendResendEmailResult(
  toEmail: string,
  subject: string,
  html: string,
  label: string,
  fromEmail?: string
): Promise<{ ok: boolean; retryable: boolean; retryAfterMs?: number }> {
  const apiKey = resolveResendApiKey()
  if (!apiKey) {
    console.warn(`⚠️ RESEND_API_KEY is not configured. Skipping ${label} email.`)
    return { ok: false, retryable: false }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail || resolveFromEmail(),
        to: toEmail,
        reply_to: 'support@forke.space',
        subject,
        html,
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      console.error(`Failed to send ${label} email via Resend (${res.status}):`, errText)
      // 429 (rate limit) and 5xx are transient — safe to retry.
      const retryable = res.status === 429 || res.status >= 500
      const retryHeader = res.headers.get('retry-after')
      const retryAfterMs = retryHeader ? Number(retryHeader) * 1000 : undefined
      return { ok: false, retryable, retryAfterMs }
    }
    return { ok: true, retryable: false }
  } catch (error) {
    console.error(`Error dispatching ${label} email:`, error)
    // Network errors are transient too.
    return { ok: false, retryable: true }
  }
}

async function sendResendEmail(
  toEmail: string,
  subject: string,
  html: string,
  label: string,
  fromEmail?: string
): Promise<boolean> {
  const { ok } = await sendResendEmailResult(toEmail, subject, html, label, fromEmail)
  return ok
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ----------------------------------------------------------------------------
// Email builders — exported so the /email preview page can render them too.
// Each returns the full HTML string for one message.
// ----------------------------------------------------------------------------

export function buildWelcomeEmail(recentPosts?: BlogEmailRecent[], maxWidth?: number): string {
  return emailShell({
    maxWidth,
    recentPosts,
    title: 'Welcome to the Forke Waitlist',
    preheader: 'You’re on the list. Prepare your editor — something big is about to drop.',
    banner: 'main-banner.png',
    footerLabel: 'Waitlist Confirmation',
    bodyHtml: `
      ${heading('You’re on the list.', 'Build the future.')}
      ${p('Thanks for joining early. Forke is the micro-task marketplace where developers claim real bounties, ship real code, and get paid instantly over UPI — no fake projects, no proposals, no waiting.')}
      ${p('We’ll email you the moment your workspace is ready. Until then, prepare your editor.')}
      ${featurePills(['Real-world tasks', 'Verified contributions', 'Instant payouts'])}
      ${buttonPrimary('https://www.linkedin.com/company/forke/', 'Follow along on LinkedIn')}
      ${divider(24, 22)}
      ${p('Questions or feedback? Just reply to this email or reach us at <a href="mailto:support@forke.space" style="color:' + BRAND.accent + ';text-decoration:none;">support@forke.space</a>.', 0)}
    `,
  })
}

export function buildAdminInvitationEmail(name: string, inviteLink: string, recentPosts?: BlogEmailRecent[], maxWidth?: number): string {
  return emailShell({
    maxWidth,
    recentPosts,
    title: 'Forke — Administrative Invitation',
    preheader: 'You’ve been invited to the Forke admin console. Set up your account to get started.',
    banner: 'admin-approval.png',
    footerLabel: 'Secure System Access',
    bodyHtml: `
      ${heading('You’re invited.', 'Access granted.')}
      ${p(`Hello ${name},`)}
      ${p('You’ve been invited to the Forke admin console. As a member, you can configure settings, manage users, and oversee platform operations.')}
      ${p('Set up your secure username and password to activate your session:')}
      ${buttonPrimary(inviteLink, 'Activate admin account')}
      ${fallbackLink(inviteLink)}
    `,
  })
}

export function buildAccountDeletionScheduledEmail(recentPosts?: BlogEmailRecent[], maxWidth?: number): string {
  return emailShell({
    maxWidth,
    recentPosts,
    title: 'Forke — Account Deletion Scheduled',
    preheader: 'Your account is scheduled for deletion in 30 days. Sign back in to cancel.',
    banner: 'main-banner.png',
    footerLabel: 'Account Deletion Schedule',
    bodyHtml: `
      ${heading('Deletion scheduled.', '30 days remaining.')}
      ${p('Hello,')}
      ${p('We received a request to delete your Forke account. Per our security policy, it’s scheduled for permanent deletion in <strong style="color:' + BRAND.textHigh + ';font-weight:600;">30 days</strong>.')}
      ${calloutBox('Changed your mind?', 'Simply sign back in with your usual credentials any time before the window closes — that automatically cancels the deletion.')}
      ${p('No action is needed if you wish to proceed. Your data will be permanently erased after 30 days.', 0)}
    `,
  })
}

export function buildOwnerApprovedEmail(name: string, signInLink: string, recentPosts?: BlogEmailRecent[], maxWidth?: number): string {
  return emailShell({
    maxWidth,
    recentPosts,
    title: 'Forke — Your Owner Account is Approved',
    preheader: 'Your owner application is approved. Your dashboard is ready.',
    banner: 'owner-approved.png',
    footerLabel: 'Owner Access Granted',
    bodyHtml: `
      ${heading('Application approved.', 'Welcome aboard.')}
      ${p(`Hello ${name},`)}
      ${p('Great news — your owner application has been reviewed and <strong style="color:' + BRAND.textHigh + ';font-weight:600;">approved</strong>. You now have full access to the Forke owner dashboard, where you can post tasks, review submissions, and collaborate with developers.')}
      ${buttonPrimary(signInLink, 'Enter owner dashboard')}
      ${fallbackLink(signInLink)}
    `,
  })
}

export function buildOwnerDeclinedEmail(name: string, reason: string, applyLink: string, recentPosts?: BlogEmailRecent[], maxWidth?: number): string {
  const safeReason = (reason || '').trim() || 'Your application did not meet our current onboarding criteria.'
  return emailShell({
    maxWidth,
    recentPosts,
    title: 'Forke — Owner Application Update',
    preheader: 'An update on your Forke owner application.',
    banner: 'owner-rejected.png',
    footerLabel: 'Owner Application Review',
    bodyHtml: `
      ${heading('Application update.', 'You can apply again.')}
      ${p(`Hello ${name},`)}
      ${p('Thank you for your interest in becoming an owner on Forke. After review, we weren’t able to approve your application at this time.')}
      ${calloutBox('Reason', safeReason)}
      ${p('You’re welcome to address the above and re-apply whenever you’re ready — we’d be glad to take another look.')}
      ${buttonGhost(applyLink, 'Apply again')}
      ${fallbackLink(applyLink)}
    `,
  })
}

export function buildBannedEmail(name: string, accountKind: 'owner' | 'developer', reviewLink: string, recentPosts?: BlogEmailRecent[], maxWidth?: number): string {
  return emailShell({
    maxWidth,
    recentPosts,
    title: 'Forke — Account Suspended',
    preheader: 'Your account has been suspended. You can request a review.',
    banner: 'user-ban.png',
    footerLabel: 'Account Suspension Notice',
    bodyHtml: `
      ${heading('Account suspended.', 'You can request a review.')}
      ${p(`Hello ${name},`)}
      ${p(`Your Forke ${accountKind} account has been <strong style="color:${BRAND.textHigh};font-weight:600;">suspended</strong> and access is temporarily restricted. This can follow a policy review or activity that needs further verification.`)}
      ${p('If you believe this was a mistake, submit a request for review below and our team will look into it:')}
      ${buttonPrimary(reviewLink, 'Request a review')}
      ${fallbackLink(reviewLink)}
    `,
  })
}

/**
 * "Forke is live" announcement — broadcast to the waitlist when the site goes
 * public to browse (all pages viewable; the product itself still opens in waves).
 * Mirrors the LinkedIn launch post: open house before the doors open.
 */
export function buildSiteLiveEmail(opts?: { unsubscribe?: boolean; maxWidth?: number; recentPosts?: BlogEmailRecent[] }): string {
  const siteUrl = 'https://www.forke.space/?source=email'
  const waitlistUrl = 'https://www.forke.space/waitlist?source=email'
  const footerExtra = opts?.unsubscribe
    ? `<p style="font-family:${BRAND.sans};font-size:11px;line-height:1.6;color:${BRAND.textFaint};margin:14px 0 0 0;">
         You're receiving this because you joined the Forke waitlist.
         <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:${BRAND.textMuted};text-decoration:underline;">Unsubscribe</a>.
       </p>`
    : ''
  return emailShell({
    maxWidth: opts?.maxWidth,
    recentPosts: opts?.recentPosts,
    title: 'Forke is live',
    preheader: 'The site is live to explore. The product opens in waves — you’re on the list.',
    banner: 'main-banner.png',
    footerLabel: 'Launch Announcement',
    footerExtra,
    bodyHtml: `
      ${heading('The site is live.', 'Come look around.')}
      ${p('Big moment: you can now actually explore Forke. The landing, the blogs, how levels work, what we’re building — all of it is real and public. Go click around.')}
      ${p('What’s <strong style="color:' + BRAND.textHigh + ';font-weight:600;">not</strong> open yet is the part that matters most: claiming bounties, shipping real work, getting paid. That’s still rolling out in waves — and as a waitlister, you’re first in line.')}
      ${calloutBox('Think of it as an open house', 'Doors aren’t fully open yet, but you’re welcome to walk through. Read the blogs, see the vision, and we’ll email you the moment your workspace is ready.')}
      ${buttonPrimary(siteUrl, 'Explore Forke')}
      ${p('Want to make sure you’re set for early access when functionality goes live? Confirm your spot:', 14)}
      ${buttonGhost(waitlistUrl, 'Check your waitlist spot')}
      ${divider(24, 20)}
      ${p('Questions or feedback? Just reply to this email or reach us at <a href="mailto:support@forke.space" style="color:' + BRAND.accent + ';text-decoration:none;">support@forke.space</a>.', 0)}
    `,
  })
}

export interface BlogEmailRecent {
  title: string
  excerpt?: string | null
  coverImage?: string | null
  readingMinutes?: number | null
  url: string
}

export interface BlogEmailData {
  title: string
  excerpt?: string | null
  coverImage?: string | null
  authorName?: string | null
  readingMinutes?: number | null
  publishedAt?: Date | string | null
  url: string
  /** Up to 3 recent posts shown below the featured one, in alternating rows. */
  recentPosts?: BlogEmailRecent[]
  /** Card max-width override (preview only). Real sends use 600. */
  maxWidth?: number
  /**
   * When true, append an unsubscribe footer. Resend's Broadcasts API REQUIRES an
   * unsubscribe link and substitutes the {{{RESEND_UNSUBSCRIBE_URL}}} token at
   * send time. Off for the preview page / any 1:1 use.
   */
  unsubscribe?: boolean
}

function formatBlogDate(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Trim text to ~`max` characters on a word boundary and append a real ellipsis.
 * Email clients can't be trusted with CSS line-clamp, so the blog excerpt is
 * truncated here instead — mirroring the "show a few words then …" behaviour of
 * the blog cards on the site.
 */
function clampText(text: string, max = 140): string {
  const t = text.trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:!?\s]+$/, '') + '…'
}

/**
 * New-blog announcement — echoes the public blog page's featured card: a cover
 * hero, a mono meta row, a serif title, the excerpt, and a "Read more" button.
 *
 * Progressive fade-in: each block is wrapped in a `.fx` class that the <head>
 * <style> starts at opacity:0 and eases to 1 with a staggered delay, the button
 * (`.fx-cta`) revealing last. Clients that strip <style> (Gmail) ignore all of
 * it and render everything visible immediately — so nothing is ever hidden.
 */
/** Hero/thumbnail image for a post (falls back to a serif "F" placeholder). */
function blogImg(src: string | null | undefined, alt: string, href: string, radius = 14): string {
  if (src) {
    return `<a href="${href}" target="_blank" style="text-decoration:none;display:block;line-height:0;"><img src="${src}" alt="${alt}" style="width:100%;height:auto;display:block;border-radius:${radius}px;border:1px solid ${BRAND.hairline};" /></a>`
  }
  return `<a href="${href}" target="_blank" style="text-decoration:none;display:block;line-height:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:${radius}px;border:1px solid ${BRAND.hairline};background:rgba(255,255,255,0.02);"><tr><td align="center" style="height:140px;font-family:${BRAND.serif};font-size:48px;color:rgba(255,255,255,0.10);">F</td></tr></table></a>`
}

/** One alternating "latest" row — image-then-text in source order (so it stacks
 *  photo-on-top on phones); `imgRight` only flips the visual side via dir=rtl. */
function blogRecentRow(r: BlogEmailRecent, imgRight: boolean): string {
  const mins = r.readingMinutes && r.readingMinutes > 0 ? r.readingMinutes : 1
  const thumb = `<div class="ncol nthumb" style="display:inline-block;width:44%;min-width:200px;vertical-align:top;direction:ltr;text-align:left;">${blogImg(r.coverImage, r.title, r.url, 12)}</div>`
  const text = `<div class="ncol ntext" style="display:inline-block;width:52%;min-width:200px;vertical-align:top;direction:ltr;text-align:left;">
      <div style="font-family:${BRAND.mono};font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:${BRAND.accent};margin:0 0 8px;">${mins} min read</div>
      <a href="${r.url}" target="_blank" style="text-decoration:none;"><h3 style="font-family:${BRAND.sans};font-size:17px;font-weight:600;letter-spacing:-0.02em;line-height:1.3;color:${BRAND.textHigh};margin:0 0 8px;">${r.title}</h3></a>
      ${r.excerpt?.trim() ? `<p style="font-family:${BRAND.sans};font-size:13.5px;line-height:1.6;color:${BRAND.textBody};margin:0;">${clampText(r.excerpt, 105)}</p>` : ''}
    </div>`
  const spacer = `<!--[if !mso]><!--><span class="ngap" style="display:inline-block;width:4%;"></span><!--<![endif]-->`
  return `<div class="nrow" style="font-size:0;margin:0 0 24px;direction:${imgRight ? 'rtl' : 'ltr'};">${thumb}${spacer}${text}</div>`
}

/** Footer-style social row: Instagram · LinkedIn · GitHub bordered icon tiles. */
function blogSocials(): string {
  const tile = (href: string, imgSrc: string, alt: string) => {
    return `<td style="padding:0 5px;"><a href="${href}" target="_blank" style="display:inline-block;width:42px;height:42px;border:1px solid ${BRAND.hairline};border-radius:11px;background:rgba(255,255,255,0.02);text-align:center;line-height:42px;text-decoration:none;"><img src="${imgSrc}" width="18" height="18" alt="${alt}" style="vertical-align:middle;border:0;display:inline-block;" /></a></td>`
  }
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="left">
      <tr>
        ${tile('https://www.linkedin.com/company/forke/', 'https://img.icons8.com/ios-glyphs/60/a3a3a3/linkedin.png', 'LinkedIn')}
        ${tile('https://x.com/forkespace', 'https://img.icons8.com/ios-glyphs/60/a3a3a3/twitterx.png', 'X')}
        ${tile('https://www.instagram.com/forke.space/', 'https://img.icons8.com/ios-glyphs/60/a3a3a3/instagram-new.png', 'Instagram')}
        ${tile('https://www.threads.com/@forke.space', 'https://img.icons8.com/ios-filled/60/a3a3a3/threads.png', 'Threads')}
        ${tile('https://www.facebook.com/people/Forke/61591130679350/', 'https://img.icons8.com/ios-glyphs/60/a3a3a3/facebook-new.png', 'Facebook')}
        ${tile('https://github.com/forke-org', 'https://img.icons8.com/ios-glyphs/60/a3a3a3/github.png', 'GitHub')}
      </tr>
    </table>
  `
}

/**
 * New-blog newsletter — Apple-Newsroom featured post (centered kicker, title,
 * hero, excerpt, Read more), then the latest 3 posts in alternating image/text
 * rows (stacking photo-on-top on phones), then a social row.
 */
export function buildBlogEmail(data: BlogEmailData): string {
  const dateStr = formatBlogDate(data.publishedAt)
  const minutes = data.readingMinutes && data.readingMinutes > 0 ? data.readingMinutes : 1

  const metaLine = [dateStr, `${minutes} min read`].filter(Boolean).join(' · ')
  const excerptLine = data.excerpt?.trim()
    ? `<p class="fx fx-3" style="font-family:${BRAND.sans};font-size:15px;line-height:1.7;color:${BRAND.textBody};margin:0 0 12px;">${clampText(data.excerpt, 150)}</p>`
    : ''

  // Staggered fade-in (Apple Mail) for the featured post.
  const headStyle = `
    @media (prefers-reduced-motion: no-preference) {
      .fx { opacity: 0; animation: forkeFade 0.9s ease-out forwards; }
      .fx-1 { animation-delay: 0.05s; }
      .fx-2 { animation-delay: 0.35s; }
      .fx-3 { animation-delay: 0.65s; }
      .fx-cta { opacity: 0; animation: forkeRise 1s ease-out 1.15s forwards; }
    }
    @keyframes forkeFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes forkeRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  `

  // Broadcasts require an unsubscribe link; Resend swaps the token at send time.
  const footerExtra = data.unsubscribe
    ? `<p style="font-family:${BRAND.sans};font-size:11px;line-height:1.6;color:${BRAND.textFaint};margin:14px 0 0 0;">
         You're receiving this because you subscribed to Forke updates.
         <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:${BRAND.textMuted};text-decoration:underline;">Unsubscribe</a>.
       </p>`
    : ''

  return emailShell({
    maxWidth: data.maxWidth,
    title: data.title,
    preheader: data.excerpt?.trim() || `New on the Forke blog: ${data.title}`,
    footerLabel: 'New Blog Post',
    headStyle,
    footerExtra,
    fullBleedBody: true,
    recentPosts: data.recentPosts,
    bodyHtml: `
      <!-- Featured (Apple-Newsroom) -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:34px 44px 24px;text-align:center;">
        <p class="fx fx-1" style="font-family:${BRAND.mono};font-size:10.5px;letter-spacing:0.2em;text-transform:uppercase;color:${BRAND.accent};margin:0 0 16px;">From the Forke blog</p>
        <h1 class="fx fx-1" style="font-family:${BRAND.sans};font-size:29px;font-weight:600;letter-spacing:-0.035em;line-height:1.2;color:${BRAND.textHigh};margin:0;"><a href="${data.url}" target="_blank" style="color:${BRAND.textHigh};text-decoration:none;">${data.title}</a></h1>
      </td></tr>
      <tr><td style="padding:0 24px;line-height:0;font-size:0;"><div class="fx fx-2">${blogImg(data.coverImage, data.title, data.url, 14)}</div></td></tr>
      <tr><td style="padding:24px 44px 34px;text-align:center;">
        ${excerptLine}
        <p class="fx fx-3" style="font-family:${BRAND.mono};font-size:11px;color:${BRAND.textFaint};margin:0 0 22px;">${metaLine}</p>
        <div class="fx-cta">${buttonPrimary(data.url, 'Read more')}</div>
      </td></tr>
      </table>
    `,
  })
}

// ----------------------------------------------------------------------------
// Public senders — signatures, subjects, and from-addresses unchanged.
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// Resend Broadcasts API — for BULK subscriber sends (e.g. blog announcements).
// Unlike the per-recipient /emails endpoint (metered against the daily quota),
// a broadcast goes to a whole audience in one operation, shows up under the
// "Broadcasts" tab, and is the right tool for newsletters. Subscribers live in
// our Postgres `subscribers` table — NOT in Resend — so before sending we sync
// the DB emails into a Resend audience as contacts.
// ----------------------------------------------------------------------------

const RESEND_API = 'https://api.resend.com'

function resolveAudienceId(): string {
  let id = process.env.RESEND_AUDIENCE_ID || ''
  if (id.startsWith('"') && id.endsWith('"')) id = id.slice(1, -1)
  if (id.startsWith("'") && id.endsWith("'")) id = id.slice(1, -1)
  id = id.trim()
  if (id === 'your_resend_audience_id_here') return ''
  return id
}

async function resendFetch(path: string, init: RequestInit, apiKey: string) {
  return fetch(`${RESEND_API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers || {}),
    },
  })
}

async function findAudienceByName(name: string, apiKey: string): Promise<string | null> {
  try {
    const res = await resendFetch('/audiences', { method: 'GET' }, apiKey)
    if (!res.ok) return null
    const json = (await res.json()) as { data?: { id: string; name: string }[] }
    const match = json.data?.find((a) => a.name === name)
    return match?.id ?? null
  } catch {
    return null
  }
}

/** Ensure an audience exists; returns its id. Uses RESEND_AUDIENCE_ID if set. */
async function ensureAudience(apiKey: string): Promise<string | null> {
  const configured = resolveAudienceId()
  if (configured) return configured

  // Try to find an existing audience first
  const existingId = await findAudienceByName('Forke Subscribers', apiKey)
  if (existingId) return existingId

  // No id configured — create a default audience so the flow still works.
  try {
    const res = await resendFetch('/audiences', {
      method: 'POST',
      body: JSON.stringify({ name: 'Forke Subscribers' }),
    }, apiKey)
    if (!res.ok) {
      console.error('Failed to create Resend audience:', await res.text())
      return null
    }
    const json = (await res.json()) as { id?: string }
    console.warn(`Created Resend audience ${json.id}. Set RESEND_AUDIENCE_ID=${json.id} to reuse it.`)
    return json.id ?? null
  } catch (err) {
    console.error('Error creating Resend audience:', err)
    return null
  }
}

/**
 * Sync DB subscriber emails into a Resend audience as contacts. Idempotent:
 * Resend treats re-adding an existing contact as a no-op (we ignore 409/already
 * exists). Paced lightly to be polite to the API.
 */
async function syncContactsToAudience(audienceId: string, emails: string[], apiKey: string): Promise<number> {
  let synced = 0
  for (const email of emails) {
    try {
      const res = await resendFetch(`/audiences/${audienceId}/contacts`, {
        method: 'POST',
        body: JSON.stringify({ email, unsubscribed: false }),
      }, apiKey)
      // 200/201 = created; 409/422 = already a contact — both are fine.
      if (res.ok || res.status === 409 || res.status === 422) synced++
      else console.warn(`Contact sync for ${email} returned ${res.status}:`, await res.text())
    } catch (err) {
      console.warn(`Contact sync threw for ${email}:`, err)
    }
    await sleep(120)
  }
  return synced
}

/**
 * Announce a newly-published blog to every subscriber via Resend's Broadcasts
 * API (one audience send — does NOT burn the per-recipient daily quota). Fully
 * fail-soft: a missing key/audience or a Resend hiccup logs and returns a zero
 * result; it must never block or throw into the blog-publish action.
 *
 * The DB import is lazy so this module stays importable in non-DB contexts
 * (e.g. the email preview page renders builders without ever touching Postgres).
 */
export async function sendBlogPublishedBroadcast(blog: {
  id?: string
  title: string
  slug: string
  excerpt?: string | null
  coverImage?: string | null
  authorName?: string | null
  readingMinutes?: number | null
  publishedAt?: Date | string | null
}): Promise<{ success: boolean; sentCount: number; broadcastId?: string; error?: string }> {
  const apiKey = resolveResendApiKey()
  if (!apiKey) {
    console.warn('⚠️ RESEND_API_KEY is not configured. Skipping blog broadcast.')
    return { success: false, sentCount: 0 }
  }

  // Resolve recipients from our DB (de-duplicated, case-insensitive).
  const emails: string[] = []
  try {
    const { db } = await import('./db')
    const { subscribers } = await import('./db/schema')
    const rows = await db.select({ email: subscribers.email }).from(subscribers)
    const seen = new Set<string>()
    for (const r of rows) {
      const e = r.email?.trim()
      if (!e) continue
      const key = e.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      emails.push(e)
    }
  } catch (err) {
    console.error('Failed to load subscribers for blog broadcast:', err)
    return { success: false, sentCount: 0 }
  }
  if (emails.length === 0) return { success: true, sentCount: 0 }

  // 1) Ensure an audience and 2) sync our subscribers into it as contacts.
  const audienceId = await ensureAudience(apiKey)
  if (!audienceId) return { success: false, sentCount: 0 }
  const synced = await syncContactsToAudience(audienceId, emails, apiKey)

  const baseUrl = resolveBaseUrl()
  const url = `${baseUrl}/blogs/${blog.slug}`

  // Latest 3 OTHER published posts, newest first, for the "Latest from the blog"
  // section. Best-effort — a query failure just omits the section.
  let recentPosts: BlogEmailRecent[] = []
  try {
    const { db } = await import('./db')
    const { blogs } = await import('./db/schema')
    const { eq, and, ne, desc } = await import('drizzle-orm')
    const rows = await db
      .select({
        title: blogs.title,
        slug: blogs.slug,
        excerpt: blogs.excerpt,
        coverImage: blogs.coverImage,
        readingMinutes: blogs.readingMinutes,
      })
      .from(blogs)
      .where(
        blog.slug
          ? and(eq(blogs.status, 'published'), ne(blogs.slug, blog.slug))
          : eq(blogs.status, 'published')
      )
      .orderBy(desc(blogs.publishedAt))
      .limit(3)
    recentPosts = rows.map((r) => ({
      title: r.title,
      excerpt: r.excerpt,
      coverImage: r.coverImage,
      readingMinutes: r.readingMinutes,
      url: `${baseUrl}/blogs/${r.slug}`,
    }))
  } catch (err) {
    console.error('Failed to load recent posts for blog broadcast:', err)
  }

  const html = buildBlogEmail({
    title: blog.title,
    excerpt: blog.excerpt,
    coverImage: blog.coverImage,
    authorName: blog.authorName,
    readingMinutes: blog.readingMinutes,
    publishedAt: blog.publishedAt,
    url,
    recentPosts,
    unsubscribe: true, // Broadcasts API requires an unsubscribe link.
  })
  const subject = `New on the Forke blog: ${blog.title}`

  try {
    // 3) Create the broadcast against the audience.
    const createRes = await resendFetch('/broadcasts', {
      method: 'POST',
      body: JSON.stringify({
        audience_id: audienceId,
        from: 'Forke Blog <blog@forke.space>',
        reply_to: 'support@forke.space',
        subject,
        html,
        name: `Blog: ${blog.title}`,
      }),
    }, apiKey)
    if (!createRes.ok) {
      console.error('Failed to create Resend broadcast:', await createRes.text())
      return { success: false, sentCount: 0 }
    }
    const broadcast = (await createRes.json()) as { id: string }
    const broadcastId = broadcast.id

    // 4) Send it now — with retries.
    //
    // Resend can return a transient error if /send is called in the same instant
    // the broadcast is created (it hasn't finished provisioning yet). On Vercel's
    // serverless timing this race is easy to hit, and a failed send silently
    // leaves the broadcast stuck in "draft". So we retry a few times with a short
    // backoff before giving up, and we KEEP the real error text so the caller can
    // surface it instead of a generic failure.
    let lastError = ''
    for (let attempt = 1; attempt <= 4; attempt++) {
      const sendRes = await resendFetch(`/broadcasts/${broadcastId}/send`, {
        method: 'POST',
        body: JSON.stringify({}),
      }, apiKey)

      if (sendRes.ok) {
        console.log(`Blog broadcast sent to audience ${audienceId} (${synced} contacts).`)
        return { success: true, sentCount: synced, broadcastId }
      }

      lastError = await sendRes.text()
      console.error(`Broadcast send attempt ${attempt}/4 failed (${sendRes.status}):`, lastError)

      // 4xx that isn't a 429 is a real, non-transient problem (bad audience,
      // unverified domain, already sent) — retrying won't help, so stop early.
      const transient = sendRes.status === 429 || sendRes.status >= 500
      if (!transient) break
      await sleep(attempt * 800) // 0.8s, 1.6s, 2.4s backoff
    }

    console.error('Failed to send Resend broadcast after retries:', lastError)
    return { success: false, sentCount: 0, broadcastId, error: lastError }
  } catch (err) {
    console.error('Error dispatching blog broadcast:', err)
    return { success: false, sentCount: 0, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function getRecentPostsForEmail(): Promise<BlogEmailRecent[]> {
  try {
    const { db } = await import('./db')
    const { blogs } = await import('./db/schema')
    const { eq, desc } = await import('drizzle-orm')
    const rows = await db
      .select({
        title: blogs.title,
        slug: blogs.slug,
        excerpt: blogs.excerpt,
        coverImage: blogs.coverImage,
        readingMinutes: blogs.readingMinutes,
      })
      .from(blogs)
      .where(eq(blogs.status, 'published'))
      .orderBy(desc(blogs.publishedAt))
      .limit(3)
    const baseUrl = resolveBaseUrl()
    return rows.map((r) => ({
      title: r.title,
      excerpt: r.excerpt,
      coverImage: r.coverImage,
      readingMinutes: r.readingMinutes,
      url: `${baseUrl}/blogs/${r.slug}`,
    }))
  } catch (err) {
    console.error('Failed to load recent posts for email:', err)
    return []
  }
}

export async function sendWelcomeEmail(toEmail: string): Promise<boolean> {
  const recentPosts = await getRecentPostsForEmail()
  return sendResendEmail(
    toEmail,
    'Welcome to the Forke Waitlist!',
    buildWelcomeEmail(recentPosts),
    'welcome',
    'Forke Waitlist <waitlist@forke.space>'
  )
}

export async function sendSiteLiveBroadcast(): Promise<{ success: boolean; sentCount: number; broadcastId?: string }> {
  const apiKey = resolveResendApiKey()
  if (!apiKey) {
    console.warn('⚠️ RESEND_API_KEY is not configured. Skipping site-live broadcast.')
    return { success: false, sentCount: 0 }
  }

  // Resolve recipients from our DB (de-duplicated, case-insensitive).
  const emails: string[] = []
  try {
    const { db } = await import('./db')
    const { subscribers } = await import('./db/schema')
    const rows = await db.select({ email: subscribers.email }).from(subscribers)
    const seen = new Set<string>()
    for (const r of rows) {
      const e = r.email?.trim()
      if (!e) continue
      const key = e.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      emails.push(e)
    }
  } catch (err) {
    console.error('Failed to load subscribers for site-live broadcast:', err)
    return { success: false, sentCount: 0 }
  }
  if (emails.length === 0) return { success: true, sentCount: 0 }

  // 1) Ensure an audience and 2) sync our subscribers into it as contacts.
  const audienceId = await ensureAudience(apiKey)
  if (!audienceId) return { success: false, sentCount: 0 }
  const synced = await syncContactsToAudience(audienceId, emails, apiKey)

  // Fetch the 3 recent published blogs to include in the email
  const recentPosts = await getRecentPostsForEmail()

  const html = buildSiteLiveEmail({
    unsubscribe: true, // Broadcasts API requires an unsubscribe link.
    recentPosts,
  })
  const subject = 'Forke is live'

  try {
    // 3) Create the broadcast against the audience.
    const createRes = await resendFetch('/broadcasts', {
      method: 'POST',
      body: JSON.stringify({
        audience_id: audienceId,
        from: 'Forke Waitlist <waitlist@forke.space>',
        reply_to: 'support@forke.space',
        subject,
        html,
        name: 'Forke is Live Broadcast',
      }),
    }, apiKey)
    if (!createRes.ok) {
      console.error('Failed to create Resend broadcast:', await createRes.text())
      return { success: false, sentCount: 0 }
    }
    const broadcast = (await createRes.json()) as { id: string }
    const broadcastId = broadcast.id

    // 4) Send it now.
    const sendRes = await resendFetch(`/broadcasts/${broadcastId}/send`, {
      method: 'POST',
      body: JSON.stringify({}),
    }, apiKey)
    if (!sendRes.ok) {
      console.error('Failed to send Resend broadcast:', await sendRes.text())
      return { success: false, sentCount: 0, broadcastId }
    }

    console.log(`Site-live broadcast sent to audience ${audienceId} (${synced} contacts).`)
    return { success: true, sentCount: synced, broadcastId }
  } catch (err) {
    console.error('Error dispatching site-live broadcast:', err)
    return { success: false, sentCount: 0 }
  }
}

export async function sendAdminInvitation(
  toEmail: string,
  name: string,
  inviteLink: string
): Promise<boolean> {
  const recentPosts = await getRecentPostsForEmail()
  return sendResendEmail(
    toEmail,
    'Action Required: Complete your Forke Admin Setup',
    buildAdminInvitationEmail(name, inviteLink, recentPosts),
    'admin invitation',
    'Forke Onboarding <onboarding@forke.space>'
  )
}

export async function sendAccountDeletionScheduledEmail(toEmail: string): Promise<boolean> {
  const recentPosts = await getRecentPostsForEmail()
  return sendResendEmail(
    toEmail,
    'Forke: Your account deletion has been scheduled',
    buildAccountDeletionScheduledEmail(recentPosts),
    'deletion scheduled',
    'Forke Security <security@forke.space>'
  )
}

export async function sendOwnerApprovedEmail(toEmail: string, name: string): Promise<boolean> {
  const signInLink = `${resolveBaseUrl()}/signin`
  const recentPosts = await getRecentPostsForEmail()
  return sendResendEmail(
    toEmail,
    'Your Forke owner account is approved',
    buildOwnerApprovedEmail(name, signInLink, recentPosts),
    'owner approval',
    'Forke Approvals <approvals@forke.space>'
  )
}

export async function sendOwnerDeclinedEmail(toEmail: string, name: string, reason: string): Promise<boolean> {
  const applyLink = `${resolveBaseUrl()}/signin`
  const recentPosts = await getRecentPostsForEmail()
  return sendResendEmail(
    toEmail,
    'Update on your Forke owner application',
    buildOwnerDeclinedEmail(name, reason, applyLink, recentPosts),
    'owner decline',
    'Forke Approvals <approvals@forke.space>'
  )
}

async function sendBannedEmail(toEmail: string, name: string, accountKind: 'owner' | 'developer'): Promise<boolean> {
  const reviewLink = `${resolveBaseUrl()}/auth-error?error=AccessDenied`
  const recentPosts = await getRecentPostsForEmail()
  return sendResendEmail(
    toEmail,
    'Your Forke account has been suspended',
    buildBannedEmail(name, accountKind, reviewLink, recentPosts),
    `${accountKind} ban`,
    'Forke Bans <bans@forke.space>'
  )
}

export async function sendOwnerBannedEmail(toEmail: string, name: string): Promise<boolean> {
  return sendBannedEmail(toEmail, name, 'owner')
}

export async function sendDeveloperBannedEmail(toEmail: string, name: string): Promise<boolean> {
  return sendBannedEmail(toEmail, name, 'developer')
}

/**
 * Dynamic helper to ensure an audience exists in Resend by name.
 */
async function ensureAudienceByName(name: string, apiKey: string): Promise<string | null> {
  const existingId = await findAudienceByName(name, apiKey)
  if (existingId) return existingId

  try {
    const res = await resendFetch('/audiences', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }, apiKey)
    if (!res.ok) {
      console.error(`Failed to create Resend audience "${name}":`, await res.text())
      return null
    }
    const json = (await res.json()) as { id?: string }
    return json.id ?? null
  } catch (err) {
    console.error(`Error creating Resend audience "${name}":`, err)
    return null
  }
}

/**
 * Sync active database administrators to the "Forke Admins" Resend audience.
 */
export async function syncAdminsToResend(): Promise<{ success: boolean; syncedCount: number }> {
  const apiKey = resolveResendApiKey()
  if (!apiKey) {
    console.warn('⚠️ RESEND_API_KEY is not configured. Skipping admin sync.')
    return { success: false, syncedCount: 0 }
  }

  try {
    const { db } = await import('./db')
    const { admins } = await import('./db/schema')
    const { eq } = await import('drizzle-orm')

    const activeAdmins = await db
      .select({ email: admins.email })
      .from(admins)
      .where(eq(admins.isDisabled, false))

    const emails = activeAdmins.map((a) => a.email).filter(Boolean)
    if (emails.length === 0) {
      return { success: true, syncedCount: 0 }
    }

    const audienceId = await ensureAudienceByName('Forke Admins', apiKey)
    if (!audienceId) {
      return { success: false, syncedCount: 0 }
    }

    const syncedCount = await syncContactsToAudience(audienceId, emails, apiKey)
    return { success: true, syncedCount }
  } catch (err) {
    console.error('Error syncing admins to Resend:', err)
    return { success: false, syncedCount: 0 }
  }
}

/**
 * Database backup notification email HTML template.
 */
export function buildDatabaseBackupEmail(
  downloadUrl: string,
  expiryTime: string,
  recentPosts?: BlogEmailRecent[],
  maxWidth?: number
): string {
  return emailShell({
    maxWidth,
    recentPosts,
    title: 'Forke — Database Backup',
    preheader: 'Your database backup is ready. Link expires in 12 hours.',
    banner: 'main-banner.png',
    footerLabel: 'Automated Database Backup',
    bodyHtml: `
      ${heading('Database backup.', 'Ready.')}
      ${p('A full backup of the public schema has been compiled into a ZIP archive.')}
      ${calloutBox(
        '⚠️ Security Warning',
        `This download link contains sensitive database information and will expire at <strong>${expiryTime}</strong> (in 12 hours). Do not share this email or link.`
      )}
      ${p('Click the button below to download the backup archive:')}
      ${buttonPrimary(downloadUrl, 'Download backup ZIP')}
      ${fallbackLink(downloadUrl)}
    `,
  })
}

/**
 * Dispatches database backup notification emails to all active admins.
 */
export async function sendDatabaseBackupNotification(
  downloadUrl: string,
  expiryTime: string
): Promise<boolean> {
  // Try to sync admins first
  await syncAdminsToResend()

  try {
    const { db } = await import('./db')
    const { admins } = await import('./db/schema')
    const { eq } = await import('drizzle-orm')

    const activeAdmins = await db
      .select({ email: admins.email, name: admins.name })
      .from(admins)
      .where(eq(admins.isDisabled, false))

    if (activeAdmins.length === 0) {
      console.warn('No active admins found to send backup notification.')
      return false
    }

    const recentPosts = await getRecentPostsForEmail()
    const emailBody = buildDatabaseBackupEmail(downloadUrl, expiryTime, recentPosts)

    let allSent = true
    for (const admin of activeAdmins) {
      const success = await sendResendEmail(
        admin.email,
        'Forke: Your database backup is ready',
        emailBody,
        'database backup',
        'Forke Database <db@forke.space>'
      )
      if (!success) allSent = false
    }

    return allSent
  } catch (err) {
    console.error('Failed to send database backup notifications:', err)
    return false
  }
}

const TIER_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

function formatBackupSize(sizeBytes?: number): string {
  if (!sizeBytes) return 'N/A'
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

export function buildBackupReportEmail(
  downloadUrl: string,
  expiryTime: string,
  tier: string,
  sizeBytes?: number,
  maxWidth?: number
): string {
  const tierLabel = TIER_LABEL[tier] || tier
  return emailShell({
    maxWidth,
    title: 'Forke — Database Backup',
    preheader: `${tierLabel} production database backup is ready. Link expires in 12 hours.`,
    banner: 'main-banner.png',
    footerLabel: 'Automated Database Backup',
    bodyHtml: `
      ${heading('Database backup.', 'Ready.')}
      ${p(`A ${tierLabel.toLowerCase()} PostgreSQL dump (${formatBackupSize(sizeBytes)}) of the production database completed and was stored on Cloudflare R2, retained per the backup rotation policy (7 daily / 4 weekly / 6 monthly).`)}
      ${calloutBox(
        '⚠️ Security Warning',
        `This download link contains sensitive database information and will expire at <strong>${expiryTime}</strong> (in 12 hours). Do not share this email or link.`
      )}
      ${p('Click the button below to download the backup file:')}
      ${buttonPrimary(downloadUrl, 'Download backup')}
      ${fallbackLink(downloadUrl)}
    `,
  })
}

/**
 * Dispatches automated production backup-run notification emails to all active admins.
 */
export async function sendBackupReportNotification(
  downloadUrl: string,
  expiryTime: string,
  tier: string,
  sizeBytes?: number
): Promise<boolean> {
  await syncAdminsToResend()

  try {
    const { db } = await import('./db')
    const { admins } = await import('./db/schema')
    const { eq } = await import('drizzle-orm')

    const activeAdmins = await db
      .select({ email: admins.email, name: admins.name })
      .from(admins)
      .where(eq(admins.isDisabled, false))

    if (activeAdmins.length === 0) {
      console.warn('No active admins found to send backup report notification.')
      return false
    }

    const emailBody = buildBackupReportEmail(downloadUrl, expiryTime, tier, sizeBytes)
    const tierLabel = TIER_LABEL[tier] || tier

    let allSent = true
    for (const admin of activeAdmins) {
      const success = await sendResendEmail(
        admin.email,
        `Forke: ${tierLabel} database backup is ready`,
        emailBody,
        'database backup',
        'Forke Database <db@forke.space>'
      )
      if (!success) allSent = false
    }

    return allSent
  } catch (err) {
    console.error('Failed to send backup report notifications:', err)
    return false
  }
}

export function buildBackupFailureEmail(tier: string, errorMessage: string, maxWidth?: number): string {
  return emailShell({
    maxWidth,
    title: 'Forke — Backup Failed',
    preheader: `The ${tier} production database backup failed.`,
    banner: 'main-banner.png',
    footerLabel: 'Automated Database Backup',
    bodyHtml: `
      ${heading('Backup failed.', 'Action needed.')}
      ${p(`The scheduled <strong>${tier}</strong> backup of the production database did not complete successfully.`)}
      ${calloutBox('🚨 Error', errorMessage || 'Unknown error — check the OCI host logs.')}
      ${p('No new backup was stored for this run. If this keeps happening, the retention chain will develop a gap.')}
    `,
  })
}

/**
 * Alerts all active admins that a scheduled production database backup failed.
 */
export async function sendBackupFailureAlert(tier: string, errorMessage: string): Promise<boolean> {
  await syncAdminsToResend()

  try {
    const { db } = await import('./db')
    const { admins } = await import('./db/schema')
    const { eq } = await import('drizzle-orm')

    const activeAdmins = await db
      .select({ email: admins.email, name: admins.name })
      .from(admins)
      .where(eq(admins.isDisabled, false))

    if (activeAdmins.length === 0) {
      console.warn('No active admins found to send backup failure alert.')
      return false
    }

    const emailBody = buildBackupFailureEmail(tier, errorMessage)

    let allSent = true
    for (const admin of activeAdmins) {
      const success = await sendResendEmail(
        admin.email,
        `Forke: ${tier} database backup FAILED`,
        emailBody,
        'database backup failure',
        'Forke Database <db@forke.space>'
      )
      if (!success) allSent = false
    }

    return allSent
  } catch (err) {
    console.error('Failed to send backup failure alerts:', err)
    return false
  }
}
