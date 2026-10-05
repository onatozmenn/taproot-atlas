# DESIGN.md — America.gov AI screen audit + Taproot Atlas adaptation

> Scope: AI chat screen only (no landing). Goal: America.gov AI UX parity,
> water-themed, with a custom logo (no US flag).

## 0. Method (honest)

- Direct fetch of `https://www.america.gov/` and `/how-it-works` returned
  **HTTP 403** from this network (bot protection), so no DOM/CSS was copied.
- This audit is compiled from secondary sources accessed 2026-10-05:
  - CGTN portal report (hero copy, search-bar behavior, voice input, example
    prompt `"How do I get a passport for my child?"`, official-source answers).
  - FedScoop launch report (open search bar, `"Whatever you need from the
    government, start here."`, Gemini+Grok, Login.gov integration, privacy
    notice `"share only what's needed"`, 2h hash cache, 29k sites).
  - Engadget (no account, no history retained, no precise GPS, declines
    non-government topics, `/coming-soon` task completion).
  - White House fact sheet (single point of entry, plain language, sign-in,
    accurate answers, transactions later).
  - USA.gov fetch (USWDS banner, Menu pattern, topic grid — reference only).
  - Threads OCR snippet (`america.gov … Menu / Hello, America / Whatever you
    need from government, start here. / Try …`).
- Tokens below are **USWDS + National Design Studio inferences**, not scraped
  values. Re-verify against the live site before calling it pixel-perfect.

## 1. America.gov AI screen — element by element

### 1.1 Top bar
- Left: lowercase wordmark `america.gov` (sans, ~17–20px, weight 600–700).
- Right: `Menu` pill button (dark navy fill, white text, radius 999).
- Height ~64–72px, white bg, no border or 1px `#dfe1e2` bottom hairline.
- Mobile: same row, condensed.

### 1.2 Official banner (expected, USWDS pattern)
- Slim strip above header: `An official website of the United States
  government — Here's how you know`.
- ~24–32px, gray-50 bg, 12–13px text. (Standard on .gov; keep an equivalent
  honesty strip in our adaptation.)

### 1.3 Hero (empty state, centered, max-w ~720–880px)
- Eyebrow: none (no badge row).
- H1: `Hello, America` — very large (clamp 40–64px), tight tracking
  (-0.02em), weight 700–800, sans (Inter/Public Sans style), centered.
  Post-login demo: `Hello` + first name.
- Sub: `Whatever you need from government, start here.` — 17–20px,
  `#5b616b`-ish gray, centered, one line on desktop.
- Spacing: ~64–96px top padding, 16–24px H1→sub gap, 24–32px sub→search gap.

### 1.4 Search / composer (the centerpiece)
- Single pill: radius 999, white fill, 1px `#dfe1e2` border + soft shadow
  (`0 1px 2px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.08)`), height ~60–68px,
  full column width.
- Left: magnifier or spark icon (muted), input 16–17px, placeholder
  `Help me find a new job` (rotating example prompts).
- Right inside pill: mic (voice input) ghost button + circular send button
  (navy fill `#0a3161`, white `↑`, 40–44px).
- Focus: 2–3px `#005ea8` outline offset 2px (USWDS focus).
- Under-search microcopy (12–13px muted, centered):
  `Share only what's needed · Approximate location · AI providers do not
  retain prompts · Responses cached ~2h by hash`.

### 1.5 Try / starter chips
- Label sometimes `Try` + 3 pills: e.g. passport-for-child, campsite booking,
  Social Security replacement.
- Pills: white, 1px border, radius 999, 14px, hover border → accent + text →
  accent. Wrap on mobile.

### 1.6 Thread (after first send)
- Hero collapses; conversation is a single centered column (max-w 760px).
- User turn: right-aligned gray bubble (`#f1f3f6`, radius 20, max-w 70–80%).
- Assistant turn: full-width, **no bubble** — answer cards + source list.
- Answer anatomy: direct answer → `Sources` (official .gov links w/ agency
  name) → `Next steps` (numbered actions w/ deep links). Never a bare link
  dump.
- Typing state: muted italic `Looking up official sources…` + subtle pulse.
- Follow-ups: same pill chips, generated from the last answer.
- Feedback row per answer: `Helpful / Not helpful / Copy` (small ghost
  pills). Copy → `Copied` for ~1.5s.
- Thread action: `Start over` ghost pill, top-right of thread.
- Out-of-scope: polite decline (`I can only help with government services…`).

### 1.7 Menu overlay
- `Menu` opens a small dropdown/panel: agency/topic links + `Start over`.
- Esc closes, focus returns to Menu. `aria-expanded` on the button.

### 1.8 Footer
- Composer stays sticky-bottom (white, blur-safe), footnote 12px muted:
  privacy + `AI can make mistakes — verify at the official source.`

### 1.9 Tokens (inferred USWDS-ish)
```
--bg: #ffffff
--ink: #1b1b1b
--muted: #5b616b
--line: #dfe1e2
--bubble: #f1f3f6
--navy: #0a3161        /* primary-darker / send + menu */
--accent: #005ea8      /* links, focus */
--danger: #b31942      /* errors only */
font: "Public Sans", "Inter", "Source Sans 3", system-ui, sans-serif
display: same stack, 700–800, -0.02em
radius: pill 999 / card 12 / bubble 20
shadow-search: 0 1px 2px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.08)
```

### 1.10 Accessibility
- `Skip to conversation` link, `aria-live="polite"` thread, labeled icon
  buttons, visible focus, `prefers-reduced-motion` disables pulse.

## 2. Taproot Atlas adaptation (this repo)

Same skeleton, water content, custom brand. AI screen only — no landing.

| America.gov | Taproot Atlas |
|---|---|
| `america.gov` wordmark | Droplet + `Taproot Atlas` + `Water snapshot` tag |
| Official .gov strip | Honesty strip: `Demonstration snapshot · EPA / NYC open data · No precise location stored` |
| `Hello, America` | `Hello — where does your tap water come from?` |
| `Whatever you need from government, start here.` | `Whatever you need to know about your water, start here.` |
| Placeholder `Help me find a new job` | Rotating water prompts (`Where does my tap water come from?` …) |
| Sources = .gov links | Sources = ECHO profile + DEP filing + versioned snapshot |
| Next steps = agency tasks | Next steps = chips from Resolver facts (`suggest.ts`) |
| Map: none | Schematic map card (our domain addition, same card language) |
| Flag / eagle brand | Custom droplet logo (no flag) — `web/src/components/Logo.tsx` |

Out-of-scope guardrail equivalent: health-verdict requests get a compliance
framing, never `safe/drinkable/pure` (`lib/guardrails.ts`).

## 3. Implementation map (files)

- `web/index.html` — title/meta + font stack (system, no webfont dep).
- `web/src/components/Logo.tsx` — droplet mark (navy→teal gradient, basin
  flow lines, tap node). Only brand asset; flag removed everywhere.
- `web/src/App.tsx` — banner + header + hero + sticky composer + thread +
  menu + feedback/copy + mic (Web Speech API, progressive enhancement).
- `web/src/App.css` — tokens + pill search w/ shadow + cards + focus +
  reduced-motion + responsive.
- `web/src/components/Answer.tsx` — answer card keeps `ValidationLine`,
  markdown overview, `RealMap`, metric cards, compliance block.
- `web/src/suggest.ts` — chips stay fact-only (unchanged contract).

## 5. Screenshot audit (2026-10-05, user-provided SS ×3) — applied pixel notes

Thread + working + done states of the campsite conversation:

- Header: flag glyph + `America.gov` in a transitional serif (matches
  Newsreader) ~25px weight ~500, no tag pill, no hairline; `Menu` navy pill
  (`#0a2f5c` family, 14×30px, 16.5px/600). → Ours: droplet + `Taproot Atlas`
  in Newsreader, same Menu geometry.
- User turn: right-aligned single bubble, `#eef2f6` fill, radius ~22,
  13×22px padding, 16.5px. One bubble per turn, no avatar.
- Working: agency mark (~19px) + `Working` (ink, 600) + `through your
  request…` (muted `#94a3b8`). → Ours: droplet + same split phrasing.
- Answer: 17px/1.7 ink; H `Reserve a federal campsite` 19px/700 sans;
  links link-blue + underline + `↗`; phone links with tel icon;
  bullets custom `▪`; streaming tail fades to gray (we render complete
  answers; no fake streaming).
- Attribution row: `[mark + agency pill]` + `[thumbs-up | thumbs-down pill]`
  + `[copy pill]`, all `#f1f5f9` radius 999. → Ours: same row with
  `systemName · PWSID` source pill; icon-only rate/copy buttons (aria
  labels kept, so existing tests hold).
- Follow-ups: **vertical stack**, left-aligned large outline pills
  (`#e2e8f0` border, radius 20, 17×26px, 16.5px slate text).
- Composer (all states): 2px near-black (`#101828`) pill, min-height 76,
  30px left padding, `Ask anything…` `#94a3b8` placeholder; right cluster
  clip + mic (ink) + 48px send circle. Idle: `#f1f5f9` fill, faint arrow,
  disabled. Ready: navy fill, white arrow. Working: navy fill, white
  **stop square** (ours is a live abort, not decorative).
- No .gov banner strip and no `Start over` row in-thread on this screen;
  honesty content moved to the composer footnote + `ValidationLine`.
- Font decision: **Newsreader** (Google Fonts, `display=swap`, Georgia
  fallback) for brand + hero display only; body/answers stay system sans to
  match the SS body rendering and keep offline readability.
- Map: **Protomaps vector basemap via MapLibre GL** (`maplibre-gl` +
  `pmtiles` + `@protomaps/basemaps`, `light` flavor, `en` labels) replaces
  Leaflet raster. Source order: `VITE_PROTOMAPS_TILES_URL` (self-hosted
  `.pmtiles`) → `VITE_PROTOMAPS_API_KEY` (hosted TileJSON) → OSM raster
  fallback (no key, previews keep working). Schematic overlay (navy dashed
  connector, points, labels, popups) is GeoJSON in the same MapLibre
  instance. Footer attribution switches Protomaps/OSM vs OSM-only.

## 4. Verify (America.gov parity checklist)

- [ ] Header: logo left, Menu pill right, 64–72px, hairline.
- [ ] Hero centered, H1 clamp(40–56px), sub muted, spacing per §1.3.
- [ ] Search pill w/ shadow, mic + navy send inside, focus ring.
- [ ] Try chips ×3, wrap on mobile.
- [ ] Privacy microcopy under composer.
- [ ] Thread: right gray user bubble, full-width assistant, source + next-step
      anatomy, typing pulse, Start over, feedback/copy.
- [ ] Menu opens/closes, Esc works, focus returns.
- [ ] `npm --prefix web run test` + `build` green.
