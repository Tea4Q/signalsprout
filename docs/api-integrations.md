# SignalSprout — API Integrations

---

## Instagram Graph API (v21+)

### OAuth Setup

1. Create a Facebook Developer App at https://developers.facebook.com
2. Add the **Instagram Graph API** product.
3. Required permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `instagram_manage_insights`
   - `pages_read_engagement`
4. Set the OAuth redirect URI to your app's callback endpoint.

### Credential Storage

Store the following in SignalSprout's credential vault for each social account:

| Key | Description |
|---|---|
| `access_token` | Long-lived page access token (60-day expiry; auto-refreshed via `refreshInstagramToken` in `publish-post` Edge Function) |
| `instagram_account_id` | The Instagram Business Account ID |
| `page_id` | Facebook Page ID linked to the IG account |

### Publishing a Post (Reels / Feed)

```
POST /v21.0/{ig-account-id}/media
  → returns container_id

POST /v21.0/{ig-account-id}/media_publish
  → { container_id }
  → returns media_id (stored as posts.external_post_id)
```

### Reels Video Constraints

SignalSprout enforces these limits client-side before upload to surface clear errors rather than cryptic Graph API rejections:

| Constraint | Limit | Enforced by |
|---|---|---|
| Video duration | 90 seconds maximum | `uploadVideo` in `assetService.ts` |
| Video file size | 500 MB maximum | `uploadVideo` in `assetService.ts` |
| Image dimensions | Resized to 1920 px max (longest side) | `resizeForUpload` helper |
| Image compression | JPEG quality 0.82 | `resizeForUpload` helper |

### Fetching Metrics

```
GET /v21.0/{media-id}/insights
  ?metric=impressions,reach,likes,comments,saves,shares
  &period=lifetime
```

Metrics are ingested daily by the `ingest-metrics` Edge Function and stored in `platform_metrics`.

### Rate Limits

- 200 calls per user per hour
- Content publishing: 25 posts per 24 hours per account

---

## Pinterest API v5

### OAuth Setup

1. Create a Pinterest App at https://developers.pinterest.com
2. Required scopes:
   - `boards:read`
   - `boards:write`
   - `pins:read`
   - `pins:write`
   - `user_accounts:read`
   - `analytics:read`
3. Set the OAuth redirect URI to your app's callback endpoint.

### Credential Storage

| Key | Description |
|---|---|
| `access_token` | OAuth 2.0 access token |
| `refresh_token` | Refresh token (valid for 1 year) |
| `board_id` | Default board ID for publishing |

### Publishing a Pin

```
POST /v5/pins
{
  "board_id": "...",
  "media_source": {
    "source_type": "image_url",
    "url": "https://..."
  },
  "title": "...",
  "description": "...",
  "link": "https://..."
}
```

### Fetching Metrics

```
GET /v5/user_account/analytics
  ?start_date=YYYY-MM-DD
  &end_date=YYYY-MM-DD
  &metric_types=IMPRESSION,ENGAGEMENT,PIN_CLICK
```

---

## OpenAI (Caption & Image Generation)

Store the `OPENAI_API_KEY` as a Supabase Edge Function secret (never in the client or credential vault).

### Caption Generation

Edge Function: `generate-caption`

Uses `gpt-4o-mini` with a system prompt from `prompts/caption-system.txt` and the brand's tone profile.

### Image Generation

Edge Function: `generate-image`

Uses `dall-e-3` with a prompt constructed from the post content + image prompt system (`prompts/image-prompt-system.txt`).

---

## Supabase Edge Functions — Environment Secrets

Set the following via `supabase secrets set` or the Supabase dashboard:

```bash
OPENAI_API_KEY=sk-...
INSTAGRAM_CLIENT_SECRET=...
FACEBOOK_CLIENT_SECRET=...         # Same Meta app secret as Instagram
TIKTOK_CLIENT_SECRET=...
PINTEREST_CLIENT_SECRET=...
X_CLIENT_SECRET=...
VAULT_MASTER_KEY=<32-byte hex>     # Used for envelope encryption
```

---

## Facebook Graph API (Pages)

### OAuth Setup

Uses the same Meta Developer app as Instagram. Additional permissions required:

- `pages_manage_posts`
- `pages_read_engagement`
- `pages_show_list` (required to exchange the user token for a Page access token at publish time)

### Token Exchange at Publish Time

The OAuth flow returns a **user access token**. Publishing to a Page requires a **Page access token**, which is obtained server-side at publish time:

```
GET /v21.0/me/accounts?access_token={user_token}
→ returns array of pages the user manages, each with its own access_token
```

SignalSprout finds the matching page by `external_account_id` (the Facebook Page ID stored on `social_accounts`) and uses that page's access token for all publish calls.

### Publishing a Photo Post

```
POST /v21.0/{page_id}/photos
Content-Type: application/x-www-form-urlencoded

message={caption}
url={signed_image_url}
access_token={page_access_token}

→ { id: "photo_id", post_id: "page_post_id" }
```

`post_id` is stored as `posts.external_post_id`.

### Publishing a Text-Only Post

```
POST /v21.0/{page_id}/feed
Content-Type: application/x-www-form-urlencoded

message={caption}
access_token={page_access_token}

→ { id: "page_post_id" }
```

### Rate Limits

- 200 calls per user per hour (shared with Instagram)
- Content publishing: 25 posts per 24 hours per Page

---

## TikTok Content Posting API v2

### OAuth Setup

1. Create a TikTok Developer app at https://developers.tiktok.com
2. Add the **Content Posting API** product
3. Required scope: `video.publish` (replaces the deprecated `video.list`)
4. Uses PKCE (code_challenge / S256) — `usesPkce: true` in `lib/platforms/config.ts`

### Initiating a Photo Post

```
POST https://open.tiktokapis.com/v2/post/publish/content/init/
Authorization: Bearer {access_token}
Content-Type: application/json; charset=UTF-8

{
  "post_info": {
    "title": "{caption}",
    "privacy_level": "PUBLIC_TO_EVERYONE",
    "disable_comment": false
  },
  "source_info": {
    "source": "PULL_FROM_URL",
    "photo_images": ["{signed_url_1}", "{signed_url_2}"],
    "photo_cover_index": 0
  },
  "post_mode": "DIRECT_POST",
  "media_type": "PHOTO"
}

→ { data: { publish_id: "..." }, error: { code: "ok" } }
```

Supports up to 35 images per post (TikTok carousel).

### Polling for Completion

TikTok processes `PULL_FROM_URL` requests asynchronously. Poll until `PUBLISH_COMPLETE` or `FAILED`:

```
POST https://open.tiktokapis.com/v2/post/publish/status/fetch/
Authorization: Bearer {access_token}
Content-Type: application/json; charset=UTF-8

{ "publish_id": "..." }

→ {
    data: {
      status: "PUBLISH_COMPLETE" | "PROCESSING_DOWNLOAD" | "PROCESSING_UPLOAD" | "FAILED",
      publicaly_available_post_id: ["..."],   // TikTok's spelling
      fail_reason: "..."
    }
  }
```

`publicaly_available_post_id[0]` (note TikTok's typo) is stored as `posts.external_post_id`.

SignalSprout polls up to 5 times with 3-second intervals. If the status is still processing after 5 polls, the `publish_id` is stored as a best-effort ID — TikTok continues processing in the background.

### Initiating a Video Post

```
POST https://open.tiktokapis.com/v2/post/publish/video/init/
Authorization: Bearer {access_token}
Content-Type: application/json; charset=UTF-8

{
  "post_info": {
    "title": "{caption}",
    "privacy_level": "PUBLIC_TO_EVERYONE",
    "disable_comment": false
  },
  "source_info": {
    "source": "PULL_FROM_URL",
    "video_url": "{signed_url}"
  },
  "post_mode": "DIRECT_POST",
  "media_type": "VIDEO"
}

→ { data: { publish_id: "..." }, error: { code: "ok" } }
```

Poll for status using the same `/v2/post/publish/status/fetch/` endpoint described under Photo Post above.

### Video Upload Constraints

| Constraint | Limit |
|---|---|
| Max file size | 500 MB |
| Max duration (picker) | 10 minutes (600 s) |
| Recommended for cross-platform (Reels + TikTok) | 90 seconds or less |

### Rate Limits

- Content Posting API: 20 requests per minute per access token
- Max post frequency: varies by account tier

### ⚠️ Sandbox Requirement

The Content Posting API requires TikTok app review before posts can reach accounts other than the developer's own. Submit for review at https://developers.tiktok.com/products/content-posting-api/
