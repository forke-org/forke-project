import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  timestamp,
  pgEnum,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['developer', 'owner'])
export const taskStatusEnum = pgEnum('task_status', [
  'processing',
  'open',
  'claimed',
  'submitted',
  'approved',
  'disputed',
])
export const submissionStatusEnum = pgEnum('submission_status', [
  'pending',
  'approved',
  'rejected',
])
export const escrowStatusEnum = pgEnum('escrow_status', [
  'held',
  'released',
  'refunded',
])
export const blogStatusEnum = pgEnum('blog_status', ['draft', 'published'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  githubAvatarUrl: text('github_avatar_url'),
  googleAvatarUrl: text('google_avatar_url'),
  passwordHash: text('password_hash'),
  role: userRoleEnum('role').default('developer').notNull(),
  level: integer('level').default(1).notNull(),
  xp: integer('xp').default(0).notNull(),
  githubUrl: text('github_url'),
  bio: text('bio'),
  headline: text('headline'),
  location: text('location'),
  websiteUrl: text('website_url'),
  linkedinUrl: text('linkedin_url'),
  githubStats: jsonb('github_stats'),
  lastLoginAt: timestamp('last_login_at'),
  currentStreak: integer('current_streak').default(0).notNull(),
  isApproved: boolean('is_approved').default(false).notNull(),
  isBanned: boolean('is_banned').default(false).notNull(),
  emailAlerts: boolean('email_alerts').default(true),
  slackWebhooks: boolean('slack_webhooks').default(false),
  college: text('college'),
  deletionScheduledAt: timestamp('deletion_scheduled_at'),
  attribution: jsonb('attribution'), // first-touch marketing attribution { source, medium, campaign, referrer, landingPage, signupRole }
  lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const owners = pgTable('owners', {
  id: uuid('id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  contactNumber: text('contact_number').notNull(),
  contactEmail: text('contact_email').notNull(),
  companyName: text('company_name').notNull(),
  companyWebsite: text('company_website'),
  personalLinkedIn: text('personal_linkedin').notNull(),
  companyLinkedIn: text('company_linkedin').notNull(),
  designation: text('designation').notNull(),
  otherLinks: text('other_links'),
  message: text('message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const admins = pgTable('admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  username: text('username').unique(),
  passwordHash: text('password_hash'),
  role: text('role').default('admin').notNull(),
  alternativeEmail: text('alternative_email'),
  inviteToken: text('invite_token').unique(),
  inviteExpiresAt: timestamp('invite_expires_at'),
  isDisabled: boolean('is_disabled').default(false).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const accounts = pgTable(
  'account',
  {
    userId: uuid('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<'oauth' | 'oidc' | 'email'>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => ({
    compoundKey: {
      columns: [account.provider, account.providerAccountId],
      primaryKey: true,
    },
  })
)

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: uuid('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
})



export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  budget: integer('budget').notNull(), // Stored in paise
  currency: text('currency').default('INR').notNull(),
  status: taskStatusEnum('status').default('open').notNull(),
  skillTags: text('skill_tags').array(),
  clientId: uuid('client_id')
    .references(() => users.id)
    .notNull(),
  claimantId: uuid('claimant_id').references(() => users.id),
  claimedAt: timestamp('claimed_at'),
  deadline: timestamp('deadline'),
  sandboxRepoId: uuid('sandbox_repo_id').references(() => sandboxRepos.id, { onDelete: 'set null' }),
  sourceRepo: text('source_repo'), // e.g. "owner/original-repo" — stored for reference
  codespaceName: text('codespace_name'),
  codespaceUrl: text('codespace_url'),
  codespaceStatus: text('codespace_status'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const submissions = pgTable('submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id')
    .references(() => tasks.id)
    .notNull(),
  developerId: uuid('developer_id')
    .references(() => users.id)
    .notNull(),
  githubLink: text('github_link').notNull(),
  note: text('note'),
  status: submissionStatusEnum('status').default('pending').notNull(),
  rating: integer('rating'), // 1-5 scale
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const escrow = pgTable('escrow', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id')
    .references(() => tasks.id)
    .unique()
    .notNull(),
  amount: integer('amount').notNull(),
  status: escrowStatusEnum('status').default('held').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const revisionRequests = pgTable('revision_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id')
    .references(() => tasks.id)
    .notNull(),
  clientNote: text('client_note').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Note: github_profiles table has been merged into developers table below.

export const supportEnquiries = pgTable('support_enquiries', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  contactNumber: text('contact_number').notNull(),
  contactEmail: text('contact_email').notNull(),
  message: text('message').notNull(),
  relevantLinks: text('relevant_links'),
  errorType: text('error_type'),
  status: text('status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const subscribers = pgTable('subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  source: text('source').notNull().default('direct'), // primary, queryable marketing channel
  attribution: jsonb('attribution'), // full first-touch blob { medium, campaign, referrer, landingPage }
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Audit trail of admin actions (the "activity terminal" in the admin panel).
export const adminAuditLog = pgTable('admin_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id'),                       // admin who did it (null = system)
  actorName: text('actor_name'),                   // snapshot of the admin's name
  category: text('category').notNull().default('admin'), // admin | user | db | system | error
  action: text('action').notNull(),                // e.g. owner.approved, developer.banned
  target: text('target'),                          // human-readable subject (email / name / table)
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Log of every automated/manual production database backup run (OCI cron + admin "Run now").
export const backupRuns = pgTable('backup_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
  status: text('status').notNull(),              // 'success' | 'failed'
  tier: text('tier').notNull(),                   // 'daily' | 'weekly' | 'monthly' | 'manual'
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  r2Key: text('r2_key'),
  triggeredBy: text('triggered_by'),               // 'cron' | admin email for manual runs
  errorMessage: text('error_message'),
})

export const developers = pgTable('developers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  githubId: text('github_id').unique(),
  username: text('username'),
  accessToken: text('access_token'),
  avatarUrl: text('avatar_url'),
  profileUrl: text('profile_url'),
  repos: jsonb('repos'),
  languages: jsonb('languages'),
  rawProfile: jsonb('raw_profile'),
  isGithubConnected: boolean('is_github_connected').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  receiverId: uuid('receiver_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  isReceived: boolean('is_received').default(false).notNull(),
  isSeen: boolean('is_seen').default(false).notNull(),
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(), // e.g. 'task_claimed', 'submission_received', 'message', 'payment', etc.
  title: text('title').notNull(),
  body: text('body').notNull(),
  link: text('link'), // optional deep-link (e.g. /tasks/123)
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const sqlQueryRequests = pgTable('sql_query_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  requesterId: uuid('requester_id')
    .references(() => admins.id, { onDelete: 'cascade' })
    .notNull(),
  queryText: text('query_text').notNull(),
  status: text('status').default('pending').notNull(), // 'pending', 'approved', 'rejected'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reviewedBy: uuid('reviewed_by').references(() => admins.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  rejectionReason: text('rejection_reason'),
  executionDurationMs: integer('execution_duration_ms'),
  executionResults: jsonb('execution_results'),
  executionError: text('execution_error'),
})

// Blog posts authored in the admin portal's Medium-style editor.
// `content` holds Tiptap's structured JSON (the source of truth, queryable/re-editable);
// `contentHtml` is the rendered HTML snapshot used by the public reader to avoid
// re-serializing JSON on every page view. `coverImage` and inline images are URLs —
// currently pasted by hand, later produced by the R2 upload pipeline.
export const blogs = pgTable('blogs', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').references(() => admins.id, { onDelete: 'set null' }),
  authorName: text('author_name'),                 // snapshot of the author's name at write time
  title: text('title').notNull().default('Untitled'),
  slug: text('slug').notNull().unique(),
  excerpt: text('excerpt'),                         // short summary for cards / SEO
  coverImage: text('cover_image'),                 // URL (R2 later)
  content: jsonb('content'),                       // Tiptap JSON document
  contentHtml: text('content_html'),               // rendered HTML snapshot
  status: blogStatusEnum('status').default('draft').notNull(),
  readingMinutes: integer('reading_minutes').default(1).notNull(),
  views: integer('views').default(0).notNull(),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ===== IN-HOUSE ANALYTICS (free, first-party, no third-party tracker) =====
//
// One row per first-touch visit that carried a marketing signal (?source=, utm_*, ?ref=,
// or an external referrer). Written fire-and-forget from /api/track, which the Edge
// middleware pings — middleware itself can't use postgres-js, so the Node route does the
// insert. `sessionId` is a random first-party cookie that lets us later join a visit to the
// signup it produced (visit -> conversion), without any IP or device fingerprint.
export const pageVisits = pgTable('page_visits', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id'),                   // random forke_session cookie (visit<->signup join key)
  source: text('source').notNull().default('direct'),
  medium: text('medium'),
  campaign: text('campaign'),
  referrer: text('referrer'),                      // external referring URL (truncated)
  landingPath: text('landing_path'),               // first page they hit
  country: text('country'),                         // coarse geo only (from edge header), never the IP
  isBot: boolean('is_bot').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ===== AUTH SECURITY LOG (separate from marketing attribution by design) =====
//
// Records sign-in / sign-up events for abuse detection only. We store a salted SHA-256
// HASH of the IP (never the raw address) plus the resolved country, so we can spot
// "same IP, many accounts" without holding personal data. Lawful basis: legitimate
// interest (security / fraud prevention). Disclosed in /privacy. Purge rows > 90 days.
export const authEvents = pgTable('auth_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  email: text('email'),                            // snapshot, in case the user is later deleted
  event: text('event').notNull(),                  // 'signin' | 'signup'
  provider: text('provider'),                      // 'credentials' | 'google' | 'github'
  ipHash: text('ip_hash'),                         // salted sha256 of the IP — NOT the raw IP
  country: text('country'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Sandbox Users (GitHub users who import repos or do tasks) ────────────────

export const sandboxUsers = pgTable('sandbox_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubId: integer('github_id').notNull().unique(),
  username: text('username').notNull(),
  accessToken: text('access_token').notNull(),
  role: text('role').notNull(), // 'owner' | 'developer'
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Sandbox Repos (Mirrors of owner repos managed by Forke) ──────────────────

export const sandboxRepos = pgTable('sandbox_repos', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .references(() => sandboxUsers.id, { onDelete: 'cascade' })
    .notNull(),
  sourceRepo: text('source_repo').notNull(),       // e.g. "owner/original-repo"
  sandboxRepo: text('sandbox_repo').notNull(),      // e.g. "forke-sandbox/owner-repo-mirror"
  // Task metadata — filled in via Configure Task form
  taskTitle: text('task_title'),
  taskDescription: text('task_description'),
  frontendStack: text('frontend_stack'),
  backendStack: text('backend_stack'),
  allowedPaths: text('allowed_paths'),              // Comma/newline-separated glob patterns
  restrictedPaths: text('restricted_paths'),        // Comma/newline-separated glob patterns
  acceptanceCriteria: text('acceptance_criteria'),
  verificationStatus: text('verification_status').default('verifying').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Developer Forks (Developers who fork sandbox repos) ──────────────────────

export const developerForks = pgTable('developer_forks', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubUsername: text('github_username').notNull(),
  sandboxRepo: text('sandbox_repo').notNull(),
  forkUrl: text('fork_url').notNull(),
  prUrl: text('pr_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Baseline Snapshots (Deterministic health check of base branch) ───────────

export const baselineSnapshots = pgTable('baseline_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  sandboxRepoId: uuid('sandbox_repo_id')
    .references(() => sandboxRepos.id, { onDelete: 'cascade' })
    .notNull(),
  branch: text('branch').notNull(),
  commitSha: text('commit_sha').notNull(),
  techStack: text('tech_stack'),      // JSON string of DetectedStack
  results: text('results'),           // JSON string of 12 deterministic test results
  aiSummary: text('ai_summary'),      // JSON string of Gemini baseline diagnostic
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ─── Code Reviews (Unified automated and AI code reviews) ───────────────────

export const codeReviews = pgTable('code_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  sandboxRepoId: uuid('sandbox_repo_id')
    .references(() => sandboxRepos.id, { onDelete: 'cascade' })
    .notNull(),
  developerForkId: uuid('developer_fork_id')
    .references(() => developerForks.id, { onDelete: 'cascade' }),
  prNumber: integer('pr_number'),
  commitSha: text('commit_sha').notNull(),
  baselineSnapshotId: uuid('baseline_snapshot_id')
    .references(() => baselineSnapshots.id, { onDelete: 'set null' }),
  // Deterministic checks
  results: text('results'),
  comparison: text('comparison'),
  verdict: text('verdict'), // 'pass', 'warn', 'fail'
  reportHtml: text('report_html'),
  // AI review metrics
  aiVerdict: text('ai_verdict'), // 'pass', 'needs_changes', 'high_risk'
  aiScore: integer('ai_score'), // 0 to 100
  requirementMatch: text('requirement_match'),
  aiSummary: text('ai_summary'),
  aiStrengths: text('ai_strengths'), // JSON array string
  aiIssues: text('ai_issues'), // JSON array string
  aiRisks: text('ai_risks'), // JSON array string
  unauthorizedEdits: text('unauthorized_edits'), // JSON array string
  resolvedIssues: text('resolved_issues'), // JSON array string
  resolvedRisks: text('resolved_risks'), // JSON array string
  riskScore: integer('risk_score'),
  riskRouting: text('risk_routing'),
  aiModel: text('ai_model'),
  tokensUsed: integer('tokens_used'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
