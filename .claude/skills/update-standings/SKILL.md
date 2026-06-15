---
name: update-standings
description: >-
  Add a week's DraftKings contest results to the Buddies Golf League site —
  tournament results, standings, and the money ledger — from a contest-export
  CSV (usually in ~/Downloads). Use this whenever Matt drops a new contest CSV
  and says something like "update the site", "add the RBC results", "update
  standings", "add this week's tournament", or names any PGA event (Memorial,
  Travelers, US Open, etc.) with results to load. ALWAYS verify the gross
  payouts with the user first, because payouts are set by the size of the field
  and a new field size has no preset tier. Trigger even if the user doesn't say
  the word "skill" or "standings" — a golf contest CSV plus "add/update" is
  enough.
---

# Update Standings

Load one week's DraftKings contest into the league site so the Standings,
Tournaments, and Money pages all reflect it. The site (a Next.js app, deployed
on Vercel) reads everything from `data/seasons/<year>.json`; standings are
computed live from the tournament results, and the money ledger is stored per
player. Two scripts do the heavy lifting — your job is to run them in order,
**confirm the payouts with Matt**, and verify the result.

## The one rule that matters: payouts are field-size specific

Each contest pays out a prize pool equal to `entrants × entry fee`, split among
the top finishers. **The split depends on how many people entered**, and there
is no reliable default — a 12-person field and a 15-person field pay
differently. So before you touch the money ledger you must show Matt the field
size and the pool and get the exact gross prizes. Never assume a tier, never
silently reuse last week's split. This is the whole reason the skill exists.

If the field size matches a contest already in `scripts/import-money.ts`
(`PAYOUT_OVERRIDES`), propose reusing that split. If it's a **new** field size,
propose a split that follows the established pattern and **ask** — see
[Confirm payouts](#step-4-confirm-the-payouts-with-matt-required).

## Workflow

### Step 1: Find the CSV and name the tournament

The contest export is almost always in `~/Downloads`. It's a DraftKings file
with `Rank,EntryId,EntryName,...,Points,Lineup` columns on the left and a
player-stats block on the right.

Decide the official tournament name (e.g. "RBC Canadian Open", "Travelers
Championship") and its slug (lowercase, hyphenated: `rbc-canadian-open`).

**Watch for name collisions.** Several PGA events share a sponsor — "RBC
Heritage" and "RBC Canadian Open" are different tournaments. Check existing
slugs first so you don't overwrite an earlier week:

```bash
node -e "require('./data/seasons/2026.json').tournaments.forEach(t=>console.log(t.slug))"
```

Use the full, distinct name. Copy the CSV into the repo:

```bash
cp ~/Downloads/<file>.csv contests/<year>/<slug>.csv
```

### Step 2: Import the tournament (updates Standings + Tournaments)

```bash
npm run import:contest -- <year> "<Tournament Name>" contests/<year>/<slug>.csv
```

This adds the tournament to the season JSON. Standings recompute automatically
from it, so there's no separate "standings" step.

**Check the output:**
- Entrant count looks right.
- No `⚠ Unknown DK usernames` warnings. If there are any, the player isn't in
  `data/players.json` — add them (`{ id, name, dkUsername }`) and re-run. An
  unmapped entry would otherwise show as `[unknown: …]` on the site and get no
  money.

### Step 3: Compute the pool

Entry fee comes from `data/config.json`: `$2` standard, `$10` for majors
(`players`, `masters`, `pga-championship`, `us-open`, `british-open`). Pool =
`entrants × entry fee`. Example: 12 entrants × $2 = **$24 pool**.

### Step 4: Confirm the payouts with Matt (REQUIRED)

Show Matt the field size, the pool, and the current tier table so he can decide.
Pull the live tiers straight from the source of truth:

```bash
grep -A 20 'PAYOUT_OVERRIDES' scripts/import-money.ts
```

Then present a recommendation and **ask** (use the AskUserQuestion tool so he
can pick or type a custom split). Constraints to state plainly:
- Gross prizes must **sum to the pool**.
- Net to each player = `gross − entry fee`; every other entrant nets `−entry
  fee`; players who didn't enter are untouched.
- Name the finishers (1st/2nd/3rd) so he sees who gets what.

The established pattern (read it from the file; here for intuition):

| Entries | Pool | Gross split |
|--------|------|-------------|
| 9  | $18 | 12 / 6 (top 2) |
| 12 | $24 | 13 / 7 / 4 |
| 13 | $26 | 14 / 7 / 5 |
| 14 | $28 | 15 / 8 / 5 |
| 15 | $30 | 16 / 9 / 5 |

For a brand-new size, interpolate (1st ≈ entries+1, 3rd ≈ $4–5, top-3 once the
field is ~12+) and let Matt adjust. Do not proceed until he confirms.

### Step 5: Record the tier and apply the money

Add a line to `PAYOUT_OVERRIDES` in `scripts/import-money.ts`, keyed by slug, so
the canonical tier table stays current and a future `import-money` rebuild would
reproduce it:

```ts
"rbc-canadian-open": [13, 7, 4], // 12 entrants × $2 = $24 pool
```

Then apply the confirmed payouts to the ledger:

```bash
npm run import:contest-money -- <year> <slug> "<Money Column>" <gross1> <gross2> ...
# e.g. npm run import:contest-money -- 2026 rbc-canadian-open "RBC Canadian Open" 13 7 4
```

`import-contest-money` reads the results already imported in Step 2 and fills one
column in the money ledger: net for entrants, `null` for everyone who sat out.
It inserts the column right after the most recent played week, bumps each
entrant's `entered`, and recomputes `owed = yearlyEntry + sum(columns)`. It's
idempotent — safe to re-run if Matt changes the split. Use the full tournament
name as the money column so it matches the slug and reads clearly.

### Step 6: Verify before claiming done

```bash
npm run build
```

A clean build confirms the site compiles with the new data. Also sanity-check
the ledger (entrant count, column placement, the owed invariant):

```bash
node -e "
const s=require('./data/seasons/<year>.json'), COL='<Money Column>';
const nn=s.money.filter(p=>p.tournaments[COL]!=null);
console.log('entrants with a value:', nn.length);
const k=Object.keys(s.money[0].tournaments); console.log('column sits after:', k[k.indexOf(COL)-1]);
console.log('owed invariant OK:', s.money.every(p=>p.owed===p.yearlyEntry+Object.values(p.tournaments).reduce((a,v)=>a+(v||0),0)));
"
```

### Step 7: Commit (after Matt is happy)

These weekly updates are committed one-per-week on `main`. Follow the repo's
existing message format exactly:

```
Add <Tournament> results (Week N)

<N> entries · $<pool> pool · <a/b/c> payouts.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

Find the week number from the last `Add … results (Week N)` commit and increment
it. Pushing to `main` is what actually updates the live Vercel site, so confirm
with Matt before pushing.

## Files in play

- `contests/<year>/<slug>.csv` — the raw DraftKings export (committed).
- `data/seasons/<year>.json` — the single source the site reads.
- `scripts/import-contest.ts` — CSV → tournament results (standings derive from this).
- `scripts/import-contest-money.ts` — applies one contest's payouts to the ledger.
- `scripts/import-money.ts` — holds the `PAYOUT_OVERRIDES` tier table; the full-ledger rebuild path (needs Matt's master money CSV, rarely run).
- `data/players.json` — DK username → real name mapping.
