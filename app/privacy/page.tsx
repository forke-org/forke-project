import React from 'react'
import { Metadata } from 'next'
import Navbar from '@/components/shared/Navbar'
import Footer from '@/components/shared/Footer'
import { buildOpenGraph, buildTwitter } from '@/lib/utils/og'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Read the Forke Privacy Policy to understand how we collect, use, and protect your data.',
  alternates: { canonical: '/privacy' },
  openGraph: buildOpenGraph({
    title: 'Privacy Policy | Forke',
    description: 'How Forke collects, uses, and protects your data.',
    url: 'https://www.forke.space/privacy',
  }),
  twitter: buildTwitter({
    title: 'Privacy Policy | Forke',
    description: 'How Forke collects, uses, and protects your data.',
  }),
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white/80 selection:bg-accent/20 selection:text-accent">
      <Navbar />

      {/* Header */}
      <header className="pt-32 md:pt-40 pb-16 px-6 max-w-3xl mx-auto">
        <p className="ui-eyebrow lowercase mb-4">
          Privacy & Data Protection
        </p>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-[-0.03em] text-white mb-4">
            Privacy <span className="font-serif italic font-normal text-accent">Policy</span>
          </h1>
        <p className="text-sm text-white/30 font-mono">
          Last Updated: June 2026 · Effective Globally
        </p>
      </header>

      {/* Content */}
      <main className="px-6 max-w-3xl mx-auto pb-24 space-y-12">

        {/* Intro */}
        <div className="border-l-2 border-accent/20 pl-6">
          <p className="text-base text-white/60 leading-relaxed">
            At Forke, your privacy matters. This Privacy Policy explains how we collect, use, store, and protect your information when you use the Forke platform, compliant with the India Digital Personal Data Protection (DPDP) Act, 2023 and modern data privacy practices.
          </p>
        </div>

        {/* 01. Introduction */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-white flex items-baseline gap-3">
            <span className="text-accent/40 text-sm font-mono">01</span>
            Introduction & Consent
          </h2>
          <p className="text-sm text-white/50 leading-relaxed">
            Forke operates a developer micro-task and bounty platform that connects independent developers with technical projects. By registering an account, linking third-party authentication services, or interacting with our platform, you explicitly consent to the collection, processing, and storage of your personal data as outlined in this policy.
          </p>
        </section>

        {/* 02. Information We Collect */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-white flex items-baseline gap-3">
            <span className="text-accent/40 text-sm font-mono">02</span>
            Information We Collect
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-white/40">Personal Data</h3>
              <ul className="space-y-2 text-sm text-white/50">
                {[
                  'Full Name & Username',
                  'Email Address (via OAuth providers)',
                  'GitHub Profile Information & Repositories list',
                  'Payout Details (UPI ID / VPA, Bank account details)',
                  'Profile Avatar image & Bio details',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent/60 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-white/40">Usage & Technical Info</h3>
              <ul className="space-y-2 text-sm text-white/50">
                {[
                  'Browser type & Operating System',
                  'A one-way hashed IP address & general geo-location, kept on sign-in/sign-up for security & fraud prevention only (we do not store your raw IP), purged after 90 days',
                  'Pages visited, time spent, & navigation paths',
                  'Click interactions, transaction logs, & claims history',
                  'Referral source: marketing channel, campaign tags (UTM), & referring website at signup',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent/60 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 03. Third-Party Integrations */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-white flex items-baseline gap-3">
            <span className="text-accent/40 text-sm font-mono">03</span>
            Third-Party Sub-Processors
          </h2>
          <p className="text-sm text-white/50 leading-relaxed">
            We integrate with trusted third-party services to deliver key application functionalities. These providers process data in accordance with their own privacy protocols:
          </p>
          <ul className="space-y-3 text-sm text-white/50 pl-4">
            <li>
              <strong>Authentication & Session Management (NextAuth):</strong> Handles secure credentials-based login as well as third-party OAuth authentication via GitHub and Google.
            </li>
            <li>
              <strong>Database Infrastructure (PostgreSQL & Drizzle ORM):</strong> Stores user profiles, task details, active claims, and transaction histories securely on our cloud-hosted database infrastructure.
            </li>
            <li>
              <strong>Payment Gateway & Settlements (Razorpay):</strong> Processes task bounty deposits, payouts, and UPI settlements. We do not store full credit card numbers or banking secrets on our servers.
            </li>
            <li>
              <strong>Analytics (Google Analytics 4):</strong> Helps us understand aggregate site traffic, page views, and acquisition channels so we can improve the product. Google may set its own cookies and process usage data in accordance with its privacy policy; we do not use it for advertising or to sell your data.
            </li>
          </ul>
        </section>

        {/* 04. Data Storage, Transfers & Security */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-white flex items-baseline gap-3">
            <span className="text-accent/40 text-sm font-mono">04</span>
            Storage, Security & Location
          </h2>
          <p className="text-sm text-white/50 leading-relaxed">
            Our primary databases are hosted securely on cloud infrastructure located in <strong>India</strong> to ensure compliance with local server-residency requirements under the DPDP Act 2023.
          </p>
          <p className="text-sm text-white/50 leading-relaxed">
            We implement SSL/TLS encryption for all data in transit, restrict database access to authenticated administrators, and run automated security scanners. However, no internet service is 100% secure, and you are responsible for maintaining the privacy of your account access credentials.
          </p>
        </section>

        {/* 05. Data Retention */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-white flex items-baseline gap-3">
            <span className="text-accent/40 text-sm font-mono">05</span>
            Data Retention
          </h2>
          <p className="text-sm text-white/50 leading-relaxed">
            We retain your personal information for as long as your account is active on Forke. If you delete your account, we will erase or anonymize your personal data within 30 days, except where we are legally required to retain certain records (such as tax invoices, payment settlement audits, or dispute history logs) for up to 5 years under applicable Indian fiscal regulations.
          </p>
        </section>

        {/* 06. Cookies & Tracking */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-white flex items-baseline gap-3">
            <span className="text-accent/40 text-sm font-mono">06</span>
            Cookies & Tracking
          </h2>
          <p className="text-sm text-white/50 leading-relaxed">
            Forke uses persistent and session cookies to keep you signed in, preserve your interface theme settings, and analyze traffic performance. You may disable cookies in your web browser, but doing so will prevent you from claiming bounties or accessing private dashboards.
          </p>
          <p className="text-sm text-white/50 leading-relaxed">
            When you first arrive via a tagged or referring link, we store a first-party attribution cookie that records the marketing channel, campaign tags (UTM parameters), and referring website. This helps us understand which channels bring people to Forke and is associated with your account if you sign up. We also use Google Analytics, which sets its own cookies to measure aggregate traffic. We do <strong>not</strong> use third-party advertising trackers or device fingerprinting, and we do not sell your data.
          </p>
        </section>

        {/* 07. User Rights (DPDP 2023 & GDPR) */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-white flex items-baseline gap-3">
            <span className="text-accent/40 text-sm font-mono">07</span>
            Your Privacy Rights
          </h2>
          <p className="text-sm text-white/50 leading-relaxed">
            Under India&apos;s DPDP Act 2023 and global standards, you possess the following rights regarding your personal data:
          </p>
          <ul className="space-y-3 text-sm text-white/50 pl-4">
            <li>
              <strong>Right to Access & Portability:</strong> You may request a copy of the personal data we hold about you in a readable format.
            </li>
            <li>
              <strong>Right to Rectification:</strong> You may request corrections to any inaccurate, outdated, or incomplete personal data.
            </li>
            <li>
              <strong>Right to Erasure (&quot;Right to be Forgotten&quot;):</strong> You can request that we delete your account and associated personal info.
            </li>
            <li>
              <strong>Right to Withdraw Consent:</strong> You may withdraw your consent to process your data at any time, which will result in account closure.
            </li>
          </ul>
        </section>

        {/* Contact / Grievance Officer */}
        <div className="pt-8 border-t border-white/[0.06] space-y-4 text-center">
          <p className="text-sm text-white/40">
            To exercise your rights, submit a grievance, or file a data deletion request:
          </p>
          <a
            href="mailto:support@forke.space"
            className="inline-block px-6 py-3 bg-accent text-[#0A0A0A] text-sm font-bold rounded-xl hover:brightness-110 transition-all shadow-glow"
          >
            support@forke.space
          </a>
          <p className="text-[10px] text-white/30 font-mono pt-2">
            Grievances will be reviewed and addressed within 15 business days.
          </p>
        </div>

      </main>

      <Footer />
    </div>
  )
}
