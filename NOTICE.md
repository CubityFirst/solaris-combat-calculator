# Attribution and third-party licences

## Solaris

This project is a derivative work of
[solaris-games/solaris](https://github.com/solaris-games/solaris), ported from
commit `a9ccae8`. The combat engine, the calculator UI components and the
specialist data are taken from that project and remain under
**GPL-3.0-or-later** — see [LICENSE](LICENSE). Every ported file carries a header
naming the upstream file it came from.

Files ported (upstream path → path here):

| Upstream | Here |
| --- | --- |
| `common/src/services/combat.ts` | `src/solaris/services/combat.ts` |
| `common/src/services/technology.ts` | `src/solaris/services/technology.ts` |
| `common/src/services/gameType.ts` | `src/solaris/services/gameType.ts` |
| `common/src/types/common/combat.ts` | `src/solaris/types/combat.ts` |
| `common/src/types/common/specialist.ts` | `src/solaris/types/specialist.ts` |
| `common/src/types/id.ts` | `src/solaris/types/id.ts` |
| `common/src/utilities/utils.ts` | `src/solaris/utilities/utils.ts` |
| `common/spec/combat.spec.ts` | `test/combat.upstream.spec.ts` |
| `server/config/game/specialists.json` | `src/solaris/config/specialists.json` |
| `server/services/specialist.ts` | `src/solaris/services/specialist.ts` |
| `client/src/stores/combatCalculator.ts` | `src/stores/combatCalculator.ts` |
| `client/src/views/game/components/combatcalculator/*.vue` | `src/components/*.vue` |
| `client/src/views/game/components/combatcalculator/types.ts` | `src/calculator/types.ts` |
| `client/src/views/game/components/eventLog/events/combat/CombatGroupAttack.vue` | `src/components/CombatGroupAttack.vue` |
| `client/src/views/components/FormErrorList.vue` | `src/components/FormErrorList.vue` |
| `client/src/views/game/components/MenuTitle.vue` | `src/components/MenuTitle.vue` |
| `client/src/App.vue` (styles) | `src/App.vue` |
| `client/src/assets/map-objects/128x128_carrier.svg` (app icons) | `public/favicon.svg`, `public/icons/*` |
| `client/src/assets/styles.css` | `src/assets/theme.scss` |

This project is **not affiliated with or endorsed by** the Solaris team. "Solaris"
is used descriptively to say what game the calculator is for.

## What was deliberately NOT copied

The Solaris client's dark theme comes from **HUD — Bootstrap 5 Admin Template**
by SeanTheme, sold on ThemeForest under an Envato Regular License held by the
Solaris author personally. That licence does not permit redistribution, and it is
not covered by the repository's GPL. `client/public/assets/css/app.min.css`,
`vendor.min.css` and `app.min.js` are therefore **not** included here.

Instead, `src/assets/theme.scss` recompiles stock Bootstrap from its own Sass
source using the same palette (`#273136` background, `#3cd2a5` success,
`#4e9cff` primary, ...), the same typeface and the same base font size. The
result is visually very close but not pixel-identical — HUD's bespoke card,
button and input treatments are not reproduced.

## Third-party dependencies

| Component | Licence |
| --- | --- |
| [Bootstrap](https://getbootstrap.com) 5.3 | MIT |
| [Vue](https://vuejs.org) 3 | MIT |
| [Font Awesome Free](https://fontawesome.com) 6.7.2 | Icons CC BY 4.0, Fonts SIL OFL 1.1, Code MIT |
| [Chakra Petch](https://fonts.google.com/specimen/Chakra+Petch) (`public/fonts`) | SIL OFL 1.1 — see `public/fonts/OFL.txt` |
