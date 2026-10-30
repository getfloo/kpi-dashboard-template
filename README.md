# KPI dashboard template for floo

A KPI dashboard for your team: every metric you track on one page, with targets and trends, kept current by people and by the scripts and agents that push numbers through its API.

## What you get

- Sign-in for your team with floo accounts. Admins create and edit metrics; members record values.
- A dashboard of metric cards: latest value, change since the previous value, target status and a sparkline. Each metric has a page with its full chart, history table and a form to record a value.
- Managed Postgres with Drizzle migrations that run once per deploy.
- An agent API: push one value, push many in one call, or read a metric with its history, using an app API key. The OpenAPI document is generated from the same validators the app uses.
- Safe retries: a value sent again for the same metric and `recordedAt` replaces the old one, so a scheduled push never double counts.

## Deploy with your agent

Paste this into Claude Code, Codex or Cursor:

```text
Deploy https://github.com/getfloo/kpi-dashboard-template on floo. Follow https://getfloo.com/agents.md.
```

Or do it yourself. Click **Use this template** on GitHub to create your own repo, install the [floo GitHub App](https://github.com/apps/getfloo/installations/new) on it, then:

```sh
floo apps github setup
floo preflight
floo apps github connect <owner>/<repo>
floo apps github status --app kpi-dashboard
floo deploys status --app kpi-dashboard
```

`floo.app.toml` is already in the repo, so there is no `floo init` step. Every push after that deploys to dev. Invite your team with `floo apps invite teammate@example.com --role member --app kpi-dashboard`.

### Push a value from a script

Mint an app API key with the `api` scope (the raw key is printed once):

```sh
floo apps consumers create nightly-agent
floo apps keys create nightly-agent --consumer nightly-agent --scope api
```

Then send it as `Authorization: Bearer` to the app URL that `floo deploys status` prints:

```sh
curl -X POST "$APP_URL/api/metrics/weekly_signups/points" \
  -H "Authorization: Bearer $FLOO_APP_KEY" \
  -H "Content-Type: application/json" \
  -d '{"value": 412, "recordedAt": "2026-10-30"}'
```

Leave out `recordedAt` to record the current time. Send many values at once with `POST /api/points` and `{"points": [{"metric": "weekly_signups", "value": 412}, ...]}`. The full contract is at `/api/openapi.json` (with the key) and `/api-docs` (signed in).

## Customize

Give your agent prompts like these:

- "Add a weekly agent job that reads our signups from the product database and pushes them to `weekly_signups` every Monday at 09:00 UTC."
- "Group metrics into sections like Growth, Reliability and Support, with a filter at the top of the dashboard."
- "Add a 'warning' status when a metric is within 10% of its target, and show it on the cards."
- "Let admins add a note to any recorded value, shown in the history table and returned by the API."
- "Post to our Slack channel when a metric goes off target."

## Local development

```sh
npm install
floo dev --fixture-user you@example.com --fixture-role admin
floo run --service web -- npm run seed
```

`floo dev` runs the app against your dev database, signed in as the fixture user (the default role is `member`). `npm run seed` adds eight sample metrics with a few weeks of history, and is safe to rerun. It never runs on deploy. `npm test` runs typecheck, lint and tests without a database.

## How it works

| Route | Who | What |
|---|---|---|
| `/` | Signed in | Dashboard of metric cards |
| `/metrics/<key>` | Signed in | Chart, history table, record a value |
| `/metrics/new`, `/metrics/<key>/edit` | Admins | Create or edit a metric |
| `/api-docs` | Signed in | API reference |
| `/api/*` | App API key, `api` scope | JSON API |

**Roles.** floo sends each person's app role, `admin` or `member`. Server actions check it: only admins create or edit metrics, anyone signed in records values. An API key holding the `api` scope can create and edit metrics and record values.

**Data model.** `metrics`: `key` (unique, stable, used in URLs and the API), `name`, `unit`, `target`, `direction` (`higher` or `lower` is better), `owner`. `data_points`: `metric_id`, `value`, `recorded_at` (unique per metric), and the source that recorded it: a user, or the API consumer that holds the key.

**Status and change.** A metric is on target when its latest value is at or above the target (or at or below it when lower is better). Change compares the latest value with the one recorded before it.

**API.**

| Method | Path | Does |
|---|---|---|
| `GET` | `/api/metrics` | Every metric with its latest value, previous value and status |
| `POST` | `/api/metrics` | Create a metric |
| `GET` | `/api/metrics/{key}?limit=100` | A metric with its most recent values, oldest first |
| `PATCH` | `/api/metrics/{key}` | Change a metric's name, unit, target, direction or owner |
| `POST` | `/api/metrics/{key}/points` | Record one value |
| `POST` | `/api/points` | Record up to 1,000 values across metrics, all or nothing |

`AGENTS.md` is the working guide for coding agents: layout, identity rules, schema changes and deploys.

---

Built on [floo](https://getfloo.com): build internal software.
