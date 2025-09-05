# DitonaChat

A Next.js-based video chat platform for adult conversations with premium features and global connectivity.

## Features

- 🎥 Real-time video chat with WebRTC
- 🌍 Global user matching with country/gender filters
- 💎 VIP subscription system with Stripe integration
- 🔐 Google OAuth authentication
- 🛡️ Age verification and security headers
- 📱 Mobile-first responsive design
- ⚡ Rate limiting and abuse protection

## Development

### Prerequisites

- Node.js 20+
- pnpm (recommended package manager)

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Stripe payments
- `STRIPE_PRICE_ID_EUR_*` - Stripe pricing tiers
- `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD` - TURN server (optional)
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET` - NextAuth configuration
- `DATABASE_URL` - Database connection (optional, defaults to SQLite)

### Quick Start

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm dlx prisma generate

# Start development server
pnpm run dev

# Open http://localhost:3000
```

### Build for Production

```bash
# Build the application
pnpm run build

# Start production server
pnpm start
```

### Testing

```bash
# Run Playwright tests
pnpm exec playwright test

# Run k6 load tests
k6 run scripts/k6-smoke.js
```

## Deployment

### Vercel (Recommended)

1. Import project from GitHub
2. Framework preset: **Next.js**
3. Package manager: **pnpm**
4. Build command: `pnpm run build`
5. Output directory: `.next`
6. Set environment variables from `.env.example`

### Environment Configuration

Required for production:
- All Stripe variables for payments
- Google OAuth credentials for authentication
- NextAuth secret and URL
- TURN server credentials (optional, fallback to STUN)

### Post-Deployment Checklist

- [ ] Test homepage: `/`
- [ ] Test pricing: `/plans`
- [ ] Test chat flow: `/chat` (should redirect to age gate)
- [ ] Test health endpoint: `/api/health`
- [ ] Verify VIP status API: `/api/user/vip-status`
- [ ] Test age verification flow
- [ ] Verify security headers are applied

## Architecture

- **Frontend**: Next.js 15 with React 19, TypeScript, Tailwind CSS
- **Authentication**: NextAuth with Google OAuth
- **Database**: Prisma ORM with SQLite (dev) / PostgreSQL (prod)
- **Payments**: Stripe with webhook processing
- **Real-time**: WebRTC with STUN/TURN fallback
- **Security**: CSP headers, rate limiting, age verification