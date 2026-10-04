# Contributing to taproot-atlas

## Ground rules (non-negotiable)
1. **Resolver owns facts.** Numbers, basin names, and parameters come from `lib/` + `data/` only. UI and narrator never invent them.
2. **No health verdicts.** Never write safe / drinkable / pure / potable about water. Frame compliance with date, threshold, and source.
3. **Provenance or it didn't happen.** Every metric needs test date + report period + capture time + source link.
4. **Schematic means schematic.** Map overlays carry the disclaimer; tiles are context only.

## Workflow
- `main` only via PR. CI must be green: core `check` + `test` + `eval`, web `test` + `build`.
- Link issues (`Closes #NNN`) and fill the PR template's Ground-truth section.
- CodeRabbit reviews every PR — address its findings before merge.
- Add or extend tests with every change: `tests/` for core, `web/src/**/*.test.*` for UI.
- New datasets go versioned under `data/` with a `docs/DATA.md` row (see issues labeled `data`).

## Commands
```bash
npm run check          # core typecheck
npm test               # core build + 40 node:test cases
npm run eval           # 32-case guardrail gate
npm --prefix web run test    # vitest suite
npm --prefix web run dev     # chat UI at localhost:5173
```

## Labels for starters
Newcomers: look for `good first issue` (docs, chips copy, a11y checks, eval cases).
Maintainers: keep at least two starter issues open during the challenge.

## Branch protection (owner checklist)
Settings → Branches → Add rule for `main`: require PR before merging, require
status checks (ci/core + ci/web), require CodeRabbit review. Screenshot the rule
into the tracking issue (#20).
