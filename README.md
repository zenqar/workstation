# Zenqar — Smart Invoicing & Bookkeeping

Zenqar is a modern, multilingual SaaS platform for Iraqi and Kurdish businesses to manage their invoicing, bookkeeping, and cash flow in both IQD and USD.

## Features

- **Multi-Tenant SaaS:** Built on Supabase with strict Row Level Security (RLS) for complete data isolation.
- **Multilingual & RTL:** First-class support for English, Arabic, and Kurdish (Sorani) with next-intl.
- **Smart Bookkeeping:** Dual-currency tracking (IQD and USD) with an immutable `money_transactions` ledger ensuring 100% accurate balances.
- **Invoice Verification:** Public, read-only URL generation with cryptographic tokens for customers to verify authentic invoices.
- **Role-Based Access Control (RBAC):** Invite team members as Owners, Admins, Accountants, Staff, or Viewers.
- **Glassmorphism Design:** A modern, premium UI using a customized Tailwind CSS setup with dynamic interactions and animations.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database & Auth:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS (Custom glassmorphism theme)
- **Internationalization:** `next-intl`
- **Icons:** `lucide-react`
- **Validation:** Zod

## Getting Started

### 1. Prerequisites
- Node.js 18+
- A Supabase project

### 2. Database Setup
Execute the SQL migrations found in `supabase/migrations/` in the following order:
1. `001_initial_schema.sql` (Creates tables and triggers)
2. `002_rls_policies.sql` (Sets up Row Level Security)
3. `003_functions.sql` (Adds bookkeeping business logic and invoice numbering)

*(Optional)* Run `supabase/seed.sql` to populate sample data.

### 3. Environment Variables
Copy `.env.example` to `.env.local` and fill in the values:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Security & Admin
ADMIN_SECRET=your_super_secret_admin_password
NEXT_PUBLIC_APP_URL=http://localhost:3000

# FX Service (exchangerate_api, fixer, or mock)
FX_PROVIDER=mock
FX_API_KEY=
FX_FALLBACK_RATE=1310
```

### 4. Install & Run
```bash
npm install
npm run dev
```

The application will be available at `http://localhost:3000`.

## Key Architectural Decisions

- **Database-Driven Balances:** We do not store an absolute "balance" column that can get out of sync. Instead, `money_transactions` is an append-only ledger, and balances are dynamically derived via `get_account_balance`.
- **Atomic Invoice Numbering:** Invoice sequences are handled database-side via sequences scoped to each `business_id` to prevent race conditions.
- **Server Actions & Permissions:** All state mutations happen via Next.js Server Actions which explicitly re-check the authenticated user's `business_memberships` role before acting.
