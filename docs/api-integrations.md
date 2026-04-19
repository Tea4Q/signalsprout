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
INSTAGRAM_APP_ID=...
INSTAGRAM_APP_SECRET=...
PINTEREST_APP_ID=...
PINTEREST_APP_SECRET=...
VAULT_MASTER_KEY=<32-byte hex>   # Used for envelope encryption
```
