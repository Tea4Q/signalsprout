# SignalSprout

**SignalSprout** is a Social Growth Engine SaaS — a React Native / Expo application for managing social media content, analytics, costs, and brand identity across Instagram and Pinterest.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Expo ~54 + Expo Router ~6 |
| UI | React Native 0.81.5 |
| Database | Supabase (Postgres + RLS) |
| Auth | Supabase Auth + expo-secure-store |
| State | React Context |
| Types | TypeScript + generated `types/database.ts` |
| Validation | Zod |
| Animations | react-native-reanimated ~4 |

---

## Environment Variables

Create a `.env.local` file in the project root with the following variables:

```ini
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

These are read by `lib/env.ts` and will throw at startup if missing.

---

## Setup

```bash
# Install dependencies
npm install

# Start the development server
npx expo start

# iOS simulator
npx expo start --ios

# Android emulator
npx expo start --android

# Web
npx expo start --web
```

---

## Supabase Setup

1. Create a Supabase project at https://supabase.com
2. Apply migrations from `supabase/migrations/` in order using the Supabase CLI:
   ```bash
   supabase db push
   ```
3. Deploy Edge Functions:
   ```bash
   supabase functions deploy invite-member
   supabase functions deploy generate-caption
   supabase functions deploy generate-image
   supabase functions deploy publish-post
   ```
4. Set Edge Function secrets via the Supabase dashboard or:
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-...
   supabase secrets set INSTAGRAM_APP_SECRET=...
   supabase secrets set PINTEREST_APP_SECRET=...
   ```

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

