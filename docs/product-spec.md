# SignalSprout — Product Specification

**Version:** 1.0 · **Phase:** 8 (Dashboard, Polish & SaaS Readiness)

---

## Overview

SignalSprout is a Social Growth Engine SaaS platform designed for content creators, agencies, and small businesses managing Instagram and Pinterest accounts. It provides:

- AI-assisted content generation (captions, images, hashtags)
- Multi-platform post scheduling and publishing
- Brand management with tone-of-voice profiles
- Cost tracking for AI tools and ad spend
- Analytics, performance reporting, and AI recommendations
- A security vault for API credentials
- Multi-workspace, multi-member team support

---

## Core Entities

| Entity | Description |
|---|---|
| `workspaces` | The top-level organisational unit. A user may belong to many. |
| `brands` | A brand within a workspace, with its own identity and voice. |
| `brand_profiles` | Extended brand metadata: tone, hashtags, CTAs, colours. |
| `campaigns` | A marketing campaign grouping posts with goals and dates. |
| `posts` | A unit of content (draft → approved → scheduled → published). |
| `publish_jobs` | Queue records for the scheduler Edge Function. |
| `platform_metrics` | Captured analytics data from Instagram/Pinterest APIs. |
| `recommendations` | AI-generated action recommendations based on metrics. |
| `cost_sources` | Recurring or one-time cost categories (tools, ads, etc.). |
| `cost_entries` | Individual cost records tied to a source and period. |
| `social_accounts` | Connected OAuth social accounts per workspace. |
| `credential_vault` | Encrypted API credentials stored using envelope encryption. |
| `audit_logs` | Immutable log of all sensitive operations. |
| `workspace_members` | User–workspace membership with a role. |

---

## Post Lifecycle

```
draft → ready_for_review → approved → scheduled → [queued in publish_jobs] → published
                                                                                ↓ (on failure)
                                                                              failed
```

The `publish-post` Edge Function polls `publish_jobs` and calls the appropriate platform API.

---

## Roles

| Role | Permissions |
|---|---|
| `owner` | Full access including workspace deletion |
| `admin` | Full access except workspace deletion |
| `editor` | Create/edit posts, content, and cost entries |
| `viewer` | Read-only access to all content |

Role enforcement is applied both via Supabase RLS policies on the server and in the UI.

---

## Screens

| Screen | Route | Description |
|---|---|---|
| Dashboard | `/(tabs)/dashboard` | Live stats, upcoming posts, cost summary, AI insight, platform breakdown |
| Calendar | `/(tabs)/calendar` | Monthly/weekly calendar view + post queue |
| Content | `/(tabs)/content` | AI caption + image generation |
| Analytics | `/(tabs)/analytics` | Performance metrics and recommendations |
| Costs | `/(tabs)/costs` | Cost tracking and trend charts |
| Settings | `/(tabs)/settings` | Workspace info, team members, security vault, sign out |
| Onboarding | `/onboarding` | First-launch setup wizard (shown once) |

---

## Edge Functions

| Function | Trigger | Description |
|---|---|---|
| `publish-post` | Cron (every minute) | Polls `publish_jobs` and publishes via platform APIs |
| `generate-caption` | HTTP (from app) | Uses OpenAI to generate captions from prompt + brand profile |
| `generate-image` | HTTP (from app) | Uses OpenAI DALL·E to generate post images |
| `invite-member` | HTTP (from app) | Sends a Supabase invite email for workspace membership |
| `ingest-metrics` | Cron (daily) | Pulls platform metrics and stores in `platform_metrics` |
| `generate-recommendations` | Cron (weekly) | Runs recommendation engine and stores results |

---

## Acceptance Criteria (Phase 8)

- [ ] Dashboard shows live cost, upcoming posts, top insight, platform breakdown
- [ ] All screens have loading states and empty states
- [ ] Error handling is consistent; global error boundary in place
- [ ] Workspace switcher works when multiple workspaces exist
- [ ] Role-based UI restrictions enforced
- [ ] Onboarding guides new users through initial setup (shown once via SecureStore flag)
- [ ] All documentation files exist and are accurate
- [ ] App runs without errors on iOS, Android, and Web
- [ ] No TypeScript errors (`npx tsc --noEmit`)
