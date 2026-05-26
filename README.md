
# Agri Consultant AI — Internal README

This document is the internal, developer-focused README for the Agri Consultant AI repository. It provides the essential information engineers need to get productive: architecture, dev setup, common commands, repository conventions, and pointers to important files.

**Status**: Active development

**Audience**: Internal engineering team, SRE, and DevOps

**Quick links**
- **Code**: [src](src)
- **App router & API**: [src/app](src/app)
- **Components**: [src/components](src/components)
- **Migrations**: [supabase](supabase)
- **Package manifest**: [package.json](package.json)

**Table of contents**
- **Purpose & high-level architecture**
- **Local development (quick start)**
- **Environment variables**
- **Database & migrations**
- **Testing & linting**
- **Deployment & releases**
- **Repository conventions**
- **Who to contact**

**Purpose & high-level architecture**
- Purpose: Turn client-provided estate data into actionable feasibility reports and support consultant workflows.
- Architecture: Next.js (App Router) frontend + Supabase for realtime DB/auth, server-side APIs in [src/app/api](src/app/api), and third-party integrations (Stripe, Resend, OpenRouter/Anthropic).

**Local development (quick start)**
1. Install

```bash
git clone <repo-url>
cd AGRI-CONSULTANT-AI
npm install
```

2. Copy env file

```bash
cp .env.local.example .env.local
# then edit .env.local
```

3. Run dev server

```bash
npm run dev
```

Open http://localhost:3000 after the server starts.

**Environment variables**
- The project expects `.env.local` to be populated from `.env.local.example`.
- Most-critical vars: **Supabase** (URL, ANON/SERVICE role), **AI** keys (OpenRouter/Anthropic), **Stripe** keys, **RESEND** key.
- Keep secrets out of source control.

**Database & migrations**
- Migrations and schema live under [supabase](supabase). Use the Supabase CLI or dashboard to run/inspect migrations.
- Common commands (using Supabase CLI):

```bash
# apply migrations
supabase db push

# open local Supabase Studio
supabase start
```

Refer to the SQL files in [supabase/Migrations](supabase/Migrations) for migration history and notes.

**Testing & linting**
- Linting: `npm run lint`
- Unit/integration tests: (project-specific test commands if present) — add here once test suite is available.

**Deployment & releases**
- Primary host: Vercel. Production deploys are driven by the main branch.
- Environment configuration for staging/production is managed in the Vercel dashboard and/or CI.

**Repository conventions**
- Branching: `main` for prod, `develop` or feature branches for active work.
- Commits: follow conventional commits where practical (`fix:`, `feat:`, `chore:`).
- Pull requests: include a short description, link to design/ticket, and list of manual testing steps.

**Important files & folders**
- App and API routes: [src/app](src/app)
- UI components: [src/components](src/components)
- Lib utilities and integrations: [src/lib](src/lib)
- Supabase migrations: [supabase/Migrations](supabase/Migrations)
- Next config: [next.config.ts](next.config.ts)

**On-call / troubleshooting**
- Check logs in Vercel for runtime errors.
- For DB issues, inspect Supabase logs and migration history.

**Who to contact**
- Code owner / main point of contact: (add name or team here)
- For infra: (add SRE/infra contact)

If you'd like, I can:
- add missing env var examples to `.env.local.example`
- add a short CONTRIBUTING.md describing PR checklist and tests
- create a basic developer runbook for common tasks

---
Last updated: 2026-05-26

