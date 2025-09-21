#!/usr/bin/env python3
import json
import re
from pathlib import Path
import textwrap

ROOT = Path(__file__).resolve().parents[1]
MY_EVENTS = ROOT / 'data' / 'my_events.json'
EVENTS = ROOT / 'data' / 'events.json'
DATA_DIR = ROOT / 'data'

def load_json(path: Path):
    try:
        with path.open('r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        raise SystemExit(f"Missing file: {path}")
    except json.JSONDecodeError as e:
        raise SystemExit(f"Invalid JSON in {path}: {e}")

def build_event_map(events):
    mapping = {}
    for ev in events:
        ev_id = ev.get('id')
        if not ev_id:
            continue
        mapping[ev_id] = {
            'home_team': ev.get('home_team') or ev.get('home') or ev.get('homeTeam'),
            'away_team': ev.get('away_team') or ev.get('away') or ev.get('awayTeam'),
            'commence_time': ev.get('commence_time')
        }
    return mapping

def slugify(name: str) -> str:
    if not name:
        return 'team'
    s = name.lower()
    s = re.sub(r"\(.*?\)", "", s)
    s = s.replace('&', ' and ')
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip('-')
    return s

def find_game_file(away: str, home: str, date_str: str) -> Path:
    away_slug = slugify(away)
    home_slug = slugify(home)
    fname = f"game-{away_slug}-vs-{home_slug}-{date_str}.json"
    return DATA_DIR / fname

def file_is_empty(path: Path) -> bool:
    if not path.exists():
        return False
    try:
        content = path.read_text(encoding='utf-8').strip()
        return content == ''
    except Exception:
        return False

TEMPLATE_RULES = textwrap.dedent(
        """
        Create a single VALID JSON document (no comments, no trailing commas) for the game below.
        Follow these strict rules so the site parses it correctly:
        - Types:
            - Numbers: write as JSON numbers (no quotes). Examples: -3.5, 54.5, -110, 0.62
            - Booleans: true/false (lowercase JSON literals)
            - Strings: plain ASCII. Use '-' and '+' only. Do NOT use unicode fractions (½, ¼, ¾); write decimals (0.5, 0.25, 0.75).
        - Picks Formatting (strings):
            - Spread: "<Team|Home|Away> +/-<number>" (e.g., "Tennessee -3.5", "Away +7")
            - Total:  "Over <number>" or "Under <number>" (e.g., "Over 54.5")
            - ML:     "<Team|Home|Away> ML" (e.g., "Home ML", "Alabama ML")
            - Pick'em: use "+0" (e.g., "Home +0")
            - Use ASCII '-' and '.'; avoid unicode dashes and fractions.
        - Confidence: numbers between 0 and 1 (e.g., 0.62)
        - Do NOT include scores in this file. Scores come from a separate feed.
        - Use the provided game_id verbatim.
        - Use ISO local date-time with timezone offset for `game_meta.datetime_local` (e.g., "2025-09-20T19:30:00-04:00").

        JSON shape to produce:
        {
            "game_meta": {
                "game_id": "<ID PROVIDED>",
                "title": "<Away> at <Home>",
                "datetime_local": "YYYY-MM-DDTHH:MM:SS-04:00",
                "venue": "<Stadium, City ST>",
                "rankings": { "away_ap": null, "home_ap": null },
                "hype_factors": []
            },
            "teams": {
                "away": {
                    "name": "<Away>",
                    "conference": "<Conf>",
                    "record": "<W-L>",
                    "recent_form": "<short note>",
                    "key_stats": { "offense_rank": null, "defense_rank": null, "turnover_margin": 0, "ats_record": "<ATS>" }
                },
                "home": {
                    "name": "<Home>",
                    "conference": "<Conf>",
                    "record": "<W-L>",
                    "recent_form": "<short note>",
                    "key_stats": { "offense_rank": null, "defense_rank": null, "turnover_margin": 0, "ats_record": "<ATS>" }
                }
            },
            "odds": {
                "spread": {
                    "favorite": "<Team|Home|Away>",
                    "line": -3.5,
                    "opening_line": -2.5,
                    "line_movement": "<brief note>",
                    "public_betting": { "note": "<optional>" }
                },
                "total": {
                    "line": 54.5,
                    "opening_line": 52.5,
                    "line_movement": "<brief note>",
                    "over_price": -110,
                    "under_price": -110
                },
                "moneyline": {
                    "home": { "price": -150, "implied_prob": 0.60 },
                    "away": { "price": 130, "implied_prob": 0.40 }
                },
                "consensus_note": "<optional summary>"
            },
            "matchup_history": { "all_time_record": "<text>", "recent_trend": "<text>", "last_meeting": { "score": "<text>", "date": "YYYY-MM-DD" } },
            "betting_angles": { "key_trends": [], "situational_spots": [] },
            "notables": { "injuries_news": [], "matchup_notes": [], "coaching_notes": [] },
            "picks": {
                "best_bet": { "pick": "Home -3.5", "confidence": 0.62, "rationale": "<why>" },
                "spread":   { "pick": "Home -3.5", "confidence": 0.58, "rationale": "<why>" },
                "total":    { "pick": "Under 54.5", "confidence": 0.55, "rationale": "<why>" },
                "moneyline":{ "pick": "Home ML", "confidence": 0.51, "rationale": "<why>" }
            },
            "excitement_factors": { "playoff_implications": "", "conference_impact": "", "narrative": "", "tv_storylines": [] },
            "sources": [ { "label": "<source>", "type": "<type>", "asof_utc": "YYYY-MM-DDTHH:MM:SSZ" } ]
        }
        """
)

def print_prompt(away: str, home: str, ev_id: str, filename: str):
    print(f"Build the analysis JSON for: {away} at {home}")
    print(f"Use game_id: {ev_id}")
    print(f"Output file name: {filename}")
    print()
    print(TEMPLATE_RULES)

def main():
    my_events = load_json(MY_EVENTS)
    all_events = load_json(EVENTS)
    event_map = build_event_map(all_events)
    printed = set()

    # First path: prompts based on my_events, but only for files that are empty
    def alt_dates(d: str):
        # Return candidate date strings {d, d-1, d+1} for timezone tolerance
        try:
            from datetime import datetime, timedelta
            base = datetime.strptime(d, '%Y-%m-%d')
            return {
                (base + timedelta(days=delta)).strftime('%Y-%m-%d')
                for delta in (-1, 0, 1)
            }
        except Exception:
            return {d}

    for ev in my_events:
        # Prefer matching via events.json by date+teams to get the authoritative id
        date = (ev.get('date') or '').strip()
        team1 = (ev.get('team1') or '').strip()
        team2 = (ev.get('team2') or '').strip()
        if not date or not team1 or not team2:
            continue

        # Find candidate in events.json by date
        def date_only(iso: str) -> str:
            try:
                return str(iso).split('T')[0]
            except Exception:
                return ''

        # Build reverse lookup by normalized team names
        date_set = alt_dates(date)
        candidates = [e for e in all_events if date_only(e.get('commence_time')) in date_set]

        def norm(s: str) -> str:
            return re.sub(r"-+", '-', re.sub(r"[^a-z0-9]+", '-', re.sub(r"\(.*?\)", '', (s or '').lower()))).strip('-')

        match = None
        for e in candidates:
            home = e.get('home_team')
            away = e.get('away_team')
            if (norm(home) == norm(team2) and norm(away) == norm(team1)) or (norm(home) == norm(team1) and norm(away) == norm(team2)):
                match = e
                break

        # If we can't find a match, skip prompt
        if not match:
            continue

        away = match.get('away_team') or team1
        home = match.get('home_team') or team2
        ev_id = match.get('id') or ev.get('id')

        # Locate the corresponding game file name and check if it's empty
        game_path = find_game_file(away, home, date)
        if ev_id and file_is_empty(game_path):
            key = (game_path.name)
            if key not in printed:
                print_prompt(away, home, ev_id, game_path.name)
                printed.add(key)

    # Second path: scan for any empty game files and prompt regardless of my_events
    for path in sorted(DATA_DIR.glob('game-*-vs-*-*.json')):
        if not file_is_empty(path):
            continue
        m = re.match(r'^game-(.+)-vs-(.+)-(\d{4}-\d{2}-\d{2})\.json$', path.name)
        if not m:
            continue
        away_slug, home_slug, date = m.group(1), m.group(2), m.group(3)

        # Find matching event on same date
        def date_only(iso: str) -> str:
            try:
                return str(iso).split('T')[0]
            except Exception:
                return ''

        date_set = alt_dates(date)
        candidates = [e for e in all_events if date_only(e.get('commence_time')) in date_set]
        match = None
        for e in candidates:
            if slugify(e.get('away_team')) == away_slug and slugify(e.get('home_team')) == home_slug:
                match = e
                break
            if slugify(e.get('away_team')) == home_slug and slugify(e.get('home_team')) == away_slug:
                match = e
                break

        if not match:
            continue
        away = match.get('away_team')
        home = match.get('home_team')
        ev_id = match.get('id')

        key = (path.name)
        if key in printed:
            continue
        print_prompt(away, home, ev_id, path.name)
        printed.add(key)

if __name__ == '__main__':
    main()
