#!/usr/bin/env python3
import json
import re
from pathlib import Path
from datetime import datetime, timedelta

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / 'data'
MY_EVENTS = DATA_DIR / 'my_events.json'
EVENTS = DATA_DIR / 'events.json'

def load_json(path: Path):
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)

def slugify(name: str) -> str:
    if not name:
        return 'team'
    s = name.lower()
    s = re.sub(r"\(.*?\)", "", s)          # remove parentheticals e.g., (FL)
    s = s.replace('&', ' and ')
    s = re.sub(r"[^a-z0-9]+", "-", s)       # non-alnum to hyphen
    s = re.sub(r"-+", "-", s).strip('-')    # collapse dashes
    return s

def parse_et_datetime(date_str: str, time_str: str) -> str:
    """Return ISO string with EDT offset (-04:00) for simplicity in September."""
    # Expect date: YYYY-MM-DD, time: 'H:MM AM/PM ET'
    m = re.match(r"^(\d{1,2}):(\d{2})\s*(AM|PM)", time_str.strip(), re.I)
    hour = 12
    minute = 0
    if m:
        h = int(m.group(1))
        minute = int(m.group(2))
        ampm = m.group(3).upper()
        if ampm == 'AM':
            hour = 0 if h == 12 else h
        else:
            hour = 12 if h == 12 else h + 12
    try:
        # naive datetime; we will append EDT offset explicitly
        dt = datetime.strptime(f"{date_str} {hour:02d}:{minute:02d}", "%Y-%m-%d %H:%M")
        return dt.strftime("%Y-%m-%dT%H:%M:00-04:00")
    except Exception:
        return f"{date_str}T{hour:02d}:{minute:02d}:00-04:00"

def ensure_game_file(ev, all_events):
    # Only create a file when this event can be matched to events.json (so we have an ID)
    date = (ev.get('date') or '').strip()
    team1 = (ev.get('team1') or '').strip()
    team2 = (ev.get('team2') or '').strip()
    if not date or not team1 or not team2:
        print("⚠️ Skipping malformed my_events entry (missing date/team):", ev)
        return None

    def date_only(iso: str) -> str:
        try:
            return str(iso).split('T')[0]
        except Exception:
            return ''

    def norm(s: str) -> str:
        return re.sub(r"-+", '-', re.sub(r"[^a-z0-9]+", '-', re.sub(r"\(.*?\)", '', (s or '').lower()))).strip('-')

    # Allow ±1 day tolerance to account for timezone formatting differences
    base = datetime.strptime(date, '%Y-%m-%d')
    date_set = {
        (base + timedelta(days=delta)).strftime('%Y-%m-%d')
        for delta in (-1, 0, 1)
    }

    candidates = [e for e in all_events if date_only(e.get('commence_time')) in date_set]
    match = None
    for e in candidates:
        home = e.get('home_team')
        away = e.get('away_team')
        if (norm(home) == norm(team2) and norm(away) == norm(team1)) or (norm(home) == norm(team1) and norm(away) == norm(team2)):
            match = e
            break

    if not match or not match.get('id'):
        print(f"🚫 Skipping (no event id match): {team1} at {team2} on {date}")
        return None

    away_full = match.get('away_team')
    home_full = match.get('home_team')

    away_slug = slugify(away_full)
    home_slug = slugify(home_full)
    filename = f"game-{away_slug}-vs-{home_slug}-{date}.json"
    path = DATA_DIR / filename

    if path.exists():
        print(f"⏭️  Exists: {path.name} — skipping")
        return path

    path.touch()
    print(f"✅ Created empty file: {path.name}")
    return path

def main():
    my_events = load_json(MY_EVENTS)
    all_events = load_json(EVENTS)

    created = []
    for ev in my_events:
        p = ensure_game_file(ev, all_events)
        if p is not None:
            created.append(p.name)

    print(f"\nDone. Prepared {len(created)} files.")

if __name__ == '__main__':
    main()
