# SignalSprout — Social Account Setup Guide

This guide walks you through creating developer apps and connecting each supported platform to SignalSprout.

Each platform requires:
1. A developer/business account and app
2. The correct permissions / scopes
3. Your **Client ID** set as an `EXPO_PUBLIC_*` environment variable (`.env.local` for local dev, Vercel dashboard for production)
4. Your **Client Secret** set as a Supabase Edge Function secret (server-side only — never in the client bundle)

---

## Table of Contents

- [Instagram](#instagram)
- [Facebook Pages](#facebook-pages)
- [TikTok](#tiktok)
- [Pinterest](#pinterest)
- [X (Twitter)](#x-twitter)

---

## Instagram

Instagram publishing uses the **Meta Graph API** via a Facebook Developer app.

### 1. Create a Meta Developer App

1. Go to https://developers.facebook.com and log in with a Facebook account that has admin access to the Instagram Business account you want to connect.
2. Click **My Apps → Create App**.
3. Choose **Business** as the app type.
4. Give the app a name (e.g. "SignalSprout") and enter your business email.

### 2. Add the Instagram Graph API Product

1. In your app dashboard, click **Add Product**.
2. Find **Instagram Graph API** and click **Set Up**.
3. Under **Instagram Graph API → Settings**, add your Instagram Business Account.

### 3. Set Required Permissions

In **App Review → Permissions and Features**, request:

| Permission | Purpose |
|---|---|
| `instagram_basic` | Read profile and media |
| `instagram_content_publish` | Create posts |
| `instagram_manage_insights` | Fetch analytics |
| `pages_read_engagement` | Read Facebook Page engagement |
| `pages_show_list` | List Pages the user manages |

> For development you can use these in **Development mode** against your own account without app review. To publish for other users you need to submit for review.

### 4. Set the OAuth Redirect URI

In **Facebook Login → Settings → Valid OAuth Redirect URIs**, add:

```
https://signalsprout.vercel.app/oauth/callback
```

For local development also add:
```
exp://localhost:8081/--/oauth/callback
```

### 5. Configure Environment Variables

| Variable | Where | Value |
|---|---|---|
| `EXPO_PUBLIC_INSTAGRAM_CLIENT_ID` | `.env.local` + Vercel | Your Meta App ID |
| `INSTAGRAM_CLIENT_SECRET` | Supabase secrets | Your Meta App Secret |

```bash
supabase secrets set INSTAGRAM_CLIENT_SECRET=<meta-app-secret>
```

### 6. Connect in SignalSprout

1. Open **Social Accounts** in the app.
2. Tap **Instagram**.
3. Complete the Facebook OAuth flow — grant all requested permissions.
4. Your Instagram account appears in the list.

---

## Facebook Pages

Facebook Page publishing uses the same **Meta Developer app** as Instagram.

### 1. Reuse the Meta App from Instagram Setup

No new app is needed. The same app handles both Instagram and Facebook Pages.

### 2. Required Permissions

Ensure these are added in **App Review → Permissions and Features** (in addition to the Instagram ones above):

| Permission | Purpose |
|---|---|
| `pages_manage_posts` | Create posts on Pages |
| `pages_read_engagement` | Read Page insights |
| `pages_show_list` | List Pages the user manages (required to get Page access token) |

### 3. OAuth Redirect URI

Same redirect URIs as Instagram — no change needed.

### 4. Configure Environment Variables

| Variable | Where | Value |
|---|---|---|
| `EXPO_PUBLIC_FACEBOOK_CLIENT_ID` | `.env.local` + Vercel | Your Meta App ID (same as Instagram) |
| `FACEBOOK_CLIENT_SECRET` | Supabase secrets | Your Meta App Secret (same value) |

```bash
supabase secrets set FACEBOOK_CLIENT_SECRET=<meta-app-secret>
```

### 5. Connect in SignalSprout

1. Open **Social Accounts**.
2. Tap **Facebook**.
3. Complete the OAuth flow — when prompted, select the Page(s) you want SignalSprout to manage.
4. The Facebook Page appears in your account list. The **external account ID** stored is the Facebook Page ID.

> **Note:** SignalSprout publishes to the Page's feed and photo albums. Personal profiles are not supported.

---

## TikTok

TikTok publishing uses the **TikTok Content Posting API v2**.

### 1. Create a TikTok Developer App

1. Go to https://developers.tiktok.com and log in with a TikTok account.
2. Click **Manage Apps → Create app**.
3. Choose **Web** as the platform type (required for server-side OAuth).
4. Fill in your app name, description, and privacy policy URL.

### 2. Add the Content Posting API Product

1. In your app dashboard, click **+ Add products**.
2. Add **Content Posting API**.
3. Under **Scopes**, request:

| Scope | Purpose |
|---|---|
| `user.info.basic` | Read user profile |
| `video.publish` | Create and publish posts |

> The `video.publish` scope replaces the old `video.list` scope for Content Posting API apps.

### 3. Set the OAuth Redirect URI

In **App Settings → Redirect URI**, add **both**:

```
https://signalsprout.vercel.app/oauth/callback
```
```
http://localhost:8081/oauth/callback
```

> ⚠️ **TikTok requires an exact URI match.** If the redirect URI in the Developer Portal does not
> exactly match what the app sends, TikTok shows "We couldn't log in — correct client_key" on the
> authorization page. The URI sent at runtime is `window.location.origin + "/oauth/callback"`.
> Verify yours at: https://developers.tiktok.com → your app → **App Settings → Redirect URI**.

### 4. Configure Environment Variables

TikTok uses `client_key` (not `client_id`) in its OAuth flow. SignalSprout maps both:

| Variable | Where | Value |
|---|---|---|
| `EXPO_PUBLIC_TIKTOK_CLIENT_KEY` | `.env.local` + Vercel | Your TikTok Client Key |
| `EXPO_PUBLIC_TIKTOK_CLIENT_ID` | `.env.local` + Vercel | Same value as CLIENT_KEY |
| `TIKTOK_CLIENT_SECRET` | Supabase secrets | Your TikTok Client Secret |

```bash
supabase secrets set TIKTOK_CLIENT_SECRET=<tiktok-client-secret>
```

### 5. Connect in SignalSprout

1. Open **Social Accounts**.
2. Tap **TikTok**.
3. Complete the TikTok OAuth flow.
4. Your TikTok account appears in the list.

### ⚠️ Sandbox Limitation

The Content Posting API requires **TikTok app review** before posts can reach real public accounts. Until your app is approved:
- Posts can only be sent to the **developer's own TikTok account**
- Other users' accounts will receive an authorization error

Submit for review at: https://developers.tiktok.com/products/content-posting-api/

Expected review time: 1–4 weeks.

---

## Pinterest

Pinterest publishing uses the **Pinterest API v5**.

### 1. Create a Pinterest Developer App

1. Go to https://developers.pinterest.com and log in.
2. Click **My Apps → Create app**.
3. Fill in your app name and description.

### 2. Required Scopes

In **App Settings → Permissions**, enable:

| Scope | Purpose |
|---|---|
| `boards:read` | List boards |
| `pins:read` | Read pins |
| `pins:write` | Create pins |
| `user_accounts:read` | Read user profile |
| `analytics:read` | Fetch analytics |

### 3. Set the OAuth Redirect URI

In **App Settings → Redirect URIs**, add:

```
https://signalsprout.vercel.app/oauth/callback
```

For local development also add:
```
http://localhost:8081/oauth/callback
```

### 4. Configure Environment Variables

| Variable | Where | Value |
|---|---|---|
| `EXPO_PUBLIC_PINTEREST_CLIENT_ID` | `.env.local` + Vercel | Your Pinterest App ID |
| `PINTEREST_CLIENT_SECRET` | Supabase secrets | Your Pinterest App Secret |

```bash
supabase secrets set PINTEREST_CLIENT_SECRET=<pinterest-app-secret>
```

### 5. Connect in SignalSprout

1. Open **Social Accounts**.
2. Tap **Pinterest**.
3. Complete the Pinterest OAuth flow — grant all requested permissions.
4. Your Pinterest account appears in the list.

---

## X (Twitter)

X publishing uses the **X API v2 OAuth 2.0** with PKCE.

> X publishing is configured in SignalSprout's platform list but the `publish-x` Edge Function is not yet deployed. Connect the account now — publishing support is coming in a future release.

### 1. Create an X Developer App

1. Apply for a developer account at https://developer.x.com if you don't have one.
2. In the **Developer Portal**, create a new Project and App.
3. Under **App Settings → User authentication settings**, enable **OAuth 2.0**.
4. Set the app type to **Web App, Automated App or Bot**.

### 2. Required Scopes

| Scope | Purpose |
|---|---|
| `tweet.read` | Read tweets |
| `tweet.write` | Post tweets |
| `users.read` | Read user profile |
| `offline.access` | Refresh token support |

### 3. Set the OAuth Redirect URI

In **App Settings → Callback URI / Redirect URL**, add:

```
https://signalsprout.vercel.app/oauth/callback
```

For local development also add:
```
http://localhost:8081/oauth/callback
```

### 4. Configure Environment Variables

| Variable | Where | Value |
|---|---|---|
| `EXPO_PUBLIC_X_CLIENT_ID` | `.env.local` + Vercel | Your X OAuth 2.0 Client ID |
| `X_CLIENT_SECRET` | Supabase secrets | Your X OAuth 2.0 Client Secret |

```bash
supabase secrets set X_CLIENT_SECRET=<x-client-secret>
```

### 5. Connect in SignalSprout

1. Open **Social Accounts**.
2. Tap **X (Twitter)**.
3. Complete the X OAuth flow.
4. Your X account appears in the list.

---

## Troubleshooting

| Error | Likely cause | Fix |
|---|---|---|
| "X is not configured yet. Add EXPO_PUBLIC_X_CLIENT_ID" | Client ID env var missing from build | Add the var in Vercel dashboard → redeploy |
| OAuth redirect loops back to login | Redirect URI mismatch | Add the exact redirect URI to your developer app |
| "Social account not found" on publish | Account disconnected or token expired | Reconnect the account in Social Accounts |
| TikTok posts don't appear publicly | App not approved for Content Posting API | Submit for app review at developers.tiktok.com |
| Facebook "Page not found in user's pages" | Wrong Page ID or missing admin access | Verify `external_account_id` is the Page ID and the connected user has Page admin role |
