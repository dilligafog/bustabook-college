#!/usr/bin/env python3
import os
import sys
import json
import urllib.request
import urllib.parse
import ssl
from pathlib import Path


def main():
    api_key = os.environ.get("ODDS_API_KEY")
    if not api_key:
        print("ERROR: ODDS_API_KEY environment variable is not set.")
        sys.exit(1)

    sport_key = "americanfootball_ncaaf"
    days_from = os.environ.get("DAYS_FROM", "3")
    date_format = "iso"

    base_url = "https://api.the-odds-api.com/v4/sports/{sport}/scores"
    params = {
        "apiKey": api_key,
        "daysFrom": days_from,
        "dateFormat": date_format,
    }
    url = base_url.format(sport=sport_key) + "?" + urllib.parse.urlencode(params)

    print(f"Fetching scores for {sport_key} (daysFrom={days_from})...")

    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(url, context=ctx, timeout=20) as resp:
            status = resp.getcode()
            if status != 200:
                print(f"ERROR: HTTP {status}")
                sys.exit(1)
            data = resp.read()
    except Exception as e:
        print(f"ERROR: Failed to fetch scores: {e}")
        sys.exit(1)

    try:
        payload = json.loads(data.decode("utf-8"))
    except Exception as e:
        print(f"ERROR: Failed to parse JSON: {e}")
        sys.exit(1)

    if not isinstance(payload, list):
        print("ERROR: Unexpected response format (expected a list)")
        sys.exit(1)

    valid = []
    for item in payload:
        if isinstance(item, dict) and item.get("id") and item.get("home_team") and item.get("away_team"):
            valid.append(item)

    print(f"Fetched {len(payload)} items; {len(valid)} passed basic validation.")

    repo_root = Path(__file__).resolve().parent.parent
    data_dir = repo_root / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    new_scores_path = data_dir / "new-scores.json"
    scores_path = data_dir / "scores.json"

    try:
        with new_scores_path.open("w", encoding="utf-8") as f:
            json.dump(valid, f, indent=2)
        print(f"Wrote {new_scores_path}.")
    except Exception as e:
        print(f"ERROR: Failed to write {new_scores_path}: {e}")
        sys.exit(1)

    try:
        os.replace(new_scores_path, scores_path)
        print(f"Replaced {scores_path} with new scores ({len(valid)} games).")
    except Exception as e:
        print(f"ERROR: Failed to replace scores.json: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
