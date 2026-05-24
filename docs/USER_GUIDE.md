# SignalSprout — User Guide

SignalSprout is a Social Growth Engine that helps content creators and agencies manage posts, analytics, costs, and brand assets across Instagram, Facebook Pages, TikTok, and Pinterest — all from one place.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard](#2-dashboard)
3. [Content Studio](#3-content-studio)
4. [Calendar](#4-calendar)
5. [Analytics](#5-analytics)
6. [Cost Tracking](#6-cost-tracking)
7. [Social Accounts](#7-social-accounts)
8. [Assets](#8-assets)
9. [Settings](#9-settings)

---

## 1. Getting Started

When you open SignalSprout for the first time you'll be taken through a short onboarding wizard:

1. **Create a workspace** — give it a name (e.g. your agency name or brand name).
2. **Create a brand** — set a name, tone of voice, CTAs, and colour identity.
3. **Connect a social account** — see [Social Accounts](#7-social-accounts).

After onboarding you land on the Dashboard. You can create additional workspaces from **Settings → Workspaces** and switch between them using the workspace selector at the top of the screen.

---

## 2. Dashboard

**Route:** `/(tabs)/dashboard`

A live overview of your workspace:

| Card | What it shows |
|---|---|
| **Upcoming Posts** | Next 5 posts scheduled for publishing |
| **Cost Summary** | Total spend for the current month |
| **Top Insight** | Highest-priority AI recommendation |
| **Platform Breakdown** | Impressions split by connected platform |

Tap any upcoming post to open it in the Calendar detail view.

---

## 3. Content Studio

**Route:** `/(tabs)/content` → **+ Create Post** button

A 4-step wizard for creating AI-assisted posts.

### Step 1 — Build Prompt

Choose your brand, platform (Instagram, Facebook, TikTok, or Pinterest), tone, and call-to-action. These parameters are sent to the AI to generate content that matches your brand voice.

### Step 2 — Generate Caption

SignalSprout uses GPT-4o to generate a caption, hashtags, and hook line tailored to the selected platform's character limit:

| Platform | Caption limit |
|---|---|
| Instagram | 2,200 chars |
| Facebook | 63,206 chars |
| TikTok | 2,200 chars |
| Pinterest | 500 chars |

You can regenerate the caption, edit it manually, or adjust the hashtag list before continuing.

### Step 3 — Add Creative

Generate an image with DALL·E 3 at the correct aspect ratio for the target platform:

| Platform | Aspect ratio |
|---|---|
| Instagram | 1:1 (square) |
| Facebook | 1:1 (square) |
| TikTok | 9:16 (vertical) |
| Pinterest | 2:3 (portrait) |

You can also **upload your own image** (auto-resized to a 1920 px max side and compressed before upload) or **upload a video** from your device library. For text-only posts (Facebook only) you can skip the creative entirely.

#### Video upload limits

| Constraint | Limit |
|---|---|
| Max duration (Instagram Reels) | 90 seconds |
| Max duration (TikTok) | 10 minutes (600 seconds) |
| Max file size | 500 MB |

> If you plan to post to **both** Instagram and TikTok, keep videos under 90 seconds so they are accepted by both platforms.

### Step 4 — Schedule

Pick a date and time for publishing, or publish immediately. You must select a connected social account for the target platform.

- **Schedule** — creates a publish job that fires at the chosen time via Inngest.
- **Publish Now** — sends the post immediately via the `publish-now` Edge Function.

After saving, the post appears in the Calendar and Content list as `scheduled`.

---

## 4. Calendar

**Route:** `/(tabs)/calendar`

Visualise and manage your publishing schedule.

### Views

- **Month** — overview grid; tap a date to see all posts for that day.
- **Week** — 7-column week view; tap a post chip to open the detail sheet.
- **Queue** — flat list of all scheduled posts sorted by time.

### Post Detail Sheet

Tap any post to open a detail panel showing:

- Platform, brand, caption preview, scheduled time
- Publish status (`scheduled`, `publishing`, `published`, `failed`)
- Error log and failure reason (if applicable)

### Actions from Calendar

| Action | When available |
|---|---|
| **Publish Now** | Post is in `scheduled` or `failed` state |
| **Edit** | Opens the edit-post modal |
| **Delete** | Removes the post and cancels its publish job |

---

## 5. Analytics

**Route:** `/(tabs)/analytics`

Performance metrics for the selected period (Weekly / Monthly / Yearly).

### Summary Metrics

| Metric | Description |
|---|---|
| **Impressions** | Total impressions across all published posts |
| **Saves** | Total saves / bookmarks |
| **Clicks** | Total outbound link clicks |
| **Avg Eng Rate** | Average engagement rate (interactions ÷ reach) |
| **Cost / Post** | Total business costs ÷ published posts for the period |
| **Cost / Asset** | AI generation costs ÷ generated assets for the period |

**Cost / Post** and **Cost / Asset** are only populated once you start logging expenses in [Cost Tracking](#6-cost-tracking).

### Top Posts Table

Sortable table of your best-performing posts by impressions, saves, or clicks.

### By Brand / By Platform

Breakdown of impressions and engagement rate split by brand and connected platform.

### AI Recommendations

SignalSprout analyses your metrics weekly and generates prioritised recommendations (e.g. "Post 20% more on TikTok — your engagement rate there is 3× your Instagram rate"). Dismiss recommendations once actioned.

Use **Sync Metrics** to pull the latest data from connected platform APIs on demand.

---

## 6. Cost Tracking

**Route:** `/(tabs)/costs`

Track every business expense related to your content operation so SignalSprout can calculate ROI.

### What to log here

| Category | Examples |
|---|---|
| **AI generation** | OpenAI API usage, Runway video credits |
| **Infrastructure** | Vercel hosting, Supabase compute |
| **Subscriptions** | Canva, scheduling tools, stock libraries |
| **Ad spend** | Instagram Ads, Facebook Ads, TikTok Ads |
| **Campaign budgets** | Influencer fees, sponsored post costs |

> **What NOT to log here:** Payroll, rent, accounting software, legal fees. Use a dedicated accounting tool (QuickBooks, Wave, Xero) for those.

### Adding a Cost Entry

1. Tap **+ Add Cost Entry** (bottom-right button).
2. Select a cost source (or create a new one).
3. Enter the amount, date, and optionally link it to a brand.
4. Save.

Entries appear in the **Spending Trend** chart and **By Tool / Vendor** table immediately.

### Cost Sources

A cost source represents a recurring or one-time vendor/tool. Set an estimated monthly range so SignalSprout can project costs even before you log actual entries. Manage sources from the add-cost modal.

### AI Credits

Track prepaid AI credits (e.g. OpenAI credit purchases) under **+ Credits**. SignalSprout shows a progress bar of how much of each credit balance has been consumed.

### Budget Alerts

Set a monthly spend limit on any cost source. SignalSprout shows a warning bar when you cross a configurable threshold (default: 80%) and an error state when the limit is reached.

---

## 7. Social Accounts

**Route:** `/(tabs)/social-accounts`

Connect and manage OAuth accounts for each platform. Each workspace can have multiple accounts per platform (e.g. two Instagram accounts for two brands).

### Connecting an Account

1. Tap the platform tile.
2. Complete the OAuth flow in the browser.
3. On success you are redirected back to the app and the account appears in the list.

For full step-by-step instructions including developer app setup, see **[docs/SOCIAL_SETUP.md](SOCIAL_SETUP.md)**.

### Disconnecting

Tap the account card → **Disconnect**. This revokes the stored access token and removes the account from SignalSprout. Posts already scheduled to that account will fail — reschedule them to a different account first.

---

## 8. Assets

**Route:** `app/workspace/[workspaceId]/assets`

A media library for all images generated or uploaded in the workspace.

### Viewing Assets

Assets are displayed in a grid (3-column on mobile, wider on web). Tap any asset to open the detail sheet showing:

- Full-size preview
- File size, dimensions, creation date
- Which posts the asset is linked to

### Filtering

Use the filter bar at the top to view:
- **All** — everything in the library
- **Generated** — images produced by DALL·E 3
- **Uploaded** — images you uploaded manually
- **Video** — videos uploaded from your device

### Image Auto-Resize

When you upload an image (via the Content Studio or directly to the library), SignalSprout automatically resizes it to a maximum of **1920 px** on the longest side and compresses it to reduce upload size. The original file on your device is not modified.

### Deleting an Asset

Tap any asset to open the detail sheet, then tap **Delete**. You will be asked to confirm. The asset is removed from the library and unlinked from any scheduled posts immediately.

### Using Assets in Posts

Assets are linked automatically when you generate or upload an image during the [Content Studio](#3-content-studio) wizard. You can also reuse an existing asset when editing a post.

---

## 9. Settings

**Route:** `/(tabs)/settings`

### Workspace

- Edit workspace name and description
- View your role and member count

### Team Members

Invite collaborators by email. Roles:

| Role | What they can do |
|---|---|
| **Owner** | Everything, including deleting the workspace |
| **Admin** | Everything except workspace deletion |
| **Editor** | Create and edit posts, content, and cost entries |
| **Viewer** | Read-only access |

### Brands

Manage the brands within your workspace — name, tone, hashtag sets, CTAs, and colour palette.

### Security

The credential vault stores platform API secrets encrypted at rest. Vault entries are only accessible server-side via Supabase Edge Functions — they are never sent to the client.

### Sign Out

Signs out of the current session. Your data and workspaces are preserved.
