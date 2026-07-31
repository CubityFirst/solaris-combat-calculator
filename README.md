# Solaris Combat Calculator

The combat calculator from [Solaris](https://github.com/solaris-games/solaris),
lifted out of the game client and turned into a standalone site — no account, no
game session, just the numbers.

Deployed as a Cloudflare Worker at **https://combat.solaris.cubityfir.st**.

## What it does

**Basic** — defender vs attacker, ships and weapons level, carrier-to-star or
carrier-to-carrier. Tells you who wins, with how many ships left, and how many
ships the loser would have needed.

**Advanced** — any number of combat groups, each with a star and/or several
carriers, per-object specialists, and either a flat weapons level or a list of
allied players (the group fights at its highest weapons level, and the ally count
feeds Siege Breaker's per-ally buff). Shows the per-object breakdown, the
effective weapons each group attacked at, and the ships each losing group needed.

**Game Settings** — the three galaxy settings the combat maths actually reads:
defender bonus, capital star elimination, and the home star defender bonus
multiplier. They persist in `localStorage`.

## Installable / offline

It's a PWA. Install it from the browser's address bar (or Share → Add to Home
Screen on iOS) and it runs standalone with its own icon. The calculator makes no
network calls at all, so once the service worker has precached the build it works
completely offline, and the game settings already live in `localStorage`.

Verified by installing the service worker against the Worker, stopping the
server, and reloading — the app still renders from cache.

A new deploy shows a "new version available" banner rather than swapping itself
in, so a reload can't interrupt a calculation. Font Awesome's `.ttf` files are
excluded from the precache (700 kB of fallbacks for browsers with no woff2
support); Chakra Petch stays in, as it only ships as `.ttf`.

## Is the maths the same?

Yes. `src/solaris/` holds the upstream combat engine essentially unmodified —
only the parts that need a live galaxy (building groups from diplomacy, orbiting
carriers, research levels) were removed, since the calculator builds its groups
from form inputs instead. Each file names the upstream file it came from.

Three things back that up:

- `test/combat.upstream.spec.ts` is upstream's own `common/spec/combat.spec.ts`,
  run against this port.
- `test/parity.spec.ts` replays 720 randomly generated battles recorded from
  upstream and compares every field of the result. See below.
- The basic calculator was separately diffed against upstream's
  `calculateBasic` across 1512 ships/weapons/mode/bonus combinations, with
  identical results in every one.

### The parity suite

`test/parity/golden.json` holds 720 generated battles together with the results
**upstream produces for them** — 120 small two-group duels and 600 melees of up
to six groups, with stars and carriers mixed inside a group, specialists on
both, groups of several allied players, home stars, asteroid fields, and the
galaxy settings that feed the defender bonus.

Every case is replayed through the ported engine and compared field by field:
per-group and per-object ship counts, kill and loss tallies, the effective
weapons every group attacked every other group at, and the winner. The duel band
additionally compares `estimateNeeded`, the "would have needed N ships" figure —
114 of the 120 do; the other 6 are cases where upstream's estimator grinds
towards its internal 10,000-ship cap, which costs seconds per case to replay.
Those still compare the battle itself, just not the estimate.

The whole set replays in about 200 ms, so it runs as part of `npm test`.

It is checked to be capable of failing: dropping the defender-bonus term from
the damage clamp in `combat.ts` is caught here, while both the upstream spec and
the hand-written tests stay green.

Regenerating the golden file needs an upstream checkout:

```sh
git clone --depth 1 https://github.com/solaris-games/solaris /tmp/solaris
SOLARIS_UPSTREAM=/tmp/solaris npm run parity:generate
```

Seven cases in the upstream spec are marked `it.fails`. They expect the defender
to get a first-strike round, which upstream removed — they fail against
upstream's own `combat.ts` too. `it.fails` keeps them live: if this port ever
drifts back to first-strike behaviour, the suite goes red.

## Differences from in-game

Everything that needed the galaxy, and nothing else:

- No "pick this star/carrier off the map" buttons, and no auto-fill of a
  carrier's destination — both sides are entered by hand.
- Advanced "Players" weapons mode takes hand-entered players instead of a
  multi-select of real ones. The engine only reads their highest weapons level
  and how many there are, so it comes to the same thing.
- The specialist dropdowns list every combat-relevant specialist from
  `specialists.json`, with no per-game ban list applied.
- Galaxy settings are entered in the Game Settings panel rather than read from a
  game.
- The Calculate button is also disabled on per-group errors. Upstream leaves it
  live, which throws on e.g. a group with no objects. No result changes.
- The theme is stock Bootstrap recompiled with the Solaris palette rather than
  the game's licensed template — see [NOTICE.md](NOTICE.md).

## Development

```sh
npm install
npm run dev       # vite dev server
npm test          # combat engine tests
npm run check     # typecheck app + worker
npm run build     # -> dist/
npm run worker:dev  # build, then run the Worker locally via wrangler
```

## Deploying

```sh
npm run deploy    # build + wrangler deploy
```

`wrangler.jsonc` claims `combat.solaris.cubityfir.st` as a custom domain. For that
to attach, `solaris.cubityfir.st` (or `cubityfir.st`) must be a zone on the same
Cloudflare account you deploy with — Wrangler creates the DNS record and cert on
first deploy. Run `npx wrangler login` first if you haven't.

The Worker (`worker/index.ts`) serves the built assets, adds security headers,
caches fingerprinted assets immutably while keeping `index.html`, `sw.js` and the
manifest uncached, and answers `/healthz`.

It also serves `/index.html` directly instead of letting the asset server
307-redirect it to `/`. Workbox precaches the entry point under that path and
rejects a redirect as a bad precache response, which silently aborts the entire
service worker install — worth knowing before changing that bit.

## Licence

GPL-3.0-or-later, as a derivative work of solaris-games/solaris. See
[LICENSE](LICENSE) and [NOTICE.md](NOTICE.md). Not affiliated with or endorsed by
the Solaris team.
