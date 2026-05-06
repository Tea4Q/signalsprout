# SignalSprout — Pricing Model & Cost Tracking

---

## Cost Tracking Methodology

SignalSprout helps content creators understand the true cost of running their social media operations by tracking spend across two categories:

### 1. AI Tool Costs

Costs incurred for AI services used inside SignalSprout or externally:

| Tool | Tracked Via |
|---|---|
| OpenAI (captions + images) | Per-generation entries created automatically by Edge Functions |
| Midjourney / other image tools | Manual cost source entry |
| Scheduling tools | Recurring monthly cost entry |

### 2. Advertising Spend

Manual or imported ad spend entries per brand/campaign, used to calculate ROI against impressions and engagement.

---

## Data Model

```
cost_sources       — "what" (e.g. "OpenAI API", "Meta Ads")
  id, name, type, cycle (one_time|monthly|yearly), monthly_budget

cost_entries       — "when + how much"
  id, cost_source_id, brand_id, workspace_id, amount, entry_date, notes
```

### Cost Cycles

| Cycle | Handling |
|---|---|
| `one_time` | Single entry, no recurrence |
| `monthly` | Appears in each monthly report |
| `yearly` | Amortised (÷ 12) in monthly reports |

---

## ROI Calculation

```
ROI = (impressions × CPM_benchmark - total_cost) / total_cost × 100%
```

Where `CPM_benchmark` is a configurable constant (default: $5 per 1000 impressions) representing the estimated value of organic reach.

This is calculated in `services/finance/roiService.ts`.

---

## SaaS Pricing Tiers (Planned)

| Tier | Price | Workspaces | Brands | Posts/mo | Members |
|---|---|---|---|---|---|
| **Free** | $0 | 1 | 1 | 30 | 1 |
| **Creator** | $19/mo | 1 | 3 | unlimited | 3 |
| **Studio** | $49/mo | 3 | 10 | unlimited | 10 |
| **Agency** | $149/mo | unlimited | unlimited | unlimited | unlimited |

Feature gates (planned, not yet implemented):
- Free: no AI image generation, no advanced analytics
- Creator+: AI image generation, full analytics, CSV export
- Studio+: multi-workspace, team roles, audit log
- Agency: white-label, priority support, custom integrations

Billing will be handled via Stripe. A `subscriptions` table will track tier, billing period, and Stripe subscription ID per workspace.

---

## Cost Attribution

Each `cost_entry` can optionally be linked to a `brand_id` to support per-brand cost attribution. The costs screen and dashboard support filtering by brand.

Monthly budget alerts (planned): if a `cost_source` has a `monthly_budget` set and the month's entries exceed 80%, a `recommendation` with `action = "pause"` targeting that source will be generated.
