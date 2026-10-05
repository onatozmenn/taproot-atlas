# Taproot Atlas

Source-to-tap water intelligence for the Xylem Global Student Innovation Challenge
(Water Quality track, Access fallback, Quantity context).

Ask in everyday words where tap water comes from. A deterministic Resolver owns all
facts (PWSID, basins, lab metrics, SDWIS window); a guarded LLM only narrates; a
deterministic fallback renders when audit fails. The America.gov-style chat UI shows
every answer on a schematic map with Verified/Modeled badges.

## Quickstart

```bash
npx tsc            # core typecheck + build -> dist/
npm test           # build + node:test suite (core)
npm run eval       # 32-case guardrail regression gate
npm --prefix web install  # one-time web deps
npm --prefix web run test # vitest suite
npm --prefix web run dev   # chat UI at http://localhost:5173
```

## Preview deploys

`vercel.json` builds `web/` as a static Vite site. One-time setup (owner):
Vercel dashboard → Add New Project → import `taproot-atlas` → the repo config
handles install/build/output. Every web PR then gets a preview URL from the
Vercel bot — review UI changes there, never blind. Preview uses the
snapshot-backed pipeline (no secrets, no live keys).

## Production (`POST /api/ask`)

`api/ask.ts` runs the full pipeline server-side on Vercel. With AI env vars
set, a model drafts the narrative (always re-audited; template fallback on any
failure). Without a key it serves the audited template path. The browser never
sees the key — only audited `ValidatedApiResponse` JSON leaves the function.

Dashboard → Project → Settings → Environment Variables:

| Variable | Value |
| -------- | ----- |
| `AI_BASE_URL` | Narrator root (default `https://api.openai.com/v1`; Zen: `https://opencode.ai/zen/v1`) |
| `AI_API_MODE` | `responses` or `chat-completions` (OpenAI-compatible) |
| `AI_MODEL` | Model id (default `gpt-4o-mini`) |
| `AI_API_KEY` | Narrator key (empty = audited template; never commit it) — model output additionally requires `JEV_API_KEY`, otherwise every draft falls back to template |
| `JEV_BASE_URL` | JEV root (default `https://opencode.ai/zen`, i.e. `/v1/systemone`) |
| `JEV_MODEL` | JEV model (default `jev-1.13-free`, free tier) |
| `JEV_API_KEY` | Zen key for JEV (empty = deterministic audit only) |

Local check without deploying: `npm --prefix web run test` covers the handler
(`api-server.test.ts`), and the chat falls back to the local pipeline when
`/api/ask` is unreachable.

## Architecture

1. **Deterministic Resolver** (single authority, `types/water-intelligence.ts` contract):
   resolves PWSID via point-in-polygon or the curated city directory, classifies boundary confidence
   (`verified_agency` / `modeled_epa` / `unverified_fallback`), loads reported lab
   metrics + SDWIS compliance window, builds schematic GeoJSON (approximate only).
2. **JEV gate** (`lib/jev-audit.ts`): the model draft is judged on grounding,
   health-certification, coordinate leaks, and off-topic answers. Pass exits;
   flag or no verdict falls back. Deterministic template output skips the
   judge (nothing to judge). Regex guardrails (`lib/guardrails.ts`) are
   advisory telemetry only — logged, never blocking.
3. **LLM narrator** (English only, `prompts/system.ts`): summarizes Resolver facts.
   Adds no numbers, coordinates, or verdicts.
4. **Deterministic fallback** (`lib/fallback-template.ts`): provenance-first summary
   rendered directly from ground truth when audit fails.
5. **Web** (`web/`, Vite + React + TS): America.gov-style chat + schematic SVG map +
   report cards. Every metric shows test date, report period, capture time, source link.

## Data layers

- Service boundary + origin: EPA Service Area Boundaries (PWSID) + NYC DEP watershed
  schematic. Labeled Verified vs Modeled.
- Compliance: EPA SDWIS / ECHO (`https://echo.epa.gov/`), explicit 5-year window.
- Tap quality: NYC distribution monitoring + Annual Drinking Water Supply and Quality
  Report (`https://www.nyc.gov/site/dep/water/drinking-water.page`). Reported lab
  tests only. No real-time safety guarantee.
- Public access fallback: OpenStreetMap `amenity=drinking_water` outside the showcase
  boundary, always `unverified_fallback`.

## Health and honesty rules

- Never output "safe", "drinkable", "pure" as a verdict; frame compliance with date,
  threshold, and source.
- Schematic paths are approximations, never engineering alignments.
- Zero violations = "no records found in window" + ECHO link.

## Showcase

Primary: New York City (PWSID example: NYC DEP system) plus a top-100 US
systems directory (verified PWSIDs from EPA SDWIS; curated basins + metrics
only where vendored, honest pending states elsewhere). Global fallback: nearby
public drinking points with explicit unverified-boundary notice.

## Repo hygiene

- `main` only via PR; CI runs core `check` + `test` and web `build`.
- CodeRabbit reviews every PR (`.coderabbit.yaml` — install the app at coderabbit.ai).
- See `docs/ARCHITECTURE.md` and the `good first issue` labels to start.
- Demo in 3 minutes: `docs/DEMO.md`. Contributing: `CONTRIBUTING.md`.
