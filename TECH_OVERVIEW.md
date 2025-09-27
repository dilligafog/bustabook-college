# Technical Overview – BustaBook College Picks

_Last updated: 2025-09-26_

## 🧭 Summary

This document captures the current architecture, data shapes, automation, and UI behaviors of the college football picks site. It is intended to inform the upcoming merger with the NFL property so shared components can be reused and the remaining gaps are clear.

## ⚙️ High-Level Architecture

- **Static frontend** served from `index.html` (game list) and `game.html` (detail view).
- **Data files** under `data/` provide content at runtime via `fetch` calls.
- **Node build script** (`build-manifest.js`) normalizes game JSON, builds `manifest.json`, and maintains `all-scores.json` from daily API pulls.
- **Automation** orchestrated via Cronicle: `fetch_scores.py` → `build-manifest.js` → git commit/push.
- **Authoring helpers** generate empty game files and strict prompts to keep JSON structure consistent.

```
┌──────────┐    ┌──────────────────────┐    ┌────────────────────┐
│ Cronicle │──▶│ fetch_scores.py      │──▶│ build-manifest.js   │
└──────────┘    └─────────┬────────────┘    └──────┬─────────────┘
                           │                         │
                           ▼                         ▼
                      data/scores.json         data/manifest.json
                                                 data/all-scores.json
                           │                         │
                           └────────────┬────────────┘
                                        ▼
                           Browser (js/utils.js + js/main.js/js/game.js)
```

## 🖥️ Frontend Stack & Entry Points

- **Plain HTML + Vanilla JS**: no bundler/build step. Scripts are loaded directly in the browser.
- **Styling**: Tailwind CDN + Flowbite components, plus local `css/dark-mode.css` for the betting theme.
- **Entrypoints**:
  - `index.html` renders the schedule grid using `js/main.js`.
  - `game.html` shows a single analysis via `js/game.js`.
- **Runtime modules** (`js/`):
  - `utils.js`
    - `DataUtils.loadJSON` adds cache busting and `cache: 'no-store'` to defeat stale fetches.
    - `DataUtils.loadScores` consumes `all-scores.json`, coercing numeric fields, deriving `status`, `completed`, `in_progress`, and providing short/long team labels.
    - `DataUtils.discoverGameFiles` now requires `data/manifest.json`; no fallback scanning.
    - Ohio-team helper toggles the 🌰 emoji for status badges.
    - `ThemeUtils` persists dark/light mode.
  - `main.js`
    - Downloads scores first, then iterates manifest entries that expose `has_detailed_data`.
    - Builds day-grouped cards, uses derived status ordering (live → upcoming → completed) and card min-height to keep layout consistent.
    - Evaluates best bets with normalized pick parsing (handles `PK`, unicode fractions, moneyline strings) to avoid type-driven push errors.
  - `game.js`
    - Loads the specific game JSON using the manifest-selected filename.
    - Reuses utility functions for status, theming, and renders modular sections (teams, odds, history, picks, etc.).
- **Cache strategy**: timestamp query params + `no-store` ensures manifest/game JSON hot reload during live updates.

## 📁 Data Directory & Formats

```
data/
├── manifest.json            # Built index of all games (detailed vs score-only)
├── all-scores.json          # Canonical rolling score store (array of games)
├── scores.json              # Latest 3-day pull from The Odds API (overwritten daily)
├── game-*.json              # Current-season detailed analysis files
├── historic/week4/...       # Archived detailed game files still shown in UI
├── deep-archive/...         # Legacy games excluded from manifest
├── my_events.json           # Author-curated list of desired matchups
├── events.json              # Full feed dump (source of event IDs)
└── ...
```

- **Game JSON schema** (enforced by prompt template):
  - `game_meta` contains `game_id`, `title`, `datetime_local` (ISO with timezone), `venue`, rankings, hype factors.
  - `teams.away/home` include conference, record, recent form, key stats, motivation factors.
  - `odds` block carries spread/total/moneyline lines as numbers; pick strings use ASCII and decimals only.
  - `picks` object includes `best_bet`, `spread`, `total`, `moneyline` with `confidence` floats (0–1) and textual rationales.
  - Supporting sections (`matchup_history`, `betting_angles`, `notables`, `excitement_factors`, `sources`).
- **Score data**:
  - `all-scores.json` array items with nested `home_team` and `away_team` objects (`name`, `short`, `score`).
  - `DataUtils.loadScores` ensures integers, derives live/final state from `completed`, `quarter`, `time_remaining`, and `last_update`.
  - `in_progress` flag triggers UI status badges and live score displays.

## 🛠️ Build & Ingestion Pipeline

- `build-manifest.js`
  - Recursively scans `data/` (excluding `deep-archive/`) for `game-*.json`.
  - Cleans malformed JSON artifacts (escaped brackets, zero-width chars) before parsing.
  - Validates each file has `game_meta.game_id`; annotates manifest entries with `has_detailed_data` and relative filename paths (supports subdirectories like `historic/week4/...`).
  - Loads latest `scores.json` and merges with previous `all-scores.json` via `mergeScoresArrays` (prefers newer `last_update` or completed records), writing back a sorted `all-scores.json`.
  - Adds score-only games for events present in scores feed but missing detailed JSON (`score_only: true`).
- `package.json` scripts:
  - `npm run build` → `node build-manifest.js`.
  - `npm run serve` → `python3 -m http.server 8080` (static hosting for local dev).
  - `npm run dev` builds then serves.

## 🤖 Automation & Scheduling

- `scripts/fetch_scores.py`
  - Calls The Odds API (`americanfootball_ncaaf`, configurable `DAYS_FROM`, `dateFormat=iso`).
  - Requires `ODDS_API_KEY` in environment.
  - Filters to valid entries (`id`, `home_team`, `away_team`), writes `data/new-scores.json`, then atomically replaces `data/scores.json`.
- `scripts/cronicle_job.sh`
  - Cronicle-compatible shell plugin; emits JSON progress/completion payloads.
  - Executes workflow as `bustabook` user while preserving `ODDS_API_KEY`.
  - Steps: fetch scores → build manifest → `git add`/commit/push if changes exist.
  - Failure at any step reports non-zero `code` in JSON line for Cronicle dashboard.
- Outputs enable near-real-time updates without manual intervention.

## ✍️ Content Authoring Workflow

- `scripts/scaffold_games_from_my_events.py`
  - Reads `my_events.json`, matches to `events.json` (±1 day tolerance, normalized team names).
  - Creates empty `game-<away>-vs-<home>-<date>.json` only when a valid event ID exists.
- `scripts/print_event_prompts.py`
  - Finds empty game files and prints a detailed instructions block (strict data types, pick formatting, JSON skeleton) including target filename and authoritative `game_id`.
  - Ensures contributors produce machine-friendly JSON, avoiding unicode fractions or stringified numbers.

## 🎨 UI & Theming Notes

- Tailwind utility classes for layout; Flowbite for UI polish.
- Custom tweaks:
  - Status badges show 🌰 for Ohio matchups (via `DataUtils.isOhioTeam`).
  - Card headers enforce `min-h-[3.5rem]` to align differing team name lengths.
  - Live games get blue borders and "LIVE" chip.
- Dark mode toggled via `ThemeUtils`; class `bb-dark` drives alternate palette in `css/dark-mode.css`.

## 📈 Betting Logic Reference

- `main.js` bet grading handles:
  - Moneyline picks with optional attached prices (e.g., `TENN +145 ML`).
  - Spread parsing with normalized text (including `PK`, unicode minus, decimals).
  - Totals with `Over/Under` and decimal points only.
  - Returns `won`, `lost`, or `push` based on normalized numeric comparisons.
- Logs verbose debugging in console for transparency during QA.

## 🔁 Reuse & NFL Integration Opportunities

- **Reusable components**:
  - Frontend modules (`js/utils.js`, `js/main.js`, `js/game.js`) are league-agnostic once team-specific decorations (e.g., Ohio emoji) are parameterized.
  - Data ingestion pipeline (`build-manifest.js`, `fetch_scores.py`, Cronicle job) can be cloned with sport key/env tweaks.
  - Authoring helpers already abstract away by event ID—swap to NFL feed and update prompt text.
- **Items to parameterize for joint site**:
  - Branding assets (titles, emojis, copy) per league.
  - Conference/team metadata (Ohio logic, `hype_factors`, etc.).
  - API sport keys and potential differences in Odds API response fields.
  - Directory layout (`data/college/...` vs `data/nfl/...`) if co-hosting in single repo.

## 🚧 Known Considerations & Gaps

- Manifest currently excludes `deep-archive/`; decide if legacy NFL data needs a similar tiering system.
- No client-side router—league switch would require separate entrypoints or runtime toggles.
- Static hosting assumes friendly CORS for JSON files; ensure joint site deployment mirrors this environment.
- Accessibility and SEO polish (meta tags, alt text) could be revisited during the merger.

---

For questions or updates, edit this document (`TECH_OVERVIEW.md`) alongside any architectural changes so both league sites stay in sync.
