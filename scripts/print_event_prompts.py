#!/usr/bin/env python3
import json
import re
from pathlib import Path

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
                print(f"Following the instructions in the project, lets look at {away} at {home}. Use {ev_id} for the game_id.")
                print(f"Paste content into: {game_path.name}\n")
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
        print(f"Following the instructions in the project, lets look at {away} at {home}. Use {ev_id} for the game_id.")
        print(f"Paste content into: {path.name}\n")
        printed.add(key)

if __name__ == '__main__':
    main()
