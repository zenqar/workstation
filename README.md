# Zenqar Platform - Technical Architecture & Roadmap

Zenqar is a premium, high-performance financial management platform designed for the Middle Eastern market, featuring multi-currency support (USD/IQD) and a state-of-the-art Glassmorphism UI.

## 🏗️ Architecture Overview

### Tech Stack
- **Framework**: Next.js 15+ (App Router)
- **Runtime**: Cloudflare Workers / Pages via [OpenNext](https://open-next.js.org/cloudflare)
- **Database/Auth**: Supabase (PostgreSQL + GoTrue)
- **Styling**: Vanilla CSS with 30+ Premium Design Techniques
- **Internationalization**: `next-intl` (English, Arabic, Kurdish support)

### Core Folder Structure
```text
src/
├── app/                  # Next.js Pages & API Routes
│   ├── [locale]/         # I18n Root
│   │   ├── admin/        # Platform Admin Dashboard
│   │   ├── app/          # User Application (Dashboard, Invoices)
│   │   └── (auth)/       # Login, Signup, Password Recovery
│   └── api/              # Backend Endpoints (Diagnostics, Webhooks)
├── lib/                  # Business Logic & Infrastructure
│   ├── actions/          # Server Actions (Forms & Mutations)
│   ├── env/              # Runtime Environment Bridge (Cloudflare/Node)
│   ├── services/         # External APIs (FX Rates, PDF Generation)
│   ├── supabase/         # Client/Server/Admin Supabase Clients
│   └── utils/            # Shared Helpers (Formatting, UI Logic)
└── middleware.ts         # Security, Auth Redirects, & I18n Routing
```

## 🔒 Security Model
- **Middleware Guard**: Protects all `/app` and `/admin` routes.
- **Environment Management**: Centralized via `src/lib/env/server.ts` to safely handle Cloudflare Worker Bindings/Secrets.
- **Supabase RLS**: Row Level Security is active on all tables.
- **Admin Access**: Protected via `ADMIN_SECRET` verification and the `platform_admins` table.

## 🎨 Premium UI System
The platform implements 30 advanced CSS techniques for a $10,000+ custom design feel:
- **Technique 13-30**: Viewport Vignetting, Mouse Glow Effect, Card Spotlight, Staggered Animations, Glassmorphism Depth (Glass-1/2/3).
- **Dynamic Lighting**: Real-time cursor tracking updates radial gradients on interactive cards.

## 🗺️ Roadmap & Current Status

### Phase 1: Foundation (Completed)
- [x] Multi-tenant database schema (Businesses -> Memberships -> Users).
- [x] Authentication & Authorization flow.
- [x] USD/IQD Currency system with live FX rate fetching.

### Phase 2: Deployment & Stability (Current)
- [x] Cloudflare Workers deployment optimization.
- [x] Runtime Environment Variable stabilization (`getCloudflareContext`).
- [x] Diagnostic API for production troubleshooting.

### Phase 3: Platform Admin (In Progress)
- [x] Admin Login & Dashboard foundation.
- [x] User management & Password recovery tools.
- [ ] Business Impersonation for support.
- [ ] Global Financial Analytics.

### Phase 4: Financial Expansion (Upcoming)
- [ ] Automated PDF Invoice generation.
- [ ] Export to Excel/CSV for accounting.
- [ ] Multi-business support for a single user account.

## 🚀 Deployment Guide
1. **Build**: `npm run build` (runs Next.js build + OpenNext bundling).
2. **Deploy**: Handled via GitHub Actions or `wrangler deploy`.
3. **Environment**: 
   - Public vars go in `wrangler.jsonc`.
   - Secrets (`ADMIN_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) must be added manually in the Cloudflare Dashboard (Settings > Variables).

---
*Developed by Zenqar Engineering*
