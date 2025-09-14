# 🚨 CRITICAL DEVELOPMENT RULES 🚨

## ⛔ ABSOLUTELY NO HARDCODED GAME DATA ⛔

### ZERO TOLERANCE POLICY

**NEVER, UNDER ANY CIRCUMSTANCES, HARDCODE GAME DATA**

This means:
- ❌ NO hardcoded team names
- ❌ NO hardcoded game IDs  
- ❌ NO hardcoded scores
- ❌ NO hardcoded dates
- ❌ NO hardcoded file names
- ❌ NO hardcoded game results for testing
- ❌ NO "example" data in code comments
- ❌ NO sample team names in variable examples

### ✅ WHAT TO DO INSTEAD

**ALL DATA MUST BE DYNAMIC AND SOURCED FROM JSON FILES**

1. **For Testing**: Use actual data from `data/*.json` files
2. **For Team Matching**: Parse team names from score data dynamically
3. **For Game Discovery**: Use the manifest.json system
4. **For Debugging**: Log actual game data, don't make up examples

### 🔥 ENFORCEMENT

**ANY CODE THAT CONTAINS HARDCODED GAME DATA WILL BE REJECTED**

Examples of BANNED code patterns:
```javascript
// ❌ BANNED - Hardcoded team names
if (team === 'Tennessee' || team === 'Georgia') {...}

// ❌ BANNED - Hardcoded game results  
const testScore = { home: 44, away: 41 };

// ❌ BANNED - Hardcoded file references
const gameFiles = ['game-penn-state.json', 'game-georgia.json'];

// ❌ BANNED - Sample data in comments
// Example: "Villanova +48.5" should win because...
```

### ✅ APPROVED code patterns:
```javascript
// ✅ APPROVED - Dynamic team matching
const homeTeam = gameScore.home_team?.name?.toLowerCase();
const awayTeam = gameScore.away_team?.name?.toLowerCase();

// ✅ APPROVED - Dynamic file discovery
const manifest = await fetch('data/manifest.json');
const files = await manifest.json();

// ✅ APPROVED - Using actual game data
console.log(`Testing with actual game: ${gameData.game_meta.title}`);
```

## 📋 TESTING REQUIREMENTS

### For Bet Evaluation Testing:
1. Load actual game files from `data/game-*.json`
2. Use real score data from `data/scores.json`
3. Test with actual bet picks from the JSON files
4. Log the actual team names and scores found in the data

### For Debugging:
1. Always reference actual file contents
2. Use `console.log()` to show real data structures
3. Test against multiple real games, not fictional examples
4. Verify results using actual game outcomes

## 🎯 THE GOAL

**COMPLETE DYNAMIC FUNCTIONALITY**

Every piece of game data must flow from the JSON files. The application should work with ANY college football data without requiring code changes.

## 💀 CONSEQUENCES OF VIOLATIONS

Code containing hardcoded game data will be:
1. Immediately rejected
2. Require complete rewrite
3. Subject to public shame and ridicule
4. Cause extreme developer frustration

---

**REMEMBER: If it's not in the JSON, it doesn't exist. Period.**