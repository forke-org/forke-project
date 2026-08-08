import React from 'react'
import {
  ArrowRight,
  ArrowDown,
  ChevronRight,
} from 'lucide-react'
import {
  RiGraduationCapFill,
  RiInformationFill,
  RiCodeSSlashFill,
  RiBuilding4Fill,
  RiUser3Fill,
  RiGitForkFill,
  RiSettings4Fill,
  RiListCheck3,
  RiCursorFill,
  RiGitBranchFill,
  RiGitPullRequestFill,
  RiShieldCheckFill,
  RiRobotFill,
  RiTrophyFill,
  RiStackFill,
  RiSpeedFill,
  RiWallet3Fill,
  RiLoopLeftFill,
  RiFileTextFill,
  RiLifebuoyFill,
} from '@remixicon/react'
import {
  Prose,
  Lead,
  H3,
  P,
  UL,
  OL,
  Note,
  Steps,
  Step,
  Table,
  Visual,
  Tag,
  DocLink,
} from './primitives'

/**
 * Single source of truth for the Forke docs.
 * Structure mirrors the Linear docs sidebar (grouped sections → articles),
 * trimmed to what actually exists on Forke. Each article carries its own
 * on-this-page headings so the right rail can be built without parsing the DOM.
 */

export type TocItem = { id: string; label: string; depth?: 1 | 2 }

export type DocIcon = React.ComponentType<{ className?: string }>

export type Article = {
  slug: string
  title: string
  description: string
  icon: DocIcon
  readTime?: string
  /** Surfaced on the docs home grid. */
  popular?: boolean
  toc: TocItem[]
  body: React.ReactNode
  /**
   * Plain-text / Markdown source for this article. Powers the "Copy page" and
   * "View as Markdown" actions (LLM-friendly export). Kept alongside the JSX so
   * the two never drift apart.
   */
  markdown: string
}

export type DocSection = {
  id: string
  label: string
  description: string
  icon: DocIcon
  /** Collapsed groups still render; this just sets the default open state. */
  defaultOpen?: boolean
  articles: Article[]
}

/* ------------------------------------------------------------------ */
/*  Reusable product data (kept honest against the IDEATION specs).    */
/* ------------------------------------------------------------------ */

const TIER_ROWS = [
  ['Early Game', 'LVL 1–5', 'Newcomer → Stack Explorer', 'Basic bounties, public profile URL'],
  ['Mid Game', 'LVL 6–10', 'Code Runner → Sprint Soldier', 'Intermediate payouts, XP streak multipliers'],
  ['Skilled', 'LVL 11–15', 'Merge Specialist → Feature Shipper', 'Priority queue, elite + reviewer eligibility'],
  ['Elite', 'LVL 16–20', 'Runtime Knight → Production Slayer', 'Team lead, mentor access'],
  ['Legend', 'LVL 21–25', 'Silicon Phantom → Forke Legend', 'Invite-only enterprise projects'],
]

const STATE_ROWS = [
  ['OPEN', 'Anyone eligible can claim it'],
  ['RESERVED', 'Soft reservation held; 20-minute activation timer running'],
  ['IN_PROGRESS', 'Activated and locked to one developer; deadline clock running'],
  ['UNDER_REVIEW', 'PR submitted; automated checks + AI review running'],
  ['AWAITING_OWNER', 'Passed the pipeline; verdict card live for the founder'],
  ['COMPLETED', 'Approved, merged upstream, escrow released, XP awarded'],
  ['REVISION_REQUESTED', 'Sent back to the same developer for a new submission'],
  ['EXPIRED', 'Deadline passed with no submission; returns to OPEN, trust penalty'],
]

const ACHIEVEMENT_ROWS = [
  ['First Blood', 'Complete your first task'],
  ['Bug Hunter', 'Fix 10 bug-tagged tasks'],
  ['Clutch Commit', 'Submit before 25% of the deadline'],
  ['Untouchable', '20 consecutive approved submissions'],
  ['Monster Sprint', '5 tasks in 24 hours'],
  ['Streak God', '30-day login streak'],
  ['Loot Goblin', 'Earn ₹10,000 total'],
  ['Boss Mode', 'Reach Level 15'],
  ['Forke Legend', 'Reach Level 25'],
]

/* ================================================================== */
/*  ARTICLES                                                           */
/* ================================================================== */

/* ---- Getting started --------------------------------------------- */

const welcome: Article = {
  slug: 'welcome',
  title: 'Welcome to Forke',
  description: 'Learn what Forke is and how to get from sign-up to your first payout.',
  icon: RiGraduationCapFill,
  readTime: '2 min read',
  popular: true,
  toc: [
    { id: 'overview', label: 'Overview' },
    { id: 'why', label: 'Why Forke exists' },
    { id: 'two-sides', label: 'Two sides of the marketplace' },
    { id: 'the-loop', label: 'The core loop' },
    { id: 'principles', label: 'Three principles' },
    { id: 'next', label: 'Where to go next' },
  ],
  body: (
    <Prose>
      <Lead>
        Forke is the micro-task marketplace where developers earn real money by shipping real
        code — no fake projects, no bidding wars, just bite-sized work with instant UPI payouts.
      </Lead>

      <H3 id="overview">Overview</H3>
      <P>
        Think of it as <em>Fiverr × GitHub × an RPG</em>. Founders post small, scoped tasks with a
        fixed budget and a time estimate. Developers claim a task that matches their level, ship the
        work as a pull request, and get paid the moment it&apos;s approved. Every completed task
        becomes verified, timestamped proof of work on your public profile. The whole thing is
        Git-native: work flows through real branches and pull requests, never ZIP files or pasted
        code.
      </P>

      <H3 id="why">Why Forke exists</H3>
      <P>
        Building fake CRUD apps impresses no one, and traditional freelancing means proposal-bidding
        wars and week-long timelines for a ₹300 bug fix. Forke removes both frictions: developers get
        a structured, low-friction way to say <em>&ldquo;I have two hours — give me a real task, pay
        me&rdquo;</em>, and founders get a trusted, fast, scoped micro-task economy instead of a full
        freelance platform. Read the longer story on{' '}
        <DocLink href="/whats-forke">What is Forke</DocLink>.
      </P>

      <H3 id="two-sides">Two sides of the marketplace</H3>
      <P>These docs are written for both audiences. Jump to the side that fits you:</P>
      <UL>
        <li>
          <DocLink href="/docs/for-developers">For developers</DocLink> — claim tasks, ship code,
          level up, cash out.
        </li>
        <li>
          <DocLink href="/docs/for-founders">For founders</DocLink> — post scoped tasks, fund
          escrow, review a plain-English verdict.
        </li>
      </UL>

      <H3 id="the-loop">The core loop</H3>
      <Visual
        label="The Forke loop"
        caption="Browse → claim → build in a branch → submit a PR → reviewed → paid."
      >
        <LoopVisual />
      </Visual>

      <H3 id="principles">Three principles</H3>
      <P>Everything on Forke rests on three architectural rules:</P>
      <OL>
        <li>
          <strong>Never ZIP uploads.</strong> Every submission lives in a pull request. No
          exceptions.
        </li>
        <li>
          <strong>Forke is the middle layer.</strong> Developers never touch owner repos directly —
          Forke mirrors, branches, and merges.
        </li>
        <li>
          <strong>AI assists, humans decide.</strong> AI generates the verdict card; founders make
          the final call.
        </li>
      </OL>

      <H3 id="next">Where to go next</H3>
      <UL>
        <li>
          New to the model? Read <DocLink href="/docs/core-concepts">Core concepts</DocLink>.
        </li>
        <li>
          Ready to earn? Start with{' '}
          <DocLink href="/docs/browsing-the-feed">Browsing the bounty feed</DocLink>.
        </li>
        <li>
          Curious how work is judged? See{' '}
          <DocLink href="/docs/review-pipeline">the review pipeline</DocLink>.
        </li>
        <li>
          Want the level breakdown? See <DocLink href="/levels">the Levels page</DocLink>.
        </li>
      </UL>
    </Prose>
  ),
  markdown: `# Welcome to Forke

Forke is the micro-task marketplace where developers earn real money by shipping real code — no fake projects, no bidding wars, just bite-sized work with instant UPI payouts.

## Overview

Think of it as Fiverr x GitHub x an RPG. Founders post small, scoped tasks with a fixed budget and a time estimate. Developers claim a task that matches their level, ship the work as a pull request, and get paid the moment it's approved. Every completed task becomes verified, timestamped proof of work on your public profile. The whole thing is Git-native: work flows through real branches and pull requests, never ZIP files or pasted code.

## Why Forke exists

Building fake CRUD apps impresses no one, and traditional freelancing means proposal-bidding wars and week-long timelines for a Rs 300 bug fix. Forke removes both frictions: developers get a structured, low-friction way to say "I have two hours — give me a real task, pay me", and founders get a trusted, fast, scoped micro-task economy instead of a full freelance platform.

## Two sides of the marketplace

- For developers (/docs/for-developers) — claim tasks, ship code, level up, cash out.
- For founders (/docs/for-founders) — post scoped tasks, fund escrow, review a plain-English verdict.

## The core loop

Browse -> Claim -> Build in a branch -> Submit a PR -> Reviewed -> Paid.

## Three principles

1. Never ZIP uploads. Every submission lives in a pull request. No exceptions.
2. Forke is the middle layer. Developers never touch owner repos directly — Forke mirrors, branches, and merges.
3. AI assists, humans decide. AI generates the verdict card; founders make the final call.

## Where to go next

- New to the model? Read Core concepts (/docs/core-concepts).
- Ready to earn? Start with Browsing the bounty feed (/docs/browsing-the-feed).
- Curious how work is judged? See the review pipeline (/docs/review-pipeline).
- Want the level breakdown? See the Levels page (/levels).
`,
}

const coreConcepts: Article = {
  slug: 'core-concepts',
  title: 'Core concepts',
  description: 'The vocabulary that shows up everywhere on Forke — bounties, escrow, levels, trust.',
  icon: RiInformationFill,
  readTime: '3 min read',
  popular: true,
  toc: [
    { id: 'bounty', label: 'Bounty' },
    { id: 'submission', label: 'PR submission' },
    { id: 'escrow', label: 'Escrow' },
    { id: 'access', label: '3D access' },
    { id: 'proof', label: 'Proof of work' },
  ],
  body: (
    <Prose>
      <Lead>A short glossary. Everything else in these docs builds on these terms.</Lead>

      <H3 id="bounty">Bounty</H3>
      <P>
        A single, scoped unit of work (30 minutes to ~4 hours) posted by a founder — a bug fix, a
        landing-page section, a Figma-to-React conversion. It carries a fixed budget in ₹, a time
        estimate, a tech stack, an XP reward, and a file scope.
      </P>

      <H3 id="submission">PR submission</H3>
      <P>
        Work is <strong>always</strong> delivered as a pull request — never a ZIP or a link dump.
        You work in a Forke-managed branch and fill out a structured <Tag>FORKE_SUBMISSION.md</Tag>{' '}
        before opening the PR.
      </P>

      <H3 id="escrow">Escrow</H3>
      <P>
        The founder deposits the budget up front via Razorpay. Funds are held by Forke and released
        to your UPI automatically the moment the work is approved — so the money is provably there
        before you start.
      </P>

      <H3 id="access">3D access</H3>
      <P>Every bounty has three gates, and all three must pass before you can claim it:</P>
      <Table
        head={['Dimension', 'Measures']}
        rows={[
          ['Level', 'Platform experience & consistency (LVL 1–25)'],
          ['Skill tier', 'Technical depth in a track (Frontend, Backend, …)'],
          ['Trust score', 'Professional reliability (completion, deadlines, ratings)'],
        ]}
      />
      <Note>
        <Tag>Eligibility = Level ∩ Skill&nbsp;Tier ∩ Trust&nbsp;Score</Tag> — credentials you
        can&apos;t fake by editing a resume.
      </Note>
      <P>
        To make that concrete: a production payment-integration task might require Level&nbsp;12+, a
        Fullstack tier of 3+, and a trust score above 85%. A developer who meets two of the three
        won&apos;t even see the task in their feed. This is what gives a founder structural confidence
        — when a React task reaches a developer, that developer has <em>proven</em> they can do React,
        not just ticked a box. See <DocLink href="/docs/skill-tracks">skill tracks</DocLink> and{' '}
        <DocLink href="/docs/trust-score">trust score</DocLink> for how each gate is computed.
      </P>

      <H3 id="proof">Proof of work</H3>
      <P>
        Every approved task appears on your public profile, timestamped and linked to the merged
        GitHub PR. Both you and Forke show up as contributors on the owner&apos;s upstream repo. The
        guiding philosophy: <em>&ldquo;Prove skill by shipping. Your profile is your
        reputation.&rdquo;</em> — see <DocLink href="/docs/profile">Profile &amp; proof of work</DocLink>.
      </P>
    </Prose>
  ),
  markdown: `# Core concepts

A short glossary. Everything else in these docs builds on these terms.

## Bounty

A single, scoped unit of work (30 minutes to ~4 hours) posted by a founder — a bug fix, a landing-page section, a Figma-to-React conversion. It carries a fixed budget in Rs, a time estimate, a tech stack, an XP reward, and a file scope.

## PR submission

Work is always delivered as a pull request — never a ZIP or a link dump. You work in a Forke-managed branch and fill out a structured FORKE_SUBMISSION.md before opening the PR.

## Escrow

The founder deposits the budget up front via Razorpay. Funds are held by Forke and released to your UPI automatically the moment the work is approved — so the money is provably there before you start.

## 3D access

Every bounty has three gates, and all three must pass before you can claim it:

- Level — platform experience and consistency (LVL 1-25)
- Skill tier — technical depth in a track (Frontend, Backend, ...)
- Trust score — professional reliability (completion, deadlines, ratings)

Eligibility = Level (intersect) Skill Tier (intersect) Trust Score — credentials you can't fake by editing a resume.

To make that concrete: a production payment-integration task might require Level 12+, a Fullstack tier of 3+, and a trust score above 85%. A developer who meets two of the three won't even see the task in their feed. This is what gives a founder structural confidence — when a React task reaches a developer, that developer has proven they can do React, not just ticked a box.

## Proof of work

Every approved task appears on your public profile, timestamped and linked to the merged GitHub PR. Both you and Forke show up as contributors on the owner's upstream repo. The guiding philosophy: "Prove skill by shipping. Your profile is your reputation."
`,
}

const forDevelopers: Article = {
  slug: 'for-developers',
  title: 'For developers',
  description: 'The end-to-end journey from connecting GitHub to your first instant payout.',
  icon: RiCodeSSlashFill,
  readTime: '4 min read',
  popular: true,
  toc: [
    { id: 'signup', label: 'Sign up & connect GitHub' },
    { id: 'journey', label: 'Your journey' },
    { id: 'tips', label: 'Tips for your first task' },
    { id: 'next', label: 'Keep reading' },
  ],
  body: (
    <Prose>
      <Lead>Forke is developer-only. Your code does the talking — no proposals, no interviews.</Lead>

      <H3 id="signup">Sign up &amp; connect GitHub</H3>
      <P>
        Sign up via the <strong>&ldquo;Do Tasks?&rdquo;</strong> path with Google or GitHub — the
        developer path is open access, no application required. Connecting GitHub once via OAuth runs
        a one-time automated analysis of your public activity that seeds your starting level
        (LVL&nbsp;1–3); a 60-second skill self-assessment then personalises your feed. You have a
        7-day nudge window to connect GitHub if you signed up with Google.
      </P>
      <Note>
        Before your first submission, add your UPI ID in{' '}
        <DocLink href="/settings">Settings</DocLink> — that&apos;s where escrow releases land on
        approval. See <DocLink href="/docs/settings">Settings &amp; payouts setup</DocLink>.
      </Note>

      <H3 id="journey">Your journey</H3>
      <Steps>
        <Step n="1" title="Browse the feed">
          See bounties gated to your level, skill tier, and trust score — you only ever see what
          you&apos;re eligible to claim.
        </Step>
        <Step n="2" title="Claim a task">
          Claiming opens a 20-minute soft reservation. Activate it by creating a branch, your first
          commit, or pressing &ldquo;I&apos;m Working&rdquo; — the task then locks to you and the
          deadline clock starts.
        </Step>
        <Step n="3" title="Build in a branch">
          Work in a Forke-managed branch (<Tag>dev-&#123;username&#125;/task-&#123;id&#125;</Tag>) inside
          the Forke mirror — never directly on the owner&apos;s repo. Stay inside the file scope; edits
          outside it are auto-rejected.
        </Step>
        <Step n="4" title="Submit a PR">
          Open a PR and fill the <Tag>FORKE_SUBMISSION.md</Tag> template. Automated checks and an AI
          review run before the owner sees anything.
        </Step>
        <Step n="5" title="Get paid">
          On approval, Forke merges upstream, releases escrow to your UPI instantly, and awards XP —
          and the task lands on your public profile.
        </Step>
      </Steps>

      <H3 id="tips">Tips for your first task</H3>
      <UL>
        <li>Pick something inside your skill tier — a clean first submission boosts trust score.</li>
        <li>Read the acceptance criteria before claiming; scope creep gets auto-flagged.</li>
        <li>Submit early — beating 50% of the deadline earns a <Tag>+25 XP</Tag> speed bonus.</li>
        <li>Don&apos;t claim what you can&apos;t start — abandoning after activation is a strong trust-score negative.</li>
      </UL>

      <H3 id="next">Keep reading</H3>
      <UL>
        <li><DocLink href="/docs/browsing-the-feed">Browsing the bounty feed</DocLink></li>
        <li><DocLink href="/docs/claiming-a-task">Claiming &amp; soft reservation</DocLink></li>
        <li><DocLink href="/docs/submitting-a-pr">Submitting a pull request</DocLink></li>
        <li><DocLink href="/docs/xp-system">How XP works</DocLink></li>
      </UL>
    </Prose>
  ),
  markdown: `# For developers

Forke is developer-only. Your code does the talking — no proposals, no interviews.

## Sign up & connect GitHub

Sign up via the "Do Tasks?" path with Google or GitHub — the developer path is open access, no application required. Connecting GitHub once via OAuth runs a one-time automated analysis of your public activity that seeds your starting level (LVL 1-3); a 60-second skill self-assessment then personalises your feed. You have a 7-day nudge window to connect GitHub if you signed up with Google.

Note: Before your first submission, add your UPI ID in Settings (/settings) — that's where escrow releases land on approval.

## Your journey

1. Browse the feed — see bounties gated to your level, skill tier, and trust score.
2. Claim a task — claiming opens a 20-minute soft reservation. Activate it by creating a branch, your first commit, or pressing "I'm Working" — the task then locks to you and the deadline clock starts.
3. Build in a branch — work in a Forke-managed branch (dev-{username}/task-{id}) inside the Forke mirror, never directly on the owner's repo. Stay inside the file scope.
4. Submit a PR — open a PR and fill the FORKE_SUBMISSION.md template. Automated checks and an AI review run before the owner sees anything.
5. Get paid — on approval, Forke merges upstream, releases escrow to your UPI instantly, and awards XP. The task lands on your public profile.

## Tips for your first task

- Pick something inside your skill tier — a clean first submission boosts trust score.
- Read the acceptance criteria before claiming; scope creep gets auto-flagged.
- Submit early — beating 50% of the deadline earns a +25 XP speed bonus.
- Don't claim what you can't start — abandoning after activation is a strong trust-score negative.

## Keep reading

- Browsing the bounty feed (/docs/browsing-the-feed)
- Claiming & soft reservation (/docs/claiming-a-task)
- Submitting a pull request (/docs/submitting-a-pr)
- How XP works (/docs/xp-system)
`,
}

const forFounders: Article = {
  slug: 'for-founders',
  title: 'For founders',
  description: 'Post scoped tasks, fund escrow, and review a clean verdict instead of raw code.',
  icon: RiBuilding4Fill,
  readTime: '4 min read',
  toc: [
    { id: 'apply', label: 'Apply & get approved' },
    { id: 'post', label: 'Post a task' },
    { id: 'review', label: 'Review & approve' },
    { id: 'commission', label: 'Pricing & commission' },
  ],
  body: (
    <Prose>
      <Lead>
        Need a quick feature or a bug squashed without hiring a freelancer for a week? Post a
        micro-task and get matched with verified developers.
      </Lead>

      <H3 id="apply">Apply &amp; get approved</H3>
      <P>
        Apply via the <strong>&ldquo;Post Tasks?&rdquo;</strong> path and fill the company
        application (name, company, LinkedIn, designation, message). Client access is manually gated
        — a founder personally reviews and approves your application to keep the marketplace trusted
        on both sides. This is deliberate: it&apos;s the difference between Forke and an open job
        board.
      </P>

      <H3 id="post">Post a task</H3>
      <Steps>
        <Step n="1" title="Scope it tightly">
          Title, description, tech stack, budget, time estimate, and the file scope. The tighter
          the scope, the faster and cleaner the result — and the better the AI review works.
        </Step>
        <Step n="2" title="Connect your repo">
          Forke creates a mirror in the <Tag>forke-workspaces</Tag> org and prepares a task branch.
          Your repo is never touched directly — Forke only reads it and merges back a single clean
          PR at the end.
        </Step>
        <Step n="3" title="Fund escrow">
          Deposit the budget via Razorpay. Funds are held in escrow until you approve — so developers
          know the money is provably there before they start.
        </Step>
      </Steps>
      <Note>
        You don&apos;t browse developer profiles to assign work. You post the task; eligible
        developers claim it. Developers become discoverable <em>after</em> they ship — this keeps
        Forke task-first, not a directory.
      </Note>

      <H3 id="review">Review &amp; approve</H3>
      <P>
        When a submission passes automated + AI checks, you get a <strong>verdict card</strong> — a
        plain-English summary of what changed, with scores and flags, not a wall of diff. Click{' '}
        <strong>Approve</strong> and funds auto-release to the developer&apos;s UPI while Forke merges
        a clean upstream PR; click <strong>Request changes</strong> to send it back with your notes.
        You make a business decision — &ldquo;does this solve my problem?&rdquo; — not a code review.
      </P>

      <H3 id="commission">Pricing &amp; commission</H3>
      <P>
        Forke charges a flat <strong>10% platform commission</strong>. You pay ₹550 for a ₹500 task:
        the developer receives the full ₹500, and Forke keeps ₹50. Simple and transparent — see the
        live <DocLink href="/escrow">Escrow</DocLink> view in your dashboard.
      </P>
      <Note>
        Want the detail behind the verdict card? See{' '}
        <DocLink href="/docs/review-pipeline">the 4-layer review pipeline</DocLink> and{' '}
        <DocLink href="/docs/acceptance-criteria">Writing acceptance criteria</DocLink>.
      </Note>
    </Prose>
  ),
  markdown: `# For founders

Need a quick feature or a bug squashed without hiring a freelancer for a week? Post a micro-task and get matched with verified developers.

## Apply & get approved

Apply via the "Post Tasks?" path and fill the company application (name, company, LinkedIn, designation, message). Client access is manually gated — a founder personally reviews and approves your application to keep the marketplace trusted on both sides.

## Post a task

1. Scope it tightly — title, description, tech stack, budget, time estimate, and the file scope. The tighter the scope, the faster and cleaner the result.
2. Connect your repo — Forke creates a mirror in the forke-workspaces org and prepares a task branch. Your repo is never touched directly.
3. Fund escrow — deposit the budget via Razorpay. Funds are held in escrow until you approve.

Note: You don't browse developer profiles to assign work. You post the task; eligible developers claim it. Developers become discoverable after they ship.

## Review & approve

When a submission passes automated + AI checks, you get a verdict card — a plain-English summary of what changed, with scores and flags, not a wall of diff. Click Approve and funds auto-release to the developer's UPI while Forke merges a clean upstream PR; click Request changes to send it back with your notes.

## Pricing & commission

Forke charges a flat 10% platform commission. You pay Rs 550 for a Rs 500 task: the developer receives the full Rs 500, and Forke keeps Rs 50.

See also: The 4-layer review pipeline (/docs/review-pipeline) and Writing acceptance criteria (/docs/acceptance-criteria).
`,
}

/* ---- Your account ------------------------------------------------ */

const profile: Article = {
  slug: 'profile',
  title: 'Developer profile & proof of work',
  description: 'Your public developer page, activity graph, completed task history, and badges.',
  icon: RiUser3Fill,
  readTime: '2 min read',
  toc: [
    { id: 'public', label: 'Your public profile' },
    { id: 'what', label: "What's on it" },
  ],
  body: (
    <Prose>
      <Lead>Forke must never become &ldquo;LinkedIn 2.0&rdquo;. No fake resumes — only shipped, reviewed, paid work.</Lead>
      <H3 id="public">Your public profile</H3>
      <P>
        Once you reach LVL&nbsp;3 you unlock a custom profile URL (<Tag>forke.space/&#123;username&#125;</Tag>).
        Every approved task appears automatically — you never hand-write an entry. Both you and Forke
        show up as contributors on the owner&apos;s upstream PR, so your work is verifiable on GitHub
        too.
      </P>
      <H3 id="what">What&apos;s on it</H3>
      <UL>
        <li>Each completed task, timestamped and linked to the merged GitHub PR</li>
        <li>Client star rating, XP earned, and the tech used</li>
        <li>Your level, tier badges, and <DocLink href="/docs/levels-and-unlocks">achievements</DocLink></li>
      </UL>
      <Note>
        The north star: <em>&ldquo;Prove skill by shipping. Your profile is your reputation.&rdquo;</em>{' '}
        Recruiter-readable, tamper-proof, and indexable — that&apos;s the long-term vision.
      </Note>
    </Prose>
  ),
  markdown: `# Profile & proof of work

Forke must never become "LinkedIn 2.0". No fake resumes — only shipped, reviewed, paid work.

## Your public profile

Once you reach LVL 3 you unlock a custom profile URL (forke.space/{username}). Every approved task appears automatically — you never hand-write an entry. Both you and Forke show up as contributors on the owner's upstream PR, so your work is verifiable on GitHub too.

## What's on it

- Each completed task, timestamped and linked to the merged GitHub PR
- Client star rating, XP earned, and the tech used
- Your level, tier badges, and achievements

The north star: "Prove skill by shipping. Your profile is your reputation."
`,
}

const githubConnection: Article = {
  slug: 'github-connection',
  title: 'Connecting GitHub & permissions',
  description: 'Why Forke needs GitHub access, what permissions are requested, and how PRs are mapped.',
  icon: RiGitForkFill,
  readTime: '3 min read',
  toc: [
    { id: 'why', label: 'Why GitHub' },
    { id: 'mirror', label: 'Mirror & branch model' },
    { id: 'security', label: 'Built-in safeguards' },
  ],
  body: (
    <Prose>
      <Lead>Forke is Git-native to the core. Connecting GitHub is what sets your starting level and powers the whole submission flow.</Lead>
      <H3 id="why">Why GitHub</H3>
      <P>
        Your account is connected once via OAuth. A one-time analysis of your public activity helps
        seed your starting level (LVL&nbsp;1–3), and from then on every submission flows through
        GitHub. Forke integrates via a <strong>GitHub App</strong> — not broad OAuth tokens — that
        owners install on specific repos. It requests only the minimum permissions:{' '}
        <Tag>contents</Tag> (read/write), <Tag>pull_requests</Tag>, <Tag>checks</Tag>, and{' '}
        <Tag>metadata</Tag>.
      </P>
      <H3 id="mirror">Mirror &amp; branch model</H3>
      <P>
        You never push to an owner&apos;s repository directly. Instead of forking the repo per
        developer (which doesn&apos;t scale), Forke uses <strong>branch-based workspaces inside a
        single mirror</strong>. Forke sits in the middle:
      </P>
      <Visual label="Forke as the orchestration layer" caption="Owner repo → Forke mirror → your branch → PR → merge.">
        <OrchestrationVisual />
      </Visual>
      <H3 id="security">Built-in safeguards</H3>
      <UL>
        <li>Secret scanning blocks commits that add <Tag>.env</Tag> files or hardcoded tokens.</li>
        <li>File-scope validation auto-rejects any diff that touches files outside the task scope.</li>
        <li>Only the Forke system merges — no developer can merge their own work, ever.</li>
      </UL>
    </Prose>
  ),
  markdown: `# GitHub connection

Forke is Git-native to the core. Connecting GitHub is what sets your starting level and powers the whole submission flow.

## Why GitHub

Your account is connected once via OAuth. A one-time analysis of your public activity helps seed your starting level (LVL 1-3), and from then on every submission flows through GitHub. Forke integrates via a GitHub App — not broad OAuth tokens — that owners install on specific repos. It requests only the minimum permissions: contents (read/write), pull_requests, checks, and metadata.

## Mirror & branch model

You never push to an owner's repository directly. Instead of forking the repo per developer (which doesn't scale), Forke uses branch-based workspaces inside a single mirror. Forke sits in the middle:

Owner repo -> Forke mirror (forke-workspaces) -> dev-{username}/task-{id} -> Pull request -> Merge upstream + payout.

## Built-in safeguards

- Secret scanning blocks commits that add .env files or hardcoded tokens.
- File-scope validation auto-rejects any diff that touches files outside the task scope.
- Only the Forke system merges — no developer can merge their own work, ever.
`,
}

const settings: Article = {
  slug: 'account-settings',
  title: 'Account settings & UPI payouts',
  description: 'Manage your profile details, notification preferences, and UPI ID for instant payouts.',
  icon: RiSettings4Fill,
  readTime: '2 min read',
  toc: [
    { id: 'upi', label: 'UPI payout ID' },
    { id: 'notifications', label: 'Notifications' },
  ],
  body: (
    <Prose>
      <Lead>A few things to set up once so payouts and alerts just work.</Lead>
      <H3 id="upi">UPI payout ID</H3>
      <P>
        Add your UPI ID in <DocLink href="/settings">Settings</DocLink> before you submit your first
        task — it&apos;s where escrow releases land on approval. Payouts are instant; there&apos;s
        nothing to withdraw. Higher levels unlock additional payout tiers (intermediate from
        LVL&nbsp;7+).
      </P>
      <H3 id="notifications">Notifications</H3>
      <P>
        Choose what you hear about: claim reminders, review verdicts, payout confirmations, and
        level-ups. The in-app <DocLink href="/notifications">notification bell</DocLink> mirrors
        these, and you can manage delivery preferences in Settings.
      </P>
    </Prose>
  ),
  markdown: `# Settings & payouts setup

A few things to set up once so payouts and alerts just work.

## UPI payout ID

Add your UPI ID in Settings (/settings) before you submit your first task — it's where escrow releases land on approval. Payouts are instant; there's nothing to withdraw. Higher levels unlock additional payout tiers (intermediate from LVL 7+).

## Notifications

Choose what you hear about: claim reminders, review verdicts, payout confirmations, and level-ups. The in-app notification bell (/notifications) mirrors these, and you can manage delivery preferences in Settings.
`,
}

/* ---- Bounties & workflow ----------------------------------------- */

const browsingTheFeed: Article = {
  slug: 'browsing-the-feed',
  title: 'Browsing the bounty feed',
  description: 'How to filter tasks by tech stack, level, reward, and estimated completion time.',
  icon: RiListCheck3,
  readTime: '3 min read',
  popular: true,
  toc: [
    { id: 'feed', label: 'How the feed is built' },
    { id: 'difficulty', label: 'Reading a bounty card' },
  ],
  body: (
    <Prose>
      <Lead>You only see what you&apos;re eligible to claim — no scrolling past locked work.</Lead>
      <H3 id="feed">How the feed is built</H3>
      <P>
        The <DocLink href="/tasks">feed</DocLink> filters by the three access dimensions — level,
        skill tier, and trust score. The minimum level to claim a bounty is the highest skill tier
        among its tags, so a task tagged <Tag>Next.js</Tag> + <Tag>Database</Tag> gates higher than
        one tagged <Tag>HTML/CSS</Tag>. You can additionally filter by skill tag and budget; filter
        state lives in the URL so feeds are shareable.
      </P>
      <H3 id="difficulty">Reading a bounty card</H3>
      <P>Every card surfaces the task difficulty matrix at a glance:</P>
      <Table
        head={['Attribute', 'Example']}
        rows={[
          ['Domain', 'Frontend'],
          ['Skill tier', '2 (Intermediate)'],
          ['Estimated time', '3 hours'],
          ['Risk level', 'Low / Medium / High'],
          ['Criticality', 'Personal / Startup / Production'],
          ['XP reward', '150 XP'],
          ['Budget', '₹800'],
        ]}
      />
      <Note>
        Criticality drives how strictly a submission is reviewed — a Production task on auth or
        payments routes to stricter risk scoring than a Personal one. See{' '}
        <DocLink href="/docs/review-pipeline">the review pipeline</DocLink>.
      </Note>
    </Prose>
  ),
  markdown: `# Browsing the bounty feed

You only see what you're eligible to claim — no scrolling past locked work.

## How the feed is built

The feed (/tasks) filters by the three access dimensions — level, skill tier, and trust score. The minimum level to claim a bounty is the highest skill tier among its tags, so a task tagged Next.js + Database gates higher than one tagged HTML/CSS. You can additionally filter by skill tag and budget; filter state lives in the URL so feeds are shareable.

## Reading a bounty card

Every card surfaces the task difficulty matrix at a glance:

- Domain: Frontend
- Skill tier: 2 (Intermediate)
- Estimated time: 3 hours
- Risk level: Low / Medium / High
- Criticality: Personal / Startup / Production
- XP reward: 150 XP
- Budget: Rs 800

Note: Criticality drives how strictly a submission is reviewed — a Production task on auth or payments routes to stricter risk scoring than a Personal one.
`,
}

const claiming: Article = {
  slug: 'claiming-a-task',
  title: 'Claiming a task & soft reservations',
  description: 'How task reservation works, the 20-minute timer, and what happens when you activate.',
  icon: RiCursorFill,
  readTime: '3 min read',
  toc: [
    { id: 'soft', label: 'Soft reservation' },
    { id: 'activate', label: 'Activating a claim' },
    { id: 'lifecycle', label: 'Task lifecycle' },
    { id: 'queue', label: 'Queue & fast-fail' },
  ],
  body: (
    <Prose>
      <Lead>Claiming is designed for velocity — tasks don&apos;t sit reserved by someone who isn&apos;t working.</Lead>
      <P>
        The mental shift: posting a task on Forke shouldn&apos;t feel like &ldquo;I assigned this and
        now I wait.&rdquo; It should feel like &ldquo;I posted this to a managed engineering system
        — it will get done.&rdquo; The claim engine is what makes that true.
      </P>
      <H3 id="soft">Soft reservation</H3>
      <P>
        Claiming a bounty gives you a <strong>20-minute soft reservation</strong>, not instant
        ownership. It&apos;s yours to start, but it isn&apos;t locked yet — other developers see
        &ldquo;Reserved — 19:43 remaining.&rdquo; Twenty minutes is long enough to actually begin, but
        short enough that an impulse claim that goes nowhere returns to the marketplace fast.
      </P>
      <H3 id="activate">Activating a claim</H3>
      <P>
        Activate within the window by creating a branch, making your first commit, opening a draft
        PR, or pressing <strong>&ldquo;I&apos;m Working&rdquo;</strong>. The task then locks to you,
        you earn <Tag>+5 XP</Tag>, and — critically — <strong>the deadline clock only starts at
        activation, not at claim</strong>. That&apos;s fair to developers who think before starting,
        and ruthless to claim-and-forget.
      </P>
      <H3 id="lifecycle">Task lifecycle</H3>
      <P>Every task moves through a clear state machine:</P>
      <Table head={['State', 'Meaning']} rows={STATE_ROWS} />
      <H3 id="queue">Queue &amp; fast-fail</H3>
      <P>
        If you don&apos;t activate in time, the soft reservation expires and the next developer in
        the <strong>warm queue</strong> gets their turn — they&apos;ve already been previewing the
        task, so they can often start within minutes. While a task is in progress, Forke silently
        watches for failing signals (no commits, repeated failed builds, scope creep) and steps in
        early. Abandoning a task <em>after</em> activating is a strong negative on your{' '}
        <DocLink href="/docs/trust-score">trust score</DocLink>.
      </P>
      <Note>Don&apos;t claim what you can&apos;t start — claim, then immediately activate.</Note>
    </Prose>
  ),
  markdown: `# Claiming & soft reservation

Claiming is designed for velocity — tasks don't sit reserved by someone who isn't working.

The mental shift: posting a task on Forke shouldn't feel like "I assigned this and now I wait." It should feel like "I posted this to a managed engineering system — it will get done."

## Soft reservation

Claiming a bounty gives you a 20-minute soft reservation, not instant ownership. It's yours to start, but it isn't locked yet — other developers see "Reserved — 19:43 remaining." Twenty minutes is long enough to actually begin, but short enough that an impulse claim that goes nowhere returns to the marketplace fast.

## Activating a claim

Activate within the window by creating a branch, making your first commit, opening a draft PR, or pressing "I'm Working". The task then locks to you, you earn +5 XP, and — critically — the deadline clock only starts at activation, not at claim.

## Task lifecycle

Every task moves through a clear state machine:

- OPEN: Anyone eligible can claim it
- RESERVED: Soft reservation held; 20-minute activation timer running
- IN_PROGRESS: Activated and locked to one developer; deadline clock running
- UNDER_REVIEW: PR submitted; automated checks + AI review running
- AWAITING_OWNER: Passed the pipeline; verdict card live for the founder
- COMPLETED: Approved, merged upstream, escrow released, XP awarded
- REVISION_REQUESTED: Sent back to the same developer for a new submission
- EXPIRED: Deadline passed with no submission; returns to OPEN, trust penalty

## Queue & fast-fail

If you don't activate in time, the soft reservation expires and the next developer in the warm queue gets their turn — they've already been previewing the task, so they can often start within minutes. While a task is in progress, Forke silently watches for failing signals (no commits, repeated failed builds, scope creep) and steps in early. Abandoning a task after activating is a strong negative on your trust score.

Note: Don't claim what you can't start — claim, then immediately activate.
`,
}

const branchWorkflow: Article = {
  slug: 'branch-workflow',
  title: 'Forke branch workflow',
  description: 'How Forke creates dedicated working branches and why developers never push directly to main.',
  icon: RiGitBranchFill,
  readTime: '4 min read',
  toc: [
    { id: 'where', label: 'Where you work' },
    { id: 'scope', label: 'Stay in scope' },
    { id: 'principles', label: 'Three principles' },
  ],
  body: (
    <Prose>
      <Lead>You get an isolated, Forke-managed branch. Just code.</Lead>
      <H3 id="where">Where you work</H3>
      <P>
        After activating, work in <Tag>dev-&#123;username&#125;/task-&#123;id&#125;</Tag> inside the
        Forke mirror (the <Tag>forke-workspaces</Tag> org). Your branch is created off the task base
        branch (<Tag>task/&#123;id&#125;-&#123;slug&#125;</Tag>) — when you&apos;re done, your PR targets
        the task branch, never <Tag>main</Tag>. PRs aimed at the wrong branch are rejected
        automatically.
      </P>
      <H3 id="scope">Stay in scope</H3>
      <P>
        Each task defines an allowed file scope. Forke validates every PR diff against it and{' '}
        <strong>auto-rejects</strong> anything that touches files outside the allowed paths or inside
        excluded ones (like <Tag>.env</Tag>, auth, or secrets). This is the single most important
        security feature in the submission pipeline — and it protects you too, by keeping your
        changes focused.
      </P>
      <H3 id="principles">Three principles</H3>
      <OL>
        <li><strong>Never ZIP uploads.</strong> Every submission lives in a PR. No exceptions.</li>
        <li><strong>Forke is the middle layer.</strong> Developers never touch owner repos directly.</li>
        <li><strong>AI assists, humans decide.</strong> AI generates the verdict; owners make the call.</li>
      </OL>
      <Note>
        Task branches are ephemeral — Forke deletes them within 24 hours of resolution and archives
        the logs for your portfolio.
      </Note>
    </Prose>
  ),
  markdown: `# The branch workflow

You get an isolated, Forke-managed branch. Just code.

## Where you work

After activating, work in dev-{username}/task-{id} inside the Forke mirror (the forke-workspaces org). Your branch is created off the task base branch (task/{id}-{slug}) — when you're done, your PR targets the task branch, never main. PRs aimed at the wrong branch are rejected automatically.

## Stay in scope

Each task defines an allowed file scope. Forke validates every PR diff against it and auto-rejects anything that touches files outside the allowed paths or inside excluded ones (like .env, auth, or secrets). This is the single most important security feature in the submission pipeline — and it protects you too, by keeping your changes focused.

## Three principles

1. Never ZIP uploads. Every submission lives in a PR. No exceptions.
2. Forke is the middle layer. Developers never touch owner repos directly.
3. AI assists, humans decide. AI generates the verdict; owners make the call.

Note: Task branches are ephemeral — Forke deletes them within 24 hours of resolution and archives the logs for your portfolio.
`,
}

const submittingPr: Article = {
  slug: 'submitting-a-pr',
  title: 'Submitting a pull request',
  description: 'How to link your PR, run pre-submission validation, and trigger the automated review pipeline.',
  icon: RiGitPullRequestFill,
  readTime: '4 min read',
  popular: true,
  toc: [
    { id: 'template', label: 'FORKE_SUBMISSION.md' },
    { id: 'after', label: 'After you submit' },
  ],
  body: (
    <Prose>
      <Lead>A submission isn&apos;t just code — it&apos;s a structured PR the review pipeline can reason about.</Lead>
      <H3 id="template">FORKE_SUBMISSION.md</H3>
      <P>
        Forke auto-generates this template in your branch. Fill it in before opening the PR — it has
        five sections:
      </P>
      <UL>
        <li><Tag>What I Changed</Tag> — required, minimum two bullet points</li>
        <li><Tag>Why I Made These Choices</Tag> — required, explain key decisions</li>
        <li><Tag>Testing Performed</Tag> — required</li>
        <li><Tag>Known Limitations</Tag> — optional but encouraged</li>
        <li><Tag>Screenshots / Demo</Tag> — optional, strongly encouraged for UI tasks</li>
      </UL>
      <P>
        This file does three jobs: it forces you to think about what you built, it gives the AI
        reviewer structured context, and it becomes part of your portfolio entry. A missing or empty
        required section fails the automated layer <strong>before any AI is called</strong>.
      </P>
      <H3 id="after">After you submit</H3>
      <P>The moment the PR opens, the pipeline runs in order:</P>
      <OL>
        <li>Automated validation (build, tests, lint, type-check, security scan, scope check)</li>
        <li>Context assembly (task, acceptance criteria, diff, repo patterns, your history)</li>
        <li>AI review → a structured verdict</li>
        <li>Risk scoring → routes to auto-approve, owner review, or trusted reviewer</li>
      </OL>
      <P>
        Track everything from <DocLink href="/submissions">My Submissions</DocLink>, grouped by
        Active, Completed, and Revision Requested.
      </P>
      <Note>
        Full detail in <DocLink href="/docs/review-pipeline">the review pipeline</DocLink>.
      </Note>
    </Prose>
  ),
  markdown: `# Submitting a pull request

A submission isn't just code — it's a structured PR the review pipeline can reason about.

## FORKE_SUBMISSION.md

Forke auto-generates this template in your branch. Fill it in before opening the PR — it has five sections:

- What I Changed — required, minimum two bullet points
- Why I Made These Choices — required, explain key decisions
- Testing Performed — required
- Known Limitations — optional but encouraged
- Screenshots / Demo — optional, strongly encouraged for UI tasks

This file does three jobs: it forces you to think about what you built, it gives the AI reviewer structured context, and it becomes part of your portfolio entry. A missing or empty required section fails the automated layer before any AI is called.

## After you submit

The moment the PR opens, the pipeline runs in order:

1. Automated validation (build, tests, lint, type-check, security scan, scope check)
2. Context assembly (task, acceptance criteria, diff, repo patterns, your history)
3. AI review -> a structured verdict
4. Risk scoring -> routes to auto-approve, owner review, or trusted reviewer

Track everything from My Submissions (/submissions), grouped by Active, Completed, and Revision Requested.
`,
}

const reviewPipeline: Article = {
  slug: 'review-pipeline',
  title: 'The 4-layer review pipeline',
  description: 'Static analysis, AI test generation, security scanning, and owner verdict card generation.',
  icon: RiShieldCheckFill,
  readTime: '5 min read',
  popular: true,
  toc: [
    { id: 'layers', label: 'The four layers' },
    { id: 'l1', label: 'Layer 1 — Automated' },
    { id: 'l2', label: 'Layer 2 — Context' },
    { id: 'l3', label: 'Layer 3 — AI review' },
    { id: 'l4', label: 'Layer 4 — Risk routing' },
  ],
  body: (
    <Prose>
      <Lead>Every PR runs the same gauntlet before a founder ever sees it.</Lead>
      <P>
        The framing matters: AI is an <strong>intelligent context generator</strong>, not a judge.
        It summarises, flags concerns with evidence, and scores against structured criteria — but in
        V1 it never autonomously approves or rejects. The owner makes the final call.
      </P>
      <H3 id="layers">The four layers</H3>
      <Visual label="Review pipeline" caption="Each layer can stop a submission before it reaches the owner.">
        <PipelineVisual />
      </Visual>
      <H3 id="l1">Layer 1 — Automated validation</H3>
      <P>
        Build, tests, lint, type-check, security scan (Semgrep), file-scope validation, and the{' '}
        <Tag>FORKE_SUBMISSION.md</Tag> completeness check — all run in a sandboxed container in ~30
        seconds. Any failure is an auto-reject with the specific reason shown to you.{' '}
        <strong>No AI is called</strong>, so a failing build costs nothing. This is the biggest cost
        saving and the fastest quality gate.
      </P>
      <H3 id="l2">Layer 2 — Context assembly</H3>
      <P>
        Forke builds the AI prompt from exactly what matters: the task description and acceptance
        criteria, the git diff (changed files only — never the whole repo), repo patterns detected
        when the mirror was created, the automated results, and your trust score and history. Good
        context is what makes the verdict meaningful.
      </P>
      <H3 id="l3">Layer 3 — AI review</H3>
      <P>
        Claude reads the assembled context and returns a strict JSON verdict: task-completion score
        (0–10), code-quality score (0–10), architecture fit (0–10), security status, up to five
        concrete issues, up to three positives, a plain-English summary, a recommendation, and a
        confidence score. Low confidence escalates to a human regardless of the other scores.
      </P>
      <H3 id="l4">Layer 4 — Risk scoring</H3>
      <P>
        A composite 0–100 score from the AI verdict, task criticality, and your history decides
        routing:
      </P>
      <Table
        head={['Risk score', 'Routing']}
        rows={[
          ['0–30', 'Auto-approve eligible (low-risk, simple tasks)'],
          ['31–70', 'Owner review — verdict card shown, owner decides'],
          ['71–100', 'Trusted reviewer queue first, then owner'],
        ]}
      />
      <Note>
        Auto-approval is <strong>off by default in V1</strong> — it&apos;s enabled only after the
        scoring is validated on 500+ tasks. Until then, every submission reaches a human.
      </Note>
    </Prose>
  ),
  markdown: `# The 4-layer review pipeline

Every PR runs the same gauntlet before a founder ever sees it.

The framing matters: AI is an intelligent context generator, not a judge. It summarises, flags concerns with evidence, and scores against structured criteria — but in V1 it never autonomously approves or rejects. The owner makes the final call.

## The four layers

L1 Automated validation -> L2 Context assembly -> L3 AI review -> L4 Risk scoring.

## Layer 1 — Automated validation

Build, tests, lint, type-check, security scan (Semgrep), file-scope validation, and the FORKE_SUBMISSION.md completeness check — all run in a sandboxed container in ~30 seconds. Any failure is an auto-reject with the specific reason shown to you. No AI is called, so a failing build costs nothing.

## Layer 2 — Context assembly

Forke builds the AI prompt from exactly what matters: the task description and acceptance criteria, the git diff (changed files only — never the whole repo), repo patterns detected when the mirror was created, the automated results, and your trust score and history.

## Layer 3 — AI review

Claude reads the assembled context and returns a strict JSON verdict: task-completion score (0-10), code-quality score (0-10), architecture fit (0-10), security status, up to five concrete issues, up to three positives, a plain-English summary, a recommendation, and a confidence score. Low confidence escalates to a human regardless of the other scores.

## Layer 4 — Risk scoring

A composite 0-100 score from the AI verdict, task criticality, and your history decides routing:

- 0-30: Auto-approve eligible (low-risk, simple tasks)
- 31-70: Owner review — verdict card shown, owner decides
- 71-100: Trusted reviewer queue first, then owner

Note: Auto-approval is off by default in V1 — it's enabled only after the scoring is validated on 500+ tasks.
`,
}

const verdictCard: Article = {
  slug: 'verdict-card',
  title: 'Understanding the AI verdict card',
  description: 'How Forke translates code diffs into plain-English acceptance signals for task owners.',
  icon: RiRobotFill,
  readTime: '3 min read',
  toc: [
    { id: 'what', label: "What's on the card" },
    { id: 'decision', label: 'Approve or request changes' },
  ],
  body: (
    <Prose>
      <Lead>The verdict card is the founder&apos;s review surface — designed to be read in under a minute.</Lead>
      <H3 id="what">What&apos;s on the card</H3>
      <Visual label="Verdict card" caption="Scores, flags, and a plain-English summary — not a wall of diff.">
        <VerdictVisual />
      </Visual>
      <H3 id="decision">Approve or request changes</H3>
      <P>
        You&apos;re making a business decision — &ldquo;does this solve my problem?&rdquo; — not a
        line-by-line code review. Approving auto-releases escrow to the developer&apos;s UPI and
        triggers a clean, squash-merged upstream PR on your repo (you never see the messy
        intermediate commits). Requesting changes sends the PR back with your notes; a revision
        before approval costs the developer <Tag>-20 XP</Tag>.
      </P>
    </Prose>
  ),
  markdown: `# The verdict card

The verdict card is the founder's review surface — designed to be read in under a minute.

## What's on the card

A clean, non-technical summary: pass/fail badges for build, tests, and scope; the AI summary in plain English; task-coverage and code-quality score bars; flagged issues; and a recommendation. Not a wall of diff.

## Approve or request changes

You're making a business decision — "does this solve my problem?" — not a line-by-line code review. Approving auto-releases escrow to the developer's UPI and triggers a clean, squash-merged upstream PR on your repo (you never see the messy intermediate commits). Requesting changes sends the PR back with your notes; a revision before approval costs the developer -20 XP.
`,
}

const acceptanceCriteria: Article = {
  slug: 'acceptance-criteria',
  title: 'Writing clear acceptance criteria',
  description: 'Best practices for founders writing task specs that AI reviewers and developers can test against.',
  icon: RiListCheck3,
  readTime: '4 min read',
  toc: [
    { id: 'why', label: 'Why it matters' },
    { id: 'how', label: 'How to write them' },
  ],
  body: (
    <Prose>
      <Lead>Acceptance criteria are part of the context the AI reviews against — vague criteria mean vague verdicts.</Lead>
      <H3 id="why">Why it matters</H3>
      <P>
        Layer 2 assembles the task description, acceptance criteria, and diff for the AI. Concrete,
        checkable criteria are what let the verdict say &ldquo;done&rdquo; with confidence.
      </P>
      <H3 id="how">How to write them</H3>
      <UL>
        <li>State observable outcomes (&ldquo;form shows an inline error on invalid email&rdquo;).</li>
        <li>Name the file scope so out-of-scope edits get flagged automatically.</li>
        <li>Keep each criterion independently verifiable.</li>
        <li>Call out what must <em>not</em> change (&ldquo;no changes to authentication logic&rdquo;).</li>
      </UL>
      <Note>
        Pair tight criteria with a tight file scope — together they make scope creep impossible and
        revisions rare. See <DocLink href="/docs/branch-workflow">the branch workflow</DocLink>.
      </Note>
    </Prose>
  ),
  markdown: `# Writing acceptance criteria

Acceptance criteria are part of the context the AI reviews against — vague criteria mean vague verdicts.

## Why it matters

Layer 2 assembles the task description, acceptance criteria, and diff for the AI. Concrete, checkable criteria are what let the verdict say "done" with confidence.

## How to write them

- State observable outcomes ("form shows an inline error on invalid email").
- Name the file scope so out-of-scope edits get flagged automatically.
- Keep each criterion independently verifiable.
- Call out what must not change ("no changes to authentication logic").

Note: Pair tight criteria with a tight file scope — together they make scope creep impossible and revisions rare.
`,
}

const xpSystem: Article = {
  slug: 'xp-system',
  title: 'The XP system & calculations',
  description: 'How XP is earned from completed tasks, speed bonuses, clean reviews, and streak multipliers.',
  icon: RiTrophyFill,
  readTime: '3 min read',
  popular: true,
  toc: [
    { id: 'earn', label: 'Earning XP' },
    { id: 'base', label: 'Base XP by budget' },
    { id: 'streaks', label: 'Streaks & bonuses' },
  ],
  body: (
    <Prose>
      <Lead>XP measures platform experience and consistency — not raw skill.</Lead>
      <H3 id="earn">Earning XP</H3>
      <UL>
        <li>Approved tasks (base XP by budget tier)</li>
        <li>Speed bonus: submit before 50% of the deadline (<Tag>+25 XP</Tag>)</li>
        <li>Ratings: 5★ (<Tag>+30 XP</Tag>), 4★ (<Tag>+10 XP</Tag>)</li>
        <li>Claim &amp; activate (<Tag>+5 XP</Tag>)</li>
        <li>Revision requested before approval (<Tag>-20 XP</Tag>)</li>
      </UL>
      <H3 id="base">Base XP by budget</H3>
      <P>
        Bigger, higher-stakes tasks award more base XP, so your level rises in step with the
        complexity of work you take on:
      </P>
      <Table
        head={['Budget range', 'Base XP']}
        rows={[
          ['₹100–₹399', '50 XP'],
          ['₹400–₹899', '100 XP'],
          ['₹900–₹2,499', '200 XP'],
          ['₹2,500+', '350 XP'],
        ]}
      />
      <P>
        A worked example: you ship a ₹600 task (100 base XP), beat the halfway mark on the deadline
        (+25), and the founder leaves 5★ (+30) — plus the +5 you earned activating the claim. That
        single task nets <strong>160 XP</strong>. Had a revision been requested first, you&apos;d lose
        20 of it.
      </P>
      <H3 id="streaks">Streaks &amp; bonuses</H3>
      <P>
        A daily login streak adds <Tag>+5–100 XP</Tag> at milestones, and from LVL&nbsp;10 you unlock
        XP streak multipliers. Cumulative XP thresholds climb steadily — LVL&nbsp;2 needs 200 XP total,
        LVL&nbsp;5 needs 1,800, LVL&nbsp;10 needs 9,200, and LVL&nbsp;15 needs 26,000. See{' '}
        <DocLink href="/docs/levels-and-unlocks">levels &amp; unlocks</DocLink> and the full{' '}
        <DocLink href="/levels">Levels page</DocLink>.
      </P>
    </Prose>
  ),
  markdown: `# How XP works

XP measures platform experience and consistency — not raw skill.

## Earning XP

- Approved tasks (base XP by budget tier)
- Speed bonus: submit before 50% of the deadline (+25 XP)
- Ratings: 5 stars (+30 XP), 4 stars (+10 XP)
- Claim & activate (+5 XP)
- Revision requested before approval (-20 XP)

## Base XP by budget

Bigger, higher-stakes tasks award more base XP, so your level rises in step with the complexity of work you take on:

- Rs 100-399: 50 XP
- Rs 400-899: 100 XP
- Rs 900-2,499: 200 XP
- Rs 2,500+: 350 XP

A worked example: you ship a Rs 600 task (100 base XP), beat the halfway mark on the deadline (+25), and the founder leaves 5 stars (+30) — plus the +5 you earned activating the claim. That single task nets 160 XP. Had a revision been requested first, you'd lose 20 of it.

## Streaks & bonuses

A daily login streak adds +5-100 XP at milestones, and from LVL 10 you unlock XP streak multipliers. Cumulative XP thresholds climb steadily — LVL 2 needs 200 XP total, LVL 5 needs 1,800, LVL 10 needs 9,200, and LVL 15 needs 26,000.

See also: Levels & unlocks (/docs/levels-and-unlocks) and the Levels page (/levels).
`,
}

const levelsAndUnlocks: Article = {
  slug: 'levels-and-unlocks',
  title: 'Levels (1-25) & feature unlocks',
  description: 'Full tier breakdown from Level 1 Newcomer to Level 25 Forke Legend and what each tier unlocks.',
  icon: RiStackFill,
  readTime: '4 min read',
  popular: true,
  toc: [
    { id: 'tiers', label: 'The five tiers' },
    { id: 'unlocks', label: 'Level unlocks' },
    { id: 'achievements', label: 'Achievements' },
    { id: 'prestige', label: 'Prestige' },
  ],
  body: (
    <Prose>
      <Lead>Levels unlock platform privileges. Technical access is separate — that&apos;s skill tracks.</Lead>
      <H3 id="tiers">The five tiers</H3>
      <P>
        25 levels span 5 tiers, each with its own identity titles — from <em>Newcomer</em> at
        LVL&nbsp;1 to <em>Forke Legend</em> at LVL&nbsp;25.
      </P>
      <Table head={['Tier', 'Levels', 'Titles', 'Sample unlocks']} rows={TIER_ROWS} />
      <H3 id="unlocks">Level unlocks</H3>
      <Table
        head={['Level', 'Unlock']}
        rows={[
          ['3', 'Public profile URL'],
          ['5', 'Team task applications'],
          ['7', 'Intermediate payout tiers'],
          ['10', 'XP streak multipliers'],
          ['12', 'Priority task queue'],
          ['15', 'Elite bounty + reviewer eligibility (Trust ≥ 90%)'],
          ['18', 'Team lead eligibility'],
          ['20', 'Mentor access'],
          ['25', 'Private invite-only projects'],
        ]}
      />
      <Note>
        Want the full 25-level breakdown with XP thresholds? See the dedicated{' '}
        <DocLink href="/levels">Levels page</DocLink>.
      </Note>
      <H3 id="achievements">Achievements</H3>
      <P>Collectible, public badges that show up on your profile:</P>
      <Table head={['Achievement', 'Requirement']} rows={ACHIEVEMENT_ROWS} />
      <H3 id="prestige">Prestige</H3>
      <P>
        After LVL&nbsp;25, prestige resets XP while granting permanent status — from{' '}
        <em>Ascended Developer</em> (animated border) through <em>Ghost in Production</em>,{' '}
        <em>Legendary Shipper</em>, and <em>Kernel Lord</em>, up to <em>Architect of Chaos</em>
        {' '}(elite leaderboard + custom badge).
      </P>
    </Prose>
  ),
  markdown: `# Levels & unlocks

Levels unlock platform privileges. Technical access is separate — that's skill tracks.

## The five tiers

25 levels span 5 tiers, each with its own identity titles — from Newcomer at LVL 1 to Forke Legend at LVL 25.

- Early Game (LVL 1-5): Newcomer -> Stack Explorer
- Mid Game (LVL 6-10): Code Runner -> Sprint Soldier
- Skilled (LVL 11-15): Merge Specialist -> Feature Shipper
- Elite (LVL 16-20): Runtime Knight -> Production Slayer
- Legend (LVL 21-25): Silicon Phantom -> Forke Legend

## Level unlocks

- LVL 3: Public profile URL
- LVL 5: Team task applications
- LVL 7: Intermediate payout tiers
- LVL 10: XP streak multipliers
- LVL 12: Priority task queue
- LVL 15: Elite bounty + reviewer eligibility (Trust >= 90%)
- LVL 18: Team lead eligibility
- LVL 20: Mentor access
- LVL 25: Private invite-only projects

## Achievements

Collectible, public badges that show up on your profile: First Blood, Bug Hunter, Clutch Commit, Untouchable, Monster Sprint, Streak God, Loot Goblin, Boss Mode, Forke Legend.

## Prestige

After LVL 25, prestige resets XP while granting permanent status — from Ascended Developer (animated border) through Ghost in Production, Legendary Shipper, and Kernel Lord, up to Architect of Chaos (elite leaderboard + custom badge).
`,
}

const skillTracks: Article = {
  slug: 'skill-tracks',
  title: 'Skill tracks & specialization',
  description: 'Frontend, Backend, Fullstack, and DevOps tracks that gate specialized bounty categories.',
  icon: RiCodeSSlashFill,
  readTime: '3 min read',
  toc: [
    { id: 'tracks', label: 'Tracks & tiers' },
    { id: 'gating', label: 'How tags gate tasks' },
  ],
  body: (
    <Prose>
      <Lead>A developer unlocks task complexity through domain-specific progression, independent of level.</Lead>
      <H3 id="tracks">Tracks &amp; tiers</H3>
      <P>Launch tracks: Frontend, Backend, Fullstack, Mobile, AI/ML. Three tiers each:</P>
      <Table
        head={['Tier', 'Meaning']}
        rows={[['1', 'Beginner'], ['2', 'Intermediate'], ['3', 'Advanced']]}
      />
      <H3 id="gating">How tags gate tasks</H3>
      <P>
        Each skill tag maps to a tier (e.g. <Tag>HTML/CSS</Tag> = 1, <Tag>UI/UX</Tag> = 2,{' '}
        <Tag>React</Tag> = 3, <Tag>Next.js</Tag> = 4, <Tag>Database</Tag> = 5). The minimum level to
        claim a task is the highest tier among its tags. Founders can add up to 5 tags; custom tags
        (like <Tag>Stripe</Tag> or <Tag>Prisma</Tag>) default to tier 1.
      </P>
      <Note>
        Skill tier is one of the three access gates, alongside{' '}
        <DocLink href="/docs/levels-and-unlocks">level</DocLink> and{' '}
        <DocLink href="/docs/trust-score">trust score</DocLink> — all three must pass.
      </Note>
    </Prose>
  ),
  markdown: `# Skill tracks

A developer unlocks task complexity through domain-specific progression, independent of level.

## Tracks & tiers

Launch tracks: Frontend, Backend, Fullstack, Mobile, AI/ML. Three tiers each:

- Tier 1: Beginner
- Tier 2: Intermediate
- Tier 3: Advanced

## How tags gate tasks

Each skill tag maps to a tier (e.g. HTML/CSS = 1, UI/UX = 2, React = 3, Next.js = 4, Database = 5). The minimum level to claim a task is the highest tier among its tags. Founders can add up to 5 tags; custom tags (like Stripe or Prisma) default to tier 1.

Note: Skill tier is one of the three access gates, alongside level and trust score — all three must pass.
`,
}

const trustScore: Article = {
  slug: 'trust-score',
  title: 'Trust score & platform standing',
  description: 'How deadline adherence, review pass rates, and dispute history calculate your Trust Score.',
  icon: RiSpeedFill,
  readTime: '4 min read',
  toc: [
    { id: 'what', label: 'What it measures' },
    { id: 'factors', label: 'Factors' },
  ],
  body: (
    <Prose>
      <Lead>Trust score measures reliability, not coding skill — and it&apos;s one of the three access gates.</Lead>
      <H3 id="what">What it measures</H3>
      <P>
        It captures how dependable you are to work with: do you finish, do you hit deadlines, do
        clients rate you well. It can&apos;t be self-reported — it&apos;s computed from your actual
        history.
      </P>
      <H3 id="factors">Factors</H3>
      <Table
        head={['Factor', 'Impact']}
        rows={[
          ['Task completion rate', 'Strong positive'],
          ['Deadline consistency', 'Positive'],
          ['Average client rating', 'Positive'],
          ['Fast first submission', 'Positive'],
          ['AI review score consistency', 'Positive'],
          ['Abandoning after activation', 'Strong negative'],
          ['Repeated revision requests', 'Negative'],
        ]}
      />
      <Note>
        A high trust score unlocks more than access — at LVL&nbsp;15 with Trust&nbsp;≥&nbsp;90% you
        become eligible for the reviewer pathway, and high-level developers get fast-tracked dispute
        resolution. See <DocLink href="/docs/refunds-and-disputes">refunds &amp; disputes</DocLink>.
      </Note>
    </Prose>
  ),
  markdown: `# Trust score

Trust score measures reliability, not coding skill — and it's one of the three access gates.

## What it measures

It captures how dependable you are to work with: do you finish, do you hit deadlines, do clients rate you well. It can't be self-reported — it's computed from your actual history.

## Factors

- Task completion rate: Strong positive
- Deadline consistency: Positive
- Average client rating: Positive
- Fast first submission: Positive
- AI review score consistency: Positive
- Abandoning after activation: Strong negative
- Repeated revision requests: Negative

Note: A high trust score unlocks more than access — at LVL 15 with Trust >= 90% you become eligible for the reviewer pathway, and high-level developers get fast-tracked dispute resolution.
`,
}

const escrow: Article = {
  slug: 'escrow-system',
  title: 'Razorpay escrow & lockup',
  description: 'How owner funds are locked before a bounty goes live and how instant payouts trigger on approval.',
  icon: RiWallet3Fill,
  readTime: '4 min read',
  popular: true,
  toc: [
    { id: 'lifecycle', label: 'Escrow lifecycle' },
    { id: 'payout', label: 'UPI payout' },
  ],
  body: (
    <Prose>
      <Lead>Money is provably in escrow before you start, and releases the instant work is approved.</Lead>
      <P>
        Escrow exists to remove the oldest fear on both sides of freelance work. The developer
        worries &ldquo;will I actually get paid?&rdquo; and the founder worries &ldquo;will I get code
        worth paying for?&rdquo; Forke answers both by holding the money in the middle: the founder
        funds it up front so it&apos;s provably there, and it can only move to the developer when the
        work is approved. Neither side can rug the other.
      </P>
      <H3 id="lifecycle">Escrow lifecycle</H3>
      <Steps>
        <Step n="1" title="Founder funds escrow">
          The task budget is deposited via Razorpay and held by Forke before any developer claims the
          task — so the money is visible and locked from the start.
        </Step>
        <Step n="2" title="You ship & it's approved">
          On approval, Forke merges a clean PR upstream and the escrow release is triggered. If the
          submission is rejected at the automated stage, no money moves at all.
        </Step>
        <Step n="3" title="Instant payout">
          Funds land in your UPI automatically — there&apos;s no withdrawal step, no waiting period,
          and no bank-wire delay.
        </Step>
      </Steps>
      <H3 id="payout">UPI payout</H3>
      <P>
        Payouts go to the UPI ID set in your <DocLink href="/settings">Settings</DocLink> (see{' '}
        <DocLink href="/docs/settings">Settings &amp; payouts setup</DocLink>). Higher levels unlock
        intermediate payout tiers (LVL&nbsp;7+). Forke takes a flat 10% commission from the founder — the
        developer always receives the full task budget. Track live balances in the{' '}
        <DocLink href="/escrow">Escrow</DocLink> and <DocLink href="/earnings">Earnings</DocLink>{' '}
        views.
      </P>
    </Prose>
  ),
  markdown: `# How escrow works

Money is provably in escrow before you start, and releases the instant work is approved.

Escrow exists to remove the oldest fear on both sides of freelance work. The developer worries "will I actually get paid?" and the founder worries "will I get code worth paying for?" Forke answers both by holding the money in the middle: the founder funds it up front so it's provably there, and it can only move to the developer when the work is approved. Neither side can rug the other.

## Escrow lifecycle

1. Founder funds escrow — the task budget is deposited via Razorpay and held by Forke before any developer claims the task, so the money is visible and locked from the start.
2. You ship & it's approved — on approval, Forke merges a clean PR upstream and the escrow release is triggered. If the submission is rejected at the automated stage, no money moves at all.
3. Instant payout — funds land in your UPI automatically; there's no withdrawal step, no waiting period, and no bank-wire delay.

## UPI payout

Payouts go to the UPI ID set in your Settings (/settings). Higher levels unlock intermediate payout tiers (LVL 7+). Forke takes a flat 10% commission from the founder — the developer always receives the full task budget. Track live balances in the Escrow (/escrow) and Earnings (/earnings) views.
`,
}

const refundsDisputes: Article = {
  slug: 'refunds-and-disputes',
  title: 'Refunds, timeouts & disputes',
  description: 'What happens when a task expires, how refund requests work, and the 48-hour dispute window.',
  icon: RiLoopLeftFill,
  readTime: '4 min read',
  toc: [
    { id: 'rejected', label: 'When work is rejected' },
    { id: 'disputes', label: 'Disputes' },
  ],
  body: (
    <Prose>
      <Lead>Because escrow holds the budget, refunds and disputes are about releasing the right way — not chasing money.</Lead>
      <H3 id="rejected">When work is rejected</H3>
      <P>
        If a submission fails automated checks it&apos;s auto-rejected and no escrow moves. If a
        founder requests changes, the developer revises and resubmits — escrow stays held until a
        clean approval.
      </P>
      <H3 id="disputes">Disputes</H3>
      <P>
        Genuine disagreements route through Forke&apos;s dispute process; high-level developers
        (LVL&nbsp;19+) get fast-tracked resolution. Because Forke is the merge intermediary, code is
        never delivered before approval — there&apos;s no &ldquo;chase the money&rdquo; scenario. See
        the full <DocLink href="/refund">refund policy</DocLink> for the formal terms, or reach the
        team via <DocLink href="/support">Support</DocLink>.
      </P>
    </Prose>
  ),
  markdown: `# Refunds & disputes

Because escrow holds the budget, refunds and disputes are about releasing the right way — not chasing money.

## When work is rejected

If a submission fails automated checks it's auto-rejected and no escrow moves. If a founder requests changes, the developer revises and resubmits — escrow stays held until a clean approval.

## Disputes

Genuine disagreements route through Forke's dispute process; high-level developers (LVL 19+) get fast-tracked resolution. Because Forke is the merge intermediary, code is never delivered before approval — there's no "chase the money" scenario.

See also: Refund policy (/refund) and Support (/support).
`,
}

const policies: Article = {
  slug: 'platform-policies',
  title: 'Code of conduct & marketplace rules',
  description: 'Rules against plagiarized code, ghosting claimed tasks, circumventing escrow, or alt accounts.',
  icon: RiFileTextFill,
  readTime: '5 min read',
  toc: [
    { id: 'conduct', label: 'Code of conduct' },
    { id: 'legal', label: 'Legal documents' },
  ],
  body: (
    <Prose>
      <Lead>Forke is a trusted, gated marketplace on both sides. A few rules keep it that way.</Lead>
      <H3 id="conduct">Code of conduct</H3>
      <UL>
        <li>Ship only your own work; plagiarised or AI-dumped submissions are removed.</li>
        <li>Don&apos;t claim tasks you can&apos;t start — abandonment hurts everyone&apos;s velocity.</li>
        <li>Keep communication professional; harassment results in account action.</li>
      </UL>
      <H3 id="legal">Legal documents</H3>
      <UL>
        <li><DocLink href="/terms">Terms of service</DocLink></li>
        <li><DocLink href="/privacy">Privacy policy</DocLink></li>
        <li><DocLink href="/refund">Refund policy</DocLink></li>
      </UL>
    </Prose>
  ),
  markdown: `# Policies & trust and safety

Forke is a trusted, gated marketplace on both sides. A few rules keep it that way.

## Code of conduct

- Ship only your own work; plagiarised or AI-dumped submissions are removed.
- Don't claim tasks you can't start — abandonment hurts everyone's velocity.
- Keep communication professional; harassment results in account action.

## Legal documents

- Terms of service (/terms)
- Privacy policy (/privacy)
- Refund policy (/refund)
`,
}

const support: Article = {
  slug: 'getting-support',
  title: 'Getting help & contacting support',
  description: 'How to open a support ticket, appeal a dispute, or reach the engineering team directly.',
  icon: RiLifebuoyFill,
  readTime: '2 min read',
  toc: [{ id: 'contact', label: 'Contact us' }],
  body: (
    <Prose>
      <Lead>If the docs don&apos;t answer it, we&apos;re a message away.</Lead>
      <H3 id="contact">Contact us</H3>
      <UL>
        <li>In-app: open <DocLink href="/support">Support</DocLink> and send us a message.</li>
        <li>General questions: the <DocLink href="/contact">Contact</DocLink> page.</li>
        <li>Email: <DocLink href="mailto:support@forke.space">support@forke.space</DocLink>.</li>
      </UL>
    </Prose>
  ),
  markdown: `# Getting support

If the docs don't answer it, we're a message away.

## Contact us

- In-app: open Support (/support) and send us a message.
- General questions: the Contact (/contact) page.
- Email: support@forke.space
`,
}

/* ================================================================== */
/*  SECTIONS                                                           */
/* ================================================================== */

export const SECTIONS: DocSection[] = [
  {
    id: 'getting-started',
    label: 'Getting started',
    description: 'Overview of Forke, core principles, and onboarding for developers & founders.',
    icon: RiGraduationCapFill,
    defaultOpen: true,
    articles: [welcome, coreConcepts, forDevelopers, forFounders],
  },
  {
    id: 'account',
    label: 'Your account',
    description: 'Manage your developer profile, proof of work, GitHub connection, and UPI payout settings.',
    icon: RiUser3Fill,
    articles: [profile, githubConnection, settings],
  },
  {
    id: 'bounties',
    label: 'Bounties & workflow',
    description: 'Browse bounties, claim tasks, develop in Forke branches, and submit pull requests.',
    icon: RiGitPullRequestFill,
    articles: [browsingTheFeed, claiming, branchWorkflow, submittingPr],
  },
  {
    id: 'review',
    label: 'Review & quality',
    description: 'The 4-layer review pipeline, automated checks, AI verdict cards, and acceptance criteria.',
    icon: RiShieldCheckFill,
    articles: [reviewPipeline, verdictCard, acceptanceCriteria],
  },
  {
    id: 'progression',
    label: 'Levels, XP & trust',
    description: 'How level progression, XP rewards, skill tracks, and trust scores unlock higher-tier bounties.',
    icon: RiTrophyFill,
    articles: [xpSystem, levelsAndUnlocks, skillTracks, trustScore],
  },
  {
    id: 'payments',
    label: 'Payments & escrow',
    description: 'Razorpay escrow deposits, instant UPI payout processing, refunds, and disputes.',
    icon: RiWallet3Fill,
    articles: [escrow, refundsDisputes],
  },
  {
    id: 'policies',
    label: 'Policies & support',
    description: 'Platform rules, code of conduct, dispute resolution policies, and contact channels.',
    icon: RiLifebuoyFill,
    articles: [policies, support],
  },
]

/* Flattened helpers --------------------------------------------------- */

export const ALL_ARTICLES: Article[] = SECTIONS.flatMap((s) => s.articles)

export const POPULAR_ARTICLES: Article[] = ALL_ARTICLES.filter((a) => a.popular)

export function getArticle(slug: string): Article | undefined {
  return ALL_ARTICLES.find((a) => a.slug === slug)
}

/** Section an article belongs to + previous / next for footer nav. */
export function getArticleContext(slug: string) {
  const index = ALL_ARTICLES.findIndex((a) => a.slug === slug)
  if (index === -1) return null
  const section = SECTIONS.find((s) => s.articles.some((a) => a.slug === slug))!
  return {
    article: ALL_ARTICLES[index],
    section,
    prev: index > 0 ? ALL_ARTICLES[index - 1] : null,
    next: index < ALL_ARTICLES.length - 1 ? ALL_ARTICLES[index + 1] : null,
  }
}

const SITE_URL = 'https://www.forke.space'

/**
 * Full Markdown for a single article, with a small front-matter-style header
 * and an absolute canonical URL. Used by the "Copy page" / "View as Markdown"
 * actions so the page can be handed to an LLM or read as plain text.
 */
export function getArticleMarkdown(slug: string): string | null {
  const article = getArticle(slug)
  if (!article) return null
  const url = `${SITE_URL}/docs/${article.slug}`
  return `<!-- Source: ${url} -->
> ${article.description}

${article.markdown.trim()}

---
Source: ${url}
`
}

/** Markdown index of the whole docs site — used for the /docs home page export. */
export function getDocsIndexMarkdown(): string {
  const lines: string[] = [
    `<!-- Source: ${SITE_URL}/docs -->`,
    '# Forke Docs',
    '',
    'Everything about shipping bounties, getting paid, and the systems that keep the marketplace fair — for developers and founders alike.',
    '',
  ]
  for (const section of SECTIONS) {
    lines.push(`## ${section.label}`, '')
    for (const a of section.articles) {
      lines.push(`- [${a.title}](${SITE_URL}/docs/${a.slug}) — ${a.description}`)
    }
    lines.push('')
  }
  lines.push('---', `Source: ${SITE_URL}/docs`, '')
  return lines.join('\n')
}

/* ================================================================== */
/*  PRODUCT VISUALS — mock UI on the gradient backdrop                 */
/* ================================================================== */

function LoopVisual() {
  const steps = [
    { icon: RiListCheck3, label: 'Browse' },
    { icon: RiCursorFill, label: 'Claim' },
    { icon: RiGitBranchFill, label: 'Build' },
    { icon: RiGitPullRequestFill, label: 'Submit' },
    { icon: RiShieldCheckFill, label: 'Reviewed' },
    { icon: RiWallet3Fill, label: 'Paid' },
  ]
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {steps.map((s, i) => {
        const Icon = s.icon
        return (
          <React.Fragment key={s.label}>
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/25 bg-accent/[0.06] text-accent">
                <Icon className="h-5 w-5" strokeWidth={1.6} />
              </div>
              <span className="font-mono text-[11px] text-white/55">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight className="mb-5 hidden h-4 w-4 text-white/20 sm:inline" strokeWidth={1.7} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

function OrchestrationVisual() {
  const rows = [
    'Owner repo',
    'Forke mirror  ·  forke-workspaces',
    'dev-{username}/task-{id}',
    'Pull request · review pipeline',
    'Merge · upstream PR · payout',
  ]
  return (
    <div className="mx-auto max-w-md space-y-2">
      {rows.map((r, i) => (
        <div key={r} className="flex flex-col items-center gap-2">
          <div
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-center font-mono text-[12px] text-white/70"
          >
            {r}
          </div>
          {i < rows.length - 1 && (
            <ArrowDown className="h-3.5 w-3.5 text-accent/50" strokeWidth={1.7} />
          )}
        </div>
      ))}
    </div>
  )
}

function PipelineVisual() {
  const layers = [
    { n: 'L1', label: 'Automated validation', note: 'build · tests · lint · scope · security' },
    { n: 'L2', label: 'Context assembly', note: 'task · criteria · diff · history' },
    { n: 'L3', label: 'AI review', note: 'structured verdict via Claude' },
    { n: 'L4', label: 'Risk scoring', note: 'auto-approve · owner · reviewer' },
  ]
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.07] sm:grid-cols-2">
      {layers.map((l) => (
        <div key={l.n} className="bg-[#0a0a0c] p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-accent/[0.12] px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent">
              {l.n}
            </span>
            <span className="text-sm font-medium text-white">{l.label}</span>
          </div>
          <p className="mt-1.5 font-mono text-[11px] text-white/40">{l.note}</p>
        </div>
      ))}
    </div>
  )
}

function VerdictVisual() {
  return (
    <div className="mx-auto max-w-sm rounded-xl border border-white/[0.08] bg-[#0a0a0c] p-5 text-left shadow-2xl">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-widest text-white/35">Verdict</span>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/[0.1] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
          Recommend approve
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          ['Task completion', '9/10'],
          ['Code quality', '8/10'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="font-mono text-[10px] text-white/40">{k}</div>
            <div className="mt-1 text-lg font-semibold text-white">{v}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[13px] leading-relaxed text-white/55">
        Implements inline email validation and matches the existing form patterns. No security
        flags. One minor: missing a loading state on submit.
      </p>
    </div>
  )
}
