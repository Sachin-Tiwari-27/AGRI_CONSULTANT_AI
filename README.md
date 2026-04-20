# 🌾 Agri Consultant AI Platform

Agri Consultant AI is a sophisticated platform designed for premium agricultural consultancy. It synthesizes complex land data into actionable feasibility reports, leveraging advanced AI, real-time data integration, and a sleek "No-Line" design aesthetic.

## ✨ Core Features

- **🛡️ Digital Estate Briefing**: High-fidelity intelligence interface for synthesized estate analysis.
- **📄 AI-Powered Feasibility Reports**: Automatic generation of comprehensive reports in PDF and Word formats.
- **📊 Interactive Questionnaires**: Multi-stage data collection tools for precision agriculture insights.
- **🛠️ Project Management**: A two-column Case Detail system for tracking estates throughout the consultancy lifecycle.
- **🗓️ Smart Integration**: Seamless Google Calendar and Meet scheduling for client consultations.
- **💳 Premium Billing**: Integrated Stripe payments for exclusive consultancy tiers.
- **⚡ Real-time Updates**: Powered by Supabase for instantaneous data synchronization.

## 🛠️ Technology Stack

- **Framework**: [Next.js 16.2+](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Core**: [React 19.2+](https://react.dev/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/) & [TanStack Query](https://tanstack.com/query/latest)
- **Database / Auth**: [Supabase](https://supabase.com/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/) & [shadcn/ui](https://ui.shadcn.com/)
- **Styling**: [Tailwind CSS 4.0](https://tailwindcss.com/)
- **AI Integration**: [OpenRouter](https://openrouter.ai/) / [Anthropic](https://www.anthropic.com/)
- **Payments**: [Stripe](https://stripe.com/)
- **Emails**: [Resend](https://resend.com/)

## 🚀 Getting Started

### 1. Prerequisites

- Node.js 20.x or higher
- npm or pnpm
- A Supabase project

### 2. Installation

```bash
git clone https://github.com/your-org/agri-ai.git
cd agri-ai
npm install
```

### 3. Environment Setup

Copy `.env.local.example` to `.env.local` and fill in your credentials:

```bash
cp .env.local.example .env.local
```

Key requirements:

- **Supabase**: URL and Anon/Service Role keys.
- **AI**: OpenRouter or Anthropic API keys.
- **Stripe**: Secret and Publishable keys for payments.
- **Tavily**: For AI-driven market research features.

### 4. Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the platform.

## 📁 Project Structure

- `src/app`: Next.js App Router pages and API routes.
- `src/components`: UI building blocks (Auth, Project, Report, Questionnaire).
- `src/hooks`: Custom React hooks for data fetching and state.
- `src/lib`: Core utilities and API clients (Stripe, Resend, AI).
- `supabase`: Database migrations and configuration.

## 📜 Commands

- `npm run dev`: Start development server.
- `npm run build`: Build for production.
- `npm run start`: Start production server.
- `npm run lint`: Run ESLint.

---

Built for the future of sustainable and intelligent agriculture. 🌍✨
