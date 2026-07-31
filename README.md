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

## Is the maths the same?

Yes. `src/solaris/` holds the upstream combat engine essentially unmodified —
only the parts that need a live galaxy (building groups from diplomacy, orbiting
carriers, research levels) were removed, since the calculator builds its groups
from form inputs instead. Each file names the upstream file it came from.

Two things back that up:

- `test/combat.upstream.spec.ts` is upstream's own `common/spec/combat.spec.ts`,
  run against this port.
- The port was diffed against upstream's `calculateBasic` across 1512
  ships/weapons/mode/bonus combinations, with identical results in every one.

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
caches fingerprinted assets immutably while keeping `index.html` uncached, and
answers `/healthz`.

## Licence

GPL-3.0-or-later, as a derivative work of solaris-games/solaris. See
[LICENSE](LICENSE) and [NOTICE.md](NOTICE.md). Not affiliated with or endorsed by
the Solaris team.
