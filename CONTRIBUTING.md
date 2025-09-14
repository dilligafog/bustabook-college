# Contributing Guidelines

## 🚨 MANDATORY READING: DEVELOPMENT_RULES.md

**Before making ANY changes, read [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md)**

### Pull Request Requirements

All PRs must include a signed statement:

```
I certify that this code contains ZERO hardcoded game data and uses only 
dynamic data sourced from JSON files. I have tested this code with actual 
game data from the data/ directory.

Signed: [Your Name]
```

### Code Review Checklist

- [ ] No hardcoded team names anywhere
- [ ] No hardcoded scores or game results  
- [ ] No hardcoded file names or game IDs
- [ ] All team matching is dynamic from score data
- [ ] All testing uses real data from JSON files
- [ ] Console logs show actual data, not examples

### Testing Standards

**ONLY test with real data:**
- Load from `data/scores.json` for game scores
- Load from `data/game-*.json` for bet data
- Use `data/manifest.json` for file discovery
- Test against actual completed games

**NEVER create fictional test data**

### Banned Patterns

Any PR containing these patterns will be auto-rejected:

```javascript
// ❌ These will get your PR rejected immediately
const teams = ['Alabama', 'Georgia', 'Tennessee'];
if (teamName === 'Penn State') { ... }
const mockGame = { home: 'UGA', away: 'TENN', score: [44, 41] };
// Testing with Villanova +48.5...
```

### Approved Patterns

```javascript
// ✅ These are the ONLY acceptable patterns
const homeTeam = gameScore.home_team?.name;
const awayTeam = gameScore.away_team?.name;
const actualBet = gameData.picks?.best_bet?.pick;
console.log(`Testing actual bet: ${actualBet} with score ${homeScore}-${awayScore}`);
```

---

**Failure to follow these rules will result in immediate PR closure and public developer shaming.**