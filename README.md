# SignalSprout

**SignalSprout** is a Social Growth Engine SaaS — a React Native / Expo application for managing social media content, analytics, costs, and brand identity across Instagram, Facebook Pages, TikTok, and Pinterest.

→ **[User Guide](docs/USER_GUIDE.md)** · **[Social Account Setup](docs/SOCIAL_SETUP.md)** · **[API Integrations](docs/api-integrations.md)**

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Expo ~54 + Expo Router ~6 |
| UI | React Native 0.81.5 |
| Database | Supabase (Postgres + RLS) |
| Auth | Supabase Auth + expo-secure-store |
| Background jobs | Inngest |
| State | React Context |
| Types | TypeScript + generated `types/database.ts` |
| Validation | Zod |
| Animations | react-native-reanimated ~4 |

---

## Environment Variables

Create a `.env.local` file in the project root. All `EXPO_PUBLIC_*` vars are baked into the bundle at build time and must also be set in your Vercel project settings.

```ini
# Supabase (required)
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# Instagram / Meta (same Meta app as Facebook)
EXPO_PUBLIC_INSTAGRAM_CLIENT_ID=<meta-app-id>

# Facebook Pages
EXPO_PUBLIC_FACEBOOK_CLIENT_ID=<meta-app-id>

# TikTok
EXPO_PUBLIC_TIKTOK_CLIENT_KEY=<tiktok-client-key>
EXPO_PUBLIC_TIKTOK_CLIENT_ID=<tiktok-client-key>

# Pinterest
EXPO_PUBLIC_PINTEREST_CLIENT_ID=<pinterest-app-id>

# X / Twitter
EXPO_PUBLIC_X_CLIENT_ID=<x-oauth2-client-id>

# Inngest (server-side only — do NOT prefix with EXPO_PUBLIC_)
INNGEST_EVENT_KEY=<inngest-event-key>
INNGEST_SIGNING_KEY=<inngest-signing-key>
INNGEST_SERVE_ORIGIN=https://<your-vercel-domain>
```

`lib/env.ts` validates required vars at startup and throws a descriptive error if any are missing.

---

## Local Development

```bash
# Install dependencies
npm install

# Start the development server
npx expo start

# iOS simulator
npx expo start --ios

# Android emulator
npx expo start --android

# Web (also runs the Inngest API route via Vercel dev)
npx expo start --web
```

---

## Supabase Setup

1. Create a project at https://supabase.com
2. Apply all migrations in order:
   ```bash
   supabase db push
   ```
3. Deploy Edge Functions:
   ```bash
   supabase functions deploy publish-instagram --no-verify-jwt
   supabase functions deploy publish-facebook --no-verify-jwt
   supabase functions deploy publish-tiktok --no-verify-jwt
   supabase functions deploy publish-pinterest --no-verify-jwt
   supabase functions deploy publish-now --no-verify-jwt
   supabase functions deploy generate-content --no-verify-jwt
   supabase functions deploy generate-image --no-verify-jwt
   supabase functions deploy oauth-exchange --no-verify-jwt
   supabase functions deploy inngest-send --no-verify-jwt
   ```
4. Set Edge Function secrets:
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-...
   supabase secrets set INSTAGRAM_CLIENT_SECRET=...
   supabase secrets set FACEBOOK_CLIENT_SECRET=...
   supabase secrets set TIKTOK_CLIENT_SECRET=...
   supabase secrets set PINTEREST_CLIENT_SECRET=...
   supabase secrets set X_CLIENT_SECRET=...
   supabase secrets set VAULT_MASTER_KEY=<32-byte-hex>
   ```

---

## Vercel Deployment

```bash
npx vercel --prod --yes
```

Set the same `EXPO_PUBLIC_*` vars and the Inngest vars in the Vercel dashboard (or via `npx vercel env add`). They must exist before a production build — the bundle is static.

---

## Project Structure

```
app/              Expo Router screens
  (auth)/         Sign-in, sign-up, forgot-password
  (tabs)/         Main tab screens (dashboard, calendar, content, analytics, costs, settings)
  workspace/      Workspace management screens
  modals/         Bottom-sheet modal screens
  onboarding.tsx  First-launch onboarding wizard
components/       Shared UI components
  ui/             Design system primitives (AppButton, AppCard, AppModal, AppToast, SkeletonBox…)
  dashboard/      Dashboard-specific cards
  calendar/       Calendar components
  content/        Content generation components
  analytics/      Analytics components
  costs/          Cost tracking components
constants/        Theme tokens (colours, spacing, radius, typography)
context/          React contexts (WorkspaceContext, ToastContext)
hooks/            Custom hooks (useTheme, useColorScheme)
lib/              Utilities (supabase client, validators, date, currency, crypto)
services/         Data-access layer
  auth/           Authentication
  analytics/      Recommendations + reporting
  content/        Content generation + image generation
  finance/        Cost tracking + ROI
  scheduling/     Post scheduling + publish queue
  security/       Credential vault + audit log
  workspace/      Workspace + brand + campaign + member management
supabase/
  functions/      Edge Functions source
  migrations/     SQL migration files
types/
  database.ts     Auto-generated Supabase TypeScript types
```

---

## Documentation

- [Product Spec](docs/product-spec.md) — Full feature specification
- [API Integrations](docs/api-integrations.md) — Instagram Graph API + Pinterest API setup
- [Security Model](docs/security-model.md) — Envelope encryption + RLS model
- [Pricing Model](docs/pricing-model.md) — Cost tracking methodology + SaaS tiers

---

## Role-Based Access

| Action | owner | admin | editor | viewer |
|---|---|---|---|---|
| Create/edit posts | ✅ | ✅ | ✅ | ❌ |
| Manage credentials | ✅ | ✅ | ❌ | ❌ |
| Invite/remove members | ✅ | ✅ | ❌ | ❌ |
| Delete workspace | ✅ | ❌ | ❌ | ❌ |

---

## TypeScript

```bash
npx tsc --noEmit
```

All types are generated from the live Supabase schema. To regenerate:

```bash
npx supabase gen types typescript --project-id <project-ref> > types/database.ts
```

