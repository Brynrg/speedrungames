# Green Circle TD — Execution Plan

**Goal:** lift the game from a 6/10 MVP to a top-tier indie tower defense (target 8.5–9/10) by deepening decision-making, restoring the four-corner GCTD identity, and adding meta-progression. Audio is **explicitly deferred** to Phase 8.

**Source artifact:** [`game.py`](game.py) (2047 lines, monolithic `Game` class). Current state described in §"Starting State" below.

**How to use this doc (coding agent):** Work phases in order. Every phase ends with a playable build that's strictly better than the previous one. Each phase has concrete tasks, files to touch, data schemas, acceptance criteria, and a test plan. **Do not skip the acceptance check before moving on.**

---

## Table of contents

- [Starting State](#starting-state)
- [Architecture Target](#architecture-target)
- [Phase 0 — Foundation](#phase-0--foundation)
- [Phase 1 — Decision Layer](#phase-1--decision-layer)
- [Phase 2 — Identity (Four-Corner Map + Auras)](#phase-2--identity-four-corner-map--auras)
- [Phase 3 — Mechanical Depth](#phase-3--mechanical-depth)
- [Phase 4 — Wave Design](#phase-4--wave-design)
- [Phase 5 — Game Feel (no audio)](#phase-5--game-feel-no-audio)
- [Phase 6 — Meta & Longevity](#phase-6--meta--longevity)
- [Phase 7 — UX & Accessibility](#phase-7--ux--accessibility)
- [Phase 8 — Audio (DEFERRED)](#phase-8--audio-deferred)
- [Cross-cutting standards](#cross-cutting-standards)
- [Test plan](#test-plan)

---

## Starting State

**Stack:** Python 3.9, Arcade 3.0.2, ~/Developer/Guardian/tower-defense/venv.

**Single-file structure** in [`game.py`](game.py):

- `Game` class (lines 964–2041) inherits `arcade.Window`; mixes render, sim, input.
- Data classes: `Enemy`, `Tower`, `Bullet`, `SplashBullet`, `Particle`, `ExplosionEffect`.
- Data dicts hardcoded in source: `TOWER_DATA` (line 132), `WAVE_TRAITS` (line 184), `SOUNDS` (line 118).
- Single 49-point wobble spiral path at `make_green_circle_path()` ([line 1095](game.py:1095)).
- Wave generator at [line 1176](game.py:1176): `if wave % 10 == 0: Boss; elif wave % 9 == 0: Invisible; ...` — pure modulo.
- Targeting: closest-in-range only ([line 717](game.py:717)).
- Tower upgrade: flat multiplicative bumps ([line 669](game.py:669): `damage *= 1.4; range += 28; cooldown *= 0.86`).
- Sell-back: flat 60% ([line 676](game.py:676)).
- 7 towers, 9 enemy traits, 20 modulo-generated waves, sine-wave SFX, particle FX on kills, screen-shake only on leaks.

**What's good** (preserve): geometric Warcraft 3 aesthetic, tower visual variety, build/combat phase cycle, combo system, particle/explosion FX, minimap, status messages.

**What's missing** (this plan fixes): four-corner GCTD layout, armor matrix, aura layering, targeting modes, hero unit, hand-tuned waves, meta-progression, color-blind support, range preview while placing, projected DPS tooltip.

---

## Architecture Target

End-state directory:

```
tower-defense/
├── game.py                  # entry point only (~50 lines)
├── core/
│   ├── __init__.py
│   ├── sim.py               # game simulation: state, update tick, no rendering
│   ├── renderer.py          # all draw_* calls; reads sim state
│   ├── input.py             # mouse/keyboard → sim commands
│   ├── ui.py                # HUD, menus, tooltips (still draws, but isolated)
│   ├── rng.py               # seeded RNG wrapper
│   ├── armor.py             # damage matrix, type lookups
│   ├── path.py              # path generation, validation
│   ├── tower.py             # Tower class, upgrade trees, synergies
│   ├── enemy.py             # Enemy class
│   ├── wave.py              # WaveSpec loader, spawner
│   ├── aura.py              # aura calculation
│   ├── hero.py              # Phase 3
│   ├── card.py              # Phase 6 roguelite
│   ├── save.py              # autosave per wave
│   └── settings.py          # constants, palette, screen size
├── data/
│   ├── towers.json
│   ├── enemies.json
│   ├── armor_matrix.json
│   ├── waves.json
│   ├── cards.json           # Phase 6
│   └── upgrades.json        # branching upgrade trees
├── assets/
│   └── (Phase 8 audio + any sprite/font additions)
├── tests/
│   └── (pytest, extending existing tests/)
├── EXECUTION_PLAN.md        # this file
└── requirements.txt
```

**Principle:** sim has no `arcade.*` calls. Renderer is a pure projection of sim state. Input emits intents to sim. This lets us write headless deterministic tests and run replays.

---

## Phase 0 — Foundation

**Goal:** non-glamorous prep so later phases land cleanly.
**Effort:** ~1 day.
**Ships:** same gameplay, multi-speed, modular code.

### Tasks

1. **Refactor [`game.py`](game.py) into `core/` modules** (above tree). Move classes verbatim; do not change behavior. Verify by running existing tests (`pytest tests/`).
2. **Extract data to JSON.**
   - `data/towers.json` ← contents of `TOWER_DATA` ([line 132](game.py:132))
   - `data/enemies.json` ← contents of `WAVE_TRAITS` ([line 184](game.py:184))
   - Loader: `core/data.py:load_data()` returns dataclasses.
3. **Seeded RNG.** `core/rng.py`:
   ```python
   class Rng:
       def __init__(self, seed: int): self._r = random.Random(seed)
       def randint(self, a, b): return self._r.randint(a, b)
       def choice(self, seq): return self._r.choice(seq)
       def uniform(self, a, b): return self._r.uniform(a, b)
   ```
   All current `random.*` calls in [`game.py`](game.py) (search for `random.`) route through this. Run seed printed on game start; reproducible.
4. **Multi-speed.** Keyboard: `,` → 1x, `.` → 2x, `/` → 3x. Pause hotkey `Space` (currently `P`, also keep `P`). Speed multiplies sim ticks per frame; render stays at native FPS. Pause-while-placing: opening a tower placement preview implicitly pauses if `auto_pause_on_build` setting is on (default off).
5. **Drop the broken save/load wires from menu.** Leave the save/load functions in place ([line 1782](game.py:1782)) but route F5/F9 properly. Phase 7 will add autosave.

### Acceptance

- Game runs from `python game.py` identically to before.
- `pytest tests/` passes.
- Pressing `.` makes the game run at 2x speed; pressing `,` returns to 1x.
- `data/towers.json` is the single source of truth for tower stats; editing it changes the game without code changes.
- Game start prints `Seed: 12345` to stdout; passing `python game.py --seed 12345` reproduces identical wave compositions.

---

## Phase 1 — Decision Layer

**Goal:** make every tower placement a *decision*, not a DPS auto-pick. This is the single biggest quality lever.
**Effort:** ~3 days.
**Ships:** armor matrix, wave preview HUD, targeting modes, range preview, projected DPS tooltip.

### 1a. Damage / armor matrix

`data/armor_matrix.json`:

```json
{
  "damage_types":  ["pierce", "siege", "magic", "normal"],
  "armor_types":   ["light",  "medium", "heavy", "fortified", "hero"],
  "matrix": {
    "pierce":     {"light": 2.00, "medium": 0.75, "heavy": 1.00, "fortified": 0.35, "hero": 0.50},
    "siege":      {"light": 1.00, "medium": 0.50, "heavy": 1.00, "fortified": 1.50, "hero": 0.50},
    "magic":      {"light": 1.25, "medium": 0.75, "heavy": 2.00, "fortified": 0.35, "hero": 0.50},
    "normal":     {"light": 1.00, "medium": 1.50, "heavy": 1.00, "fortified": 0.70, "hero": 1.00}
  }
}
```

Tower → damage type mapping (extend `data/towers.json`):

| Tower    | Damage type |
|----------|-------------|
| Basic    | normal      |
| Sniper   | pierce      |
| Rapid    | pierce      |
| Splash   | siege       |
| Frost    | magic       |
| Poison   | magic       |
| Detector | normal      |

Enemy → armor type mapping (extend `data/enemies.json` — apply per-trait override):

| Trait     | Armor type |
|-----------|-----------|
| Normal    | medium    |
| Swift     | light     |
| Armored   | heavy     |
| Swarm     | light     |
| Air       | light     |
| Immune    | fortified |
| Invisible | medium    |
| Hero      | hero      |
| Boss      | fortified |

**Apply** in `Enemy.take_damage()` (currently at [`game.py:467`](game.py:467) approximately): `final = dmg * matrix[damage_type][armor_type]`. Floor at 1 damage.

### 1b. Wave preview HUD (right sidebar)

Always-visible panel showing **next 3 waves**. Each card:

```
┌──────────────────────────┐
│ WAVE 8   "Hardened"      │
│ ◆ Armored × 12           │
│ HEAVY ARMOR              │
│ Pierce -65% | Magic +100%│
│ Spawn delay: 0.8s        │
└──────────────────────────┘
```

Components:
- Wave name (Phase 4 names; Phase 1 placeholder names by trait)
- Enemy count + symbol overlay (Phase 7 a11y symbols)
- Armor type badge with color chip
- Top-2 damage-type matchups vs that armor

Mount in `core/ui.py:draw_wave_preview(state, x, y)`. Replace minimap if cramped, or shift minimap to top-right.

### 1c. Targeting modes

5 modes per tower, cycle with `T` key while a tower is selected:

- `FIRST` — closest to end of path
- `LAST` — furthest from end (kill stragglers)
- `CLOSEST` — current default
- `STRONG` — highest current HP
- `WEAK` — lowest current HP

Persist per-tower; show current mode as a small icon above tower selection ring. Implement in `Tower.find_target(enemies, path)` — `path` arg lets FIRST/LAST compute progress.

### 1d. Range preview during placement

When a tower is selected from the build bar (before clicking to place), render a translucent range circle following the mouse cursor. Also render existing-tower range when hovered. Currently this is click-to-preview only.

### 1e. Projected DPS tooltip

When a tower is selected (existing) or hovered (in build bar), show tooltip:

```
SNIPER L2 (pierce)
DPS: 24.1  →  L3: 33.7 (+40%)
vs Wave 8 (Heavy): 24.1 → 24.1 (1.00x)
vs Wave 9 (Light): 24.1 → 48.2 (2.00x !)
Cost: 200g  Sell: 150g
```

Compute DPS = `damage * (60 / cooldown_frames)`. Multiply by armor matrix for next-wave projection. Highlight matchups > 1.5x in green, < 0.5x in red.

### Acceptance

- Placing a Pierce tower (Sniper/Rapid) into a Heavy armor wave kills slower than placing Siege/Magic — verifiable in damage log.
- Wave preview sidebar shows next 3 waves with armor chips.
- Press `T` on a selected tower; mode cycles First → Last → Closest → Strong → Weak → First.
- Hovering build bar shows mouse-following range circle.
- Tooltip on hovered tower shows current DPS + projected DPS for next wave with armor multiplier.

---

## Phase 2 — Identity (Four-Corner Map + Auras)

**Goal:** earn the name "Green Circle TD" by restoring the canonical four-corner layout and the aura-stacking expert ceiling.
**Effort:** ~3 days.
**Ships:** 4-corner spawn → center map, 2 aura towers, sell-back curve.

### 2a. Four-corner map

Replace [`make_green_circle_path()`](game.py:1095) with 4 paths, one per corner, converging at center.

`core/path.py`:

```python
def make_four_corner_paths(screen_w, screen_h):
    cx, cy = screen_w / 2, screen_h / 2
    paths = []
    for corner in [(0, 0), (screen_w, 0), (0, screen_h), (screen_w, screen_h)]:
        paths.append(spiral_path(start=corner, end=(cx, cy), turns=1.5, samples=48))
    return paths  # list of 4 lists of (x, y) waypoints

def spiral_path(start, end, turns, samples):
    # log-spiral from start toward end, ending exactly at end
    ...
```

Sim changes:
- `Enemy.path_index` becomes `Enemy.corner_index` + `Enemy.path_progress`.
- Each wave assigns a per-enemy spawn corner (default: round-robin; certain waves all-corners or single-corner).
- Center is shared "leak point" — if an enemy reaches center it leaks (existing leak logic at [line 2016](game.py:2016)).

Visual:
- 4 corner spawn arcs are color-coded with a faint glow.
- Center has a circular "core" target (Phase 5 will add a death animation when leaked into).

### 2b. Aura towers

Add to `data/towers.json`:

```json
{
  "damage_aura": {
    "name": "Damage Aura",
    "cost": 220,
    "damage_type": null,
    "shoots": false,
    "aura": {"type": "damage_bonus", "radius": 160, "value": 0.20},
    "color": [200, 50, 50],
    "level_branches": [
      {"name": "Wide Aura", "radius_delta": 80, "value_delta": 0.00},
      {"name": "Strong Aura", "radius_delta": 0,  "value_delta": 0.20}
    ]
  },
  "speed_aura": {
    "name": "Speed Aura",
    "cost": 200,
    "damage_type": null,
    "shoots": false,
    "aura": {"type": "cooldown_reduction", "radius": 150, "value": 0.15},
    "color": [200, 200, 50],
    "level_branches": [
      {"name": "Wide Speed", "radius_delta": 80, "value_delta": 0.00},
      {"name": "Strong Speed", "radius_delta": 0, "value_delta": 0.15}
    ]
  }
}
```

`core/aura.py:compute_tower_modifiers(tower, all_towers)`:
- Sums damage bonuses from overlapping damage auras (additive within type, e.g. two damage auras at 20% each = +40%, capped at +100%).
- Same for cooldown auras.
- Cache per tick (compute once per sim tick, not per shot).

Visuals: aura tower has a rotating ring at its radius; rings of overlapping auras visibly intensify (alpha + saturation bump).

### 2c. Sell-back curve

Replace flat 60% at [`game.py:676`](game.py:676):

```python
def sell_value(self, current_wave: int) -> int:
    if current_wave < 5:  rate = 1.00
    elif current_wave < 15: rate = 0.75
    else:                   rate = 0.50
    return int(self.total_invested * rate)
```

Track `total_invested = base_cost + sum(upgrade_costs)` on the tower.

### Acceptance

- Map shows 4 distinct spiral lanes meeting at center.
- Enemies spawn from all 4 corners; wave 1 uses 1 corner, wave 5 uses 2 corners, wave 10+ uses all 4 (configurable per wave in Phase 4).
- Building a Damage Aura overlapping 2 towers makes those 2 towers visibly hit harder (log damage before/after).
- Two overlapping damage auras stack: tower in both gets +40% damage.
- Selling a tower built in wave 1 at wave 6 returns 75% of total invested.

---

## Phase 3 — Mechanical Depth

**Goal:** active play during combat + emergent strategy.
**Effort:** ~4 days.
**Ships:** hero unit, tower synergies, branching upgrades at L3, status effects refresh.

### 3a. Hero unit

One hero per run, click-to-move. `core/hero.py:Hero`:

- Spawned at first wave at center.
- Right-click on map → walks there.
- Body-blocks ground enemies in a 24px radius (enemies stop, attack hero).
- Attacks (low damage, fast).
- HP-based; dies → respawns next build phase (cost: 0).
- Levels up by kills + assists: L1 → L5. Each level: +20% HP, +15% damage.
- Cannot block air or boss-type.

Visual: distinctive purple circle, larger than enemy units, with hero crown icon.

`data/hero.json`:

```json
{
  "name": "Verdant Hero",
  "hp_base": 200, "hp_per_level": 40,
  "damage_base": 18, "damage_per_level": 4,
  "attack_speed": 30, "move_speed": 3.0,
  "block_radius": 24, "block_targets": ["ground"],
  "xp_per_kill": 10, "xp_per_assist": 3,
  "xp_to_level": [50, 120, 220, 360]
}
```

### 3b. Tower synergies (emergent — not advertised to player)

Implement as hooks in `core/tower.py:Tower.on_hit(enemy, damage)`:

| Synergy | Trigger | Effect |
|---|---|---|
| **Frosted + Pierce bonus** | Sniper/Rapid hits a slowed enemy | +25% damage |
| **Poison spread** | Splash kills a poisoned enemy | poison transfers to all in splash radius |
| **Detector crit** | Tower fires from inside any Detector range | +10% crit (×2.5 dmg) |
| **Aura overlap pulse** | Two auras overlap | overlap zone has +10% additional combined effect |
| **Frost shatter** | Magic-type tower kills a slowed enemy with overkill > 1.5x HP | 30 radius shockwave dealing 50% of overkill |

Discoverable through play — tooltip shows synergy text *after* it triggers once in a run (subtle UI nudge).

### 3c. Branching upgrade trees at level 3

Replace the flat 4-level upgrade ([`game.py:669`](game.py:669)) with: L1 → L2 → L3 → choose one of two L4 branches.

`data/upgrades.json`:

```json
{
  "sniper": {
    "L4_branches": [
      {
        "id": "sniper_truesight",
        "name": "Truesight Bolt",
        "damage_type": "pierce",
        "stats": {"damage_mult": 1.5, "range_delta": 40, "true_sight": true}
      },
      {
        "id": "sniper_arcane",
        "name": "Arcane Lance",
        "damage_type": "magic",
        "stats": {"damage_mult": 2.0, "cooldown_mult": 1.4, "range_delta": 0}
      }
    ]
  },
  "splash": {
    "L4_branches": [
      { "id": "splash_bigger", "name": "Bigger Boom", "stats": {"splash_radius_delta": 40} },
      { "id": "splash_faster", "name": "Faster Boom", "stats": {"cooldown_mult": 0.7} }
    ]
  },
  "rapid": {
    "L4_branches": [
      { "id": "rapid_crit", "name": "Critical Volley", "stats": {"crit_chance": 0.10, "crit_mult": 3.0} },
      { "id": "rapid_burn", "name": "Burning Volley", "stats": {"burn_dot": 4, "burn_duration": 120} }
    ]
  },
  "frost": {
    "L4_branches": [
      { "id": "frost_freeze", "name": "Deep Freeze", "stats": {"slow_factor": 0.30, "freeze_chance": 0.05}},
      { "id": "frost_chill", "name": "Chill Aura", "stats": {"chill_aura_radius": 100, "chill_value": 0.15}}
    ]
  },
  "poison": {
    "L4_branches": [
      { "id": "poison_plague", "name": "Plague", "stats": {"poison_spread_on_death": true, "poison_dmg_mult": 1.5}},
      { "id": "poison_acid", "name": "Acid", "stats": {"armor_shred": 0.20, "armor_shred_duration": 180}}
    ]
  },
  "basic": {
    "L4_branches": [
      { "id": "basic_volley", "name": "Volley", "stats": {"projectiles_per_shot": 3, "damage_mult": 0.5}},
      { "id": "basic_heavy", "name": "Heavy Round", "stats": {"damage_mult": 2.5, "cooldown_mult": 1.6}}
    ]
  },
  "detector": {
    "L4_branches": [
      { "id": "detector_pulse", "name": "Reveal Pulse", "stats": {"reveal_radius": 999, "global_reveal": true}},
      { "id": "detector_marker", "name": "Mark Target", "stats": {"marked_damage_bonus": 0.30}}
    ]
  }
}
```

UI: on hitting L3 → L4 upgrade, show branch picker modal with descriptions. Locked-in choice for the run.

### 3d. Status effect refresh

Currently `apply_slow()` uses `max(slow_timer, duration)` ([line 445](game.py:445)). Generalize:

- **Stacks** (poison): multiple stacks → multiple DoT instances, each with own timer.
- **Refreshes** (slow): take max of duration; intensity uses stronger of current/new.
- **Replaces** (burn from Phase 3c): one burn at a time, refresh duration.

Add `core/status.py:StatusEffect` and `Enemy.statuses: list[StatusEffect]`. Render stacked icons above enemy.

### Acceptance

- Right-click on map moves the hero. Hero kills 5 enemies in wave 1 unaided.
- Placing a Sniper next to a Frost tower → enemies hit by Sniper while frozen take +25% damage (verifiable in damage log).
- Upgrading Sniper to L4 prompts a choice: "Truesight Bolt" vs "Arcane Lance" with stat preview.
- Picking Arcane Lance changes Sniper's damage type to magic (verified vs heavy armor 2x damage in the same wave).
- Poisoned enemy killed by Splash spreads poison to nearby enemies.

---

## Phase 4 — Wave Design

**Goal:** replace modulo-generated waves with 30 hand-designed encounters. Each wave answers one of: introduces a new threat, recombines, or breaks a popular meta.
**Effort:** ~3 days.
**Ships:** 30 named waves, modifier stacking, boss design, wave preview rich content.

### 4a. Wave manifest schema

`data/waves.json`:

```json
[
  {
    "id": 1,
    "name": "First Light",
    "preview_hint": "Light infantry. Build any tower.",
    "spawns": [
      { "enemy": "grunt",       "count": 8,  "interval": 0.7, "corner": "TL", "start_at": 0.0 }
    ],
    "reward_bonus": 50
  },
  {
    "id": 7,
    "name": "The Steel Tide",
    "preview_hint": "Heavy armor — Pierce penalty.",
    "spawns": [
      { "enemy": "armored_grunt",  "count": 14, "interval": 0.8, "corner": "ROUND_ROBIN", "start_at": 0.0 },
      { "enemy": "armored_runner", "count": 3,  "interval": 1.6, "corner": "TL",          "start_at": 5.0 }
    ],
    "reward_bonus": 80
  },
  {
    "id": 17,
    "name": "The Bound Flame",
    "preview_hint": "Hero creeps from all corners.",
    "spawns": [
      { "enemy": "hero_minor", "count": 4, "interval": 4.0, "corner": "ALL", "start_at": 0.0 }
    ],
    "reward_bonus": 250
  }
]
```

`corner` values: `TL`, `TR`, `BL`, `BR`, `ROUND_ROBIN`, `ALL` (one from each corner simultaneously).

### 4b. The 30 waves

Design summary — write all 30 in `data/waves.json` with these intents:

| Wave | Name | Theme / Gimmick | Armor | Notes |
|------|------|-----------------|-------|-------|
| 1 | First Light | Tutorial — light, single corner | light | 8 grunts |
| 2 | Patrol | Two corners | light | 10 grunts |
| 3 | Swift Strike | Swift modifier | light | 12, faster |
| 4 | First Mass | Swarm (small) | light | 18, low HP |
| 5 | Iron Probe | Intro Armored | heavy | 8, durable; teaches Siege/Magic |
| 6 | Choirs | Mixed swift+normal | medium | 14 |
| 7 | The Steel Tide | Heavy armor mass | heavy | named above |
| 8 | Ghost Patrol | Intro Invisible (few) | medium | 6 invisible; teaches Detector |
| 9 | Pyre Air | Intro Air | light | 10 flying; teaches anti-air |
| 10 | **First Sentinel** (BOSS) | Single hero boss | hero | 1 big unit + 6 escorts |
| 11 | Frost Burn | Immune to slow | fortified | 12; punishes Frost-stacking |
| 12 | Razor Wing | Air swift | light | 14 fast flyers |
| 13 | Ghost Stampede | Invisible swift mass | medium | 20 invisible runners |
| 14 | Dread Cavalry | Heavy + swift mixed | heavy | 12, split armor profiles |
| 15 | Bound Watchers | Air heavy | heavy | 8 air with heavy armor; breaks Pierce-AA |
| 16 | The Pulse | Immune + invisible | fortified | 8; needs Detector + non-slow |
| 17 | The Bound Flame | 4 hero creeps | hero | named above |
| 18 | Ash Swarm | Swarm + air | light | 24 small flyers |
| 19 | Iron Ghosts | Heavy invisible | heavy | 10 |
| 20 | **The Verdant Maw** (BOSS) | Mega-boss | fortified | 1 huge unit, ~10x HP of wave 10 boss |
| 21 | Hollow March | Hero+swarm mix | mixed | 1 hero + 18 small |
| 22 | Spectral Wing | Invisible air | light | 12 invisible flyers |
| 23 | The Brand | Immune + heavy | fortified | 10 |
| 24 | Storm Tide | All-corner mass | mixed | 4 corners × 8 each |
| 25 | The Crucible | Mixed armor wave | light/medium/heavy/fortified | 4 corners, each different armor — forces diversity |
| 26 | Final Sentinels | 4 hero creeps + escorts | hero/heavy | scaling step toward final |
| 27 | The Long Dark | Invisible + speed + immune | fortified | the "puzzle wave" |
| 28 | Sky Plague | Air invisible swift | light | 14 |
| 29 | The Coronation | Heroes from each corner + boss minions | hero | 4 heroes + 20 escorts |
| 30 | **The Pale Crown** (FINAL BOSS) | Multi-phase | fortified/hero | 1 boss + summons every 25% HP threshold |

**Design rules:**
- Wave N's gimmick must be solvable with towers available by wave N-2 + L4 branches available by wave N-3.
- No two consecutive waves repeat the same armor type as primary.
- Boss waves (10, 20, 30) reward 250g, 500g, 1000g respectively + run completion bonus.
- Wave 25's mixed-armor design intentionally forces tower diversity; flag it in preview.

### 4c. Wave preview enhanced (extends 1b)

With wave manifests in JSON, preview HUD shows:
- Wave name in stylized font.
- Multi-enemy composition: small icon row.
- Up to 3 armor chips (for mixed waves like 25).
- Special icon if wave is named "puzzle" or "boss."
- "Recommended counters" — auto-computed top-3 damage types by matrix.

### 4d. Endless mode generator (for Phase 6 dependency)

`core/wave.py:generate_endless_wave(wave_n, rng)`:
- After wave 30, procedurally compose using `(armor_pool, trait_pool, modifier_stack)`.
- Stack modifiers more aggressively every 5 waves.
- Cap at ~150 enemies per wave.

### Acceptance

- All 30 waves load from `data/waves.json`.
- Wave 5 (Iron Probe) feels easier with Splash/Frost than Sniper/Rapid (verifiable in damage log).
- Wave 10 boss has ~5x HP of wave 9 enemies and 4.2x speed multiplier.
- Wave 25 spawns 4 corners with different armor types simultaneously.
- Beating wave 30 triggers victory; opting into endless mode starts procedural waves.

---

## Phase 5 — Game Feel (no audio)

**Goal:** every action and reaction feels weighty. Visual polish only — audio is Phase 8.
**Effort:** ~3 days.
**Ships:** damage numbers, hit-stop, scaled screen shake, type-specific death animations, tower firing animations, kill-streak visual feedback.

### 5a. Floating damage numbers

`core/fx.py:DamageNumber`:
- Spawn at enemy position on damage tick.
- Arcs upward + sideways, fades over 45 frames.
- Crit: 1.5x size, yellow.
- Block (< 0.5x matrix): grey, smaller, "—" prefix.
- Effective (> 1.5x matrix): green, bold.
- Throttle: aggregate hits within 8 frames per enemy → single bigger number.

### 5b. Hit-stop on heavy hits

In `Sim.step()`, if a tick produces a single hit > 100 damage OR an AoE killing > 3 enemies OR a boss damage event:
- `sim.hit_stop_frames = 4 to 6`
- Sim skips advancement for that many frames; rendering continues.
- Particle FX continue (gives the "frozen impact" feel).

### 5c. Screen shake scaled

Generalize current screen-shake (only on leaks at [line 2016](game.py:2016)):

```python
def add_shake(self, magnitude: float, duration_frames: int):
    self.screen_shake = max(self.screen_shake, magnitude)
    self.screen_shake_frames = max(self.screen_shake_frames, duration_frames)
```

Trigger sources:
- Single hit > 50 dmg → small shake (2.0, 6 frames)
- Splash kill → medium (5.0, 10)
- Boss damage → large (8.0, 12)
- Leak → large (10.0, 15)
- Wave clear → medium (4.0, 12)

Add `core/settings.py:REDUCED_MOTION` toggle (Phase 7) that scales shake by 0 or 0.3.

### 5d. Type-specific death animations

Replace the single ExplosionEffect for all kills ([line 339](game.py:339)) with type-specific:

| Enemy type | Death |
|---|---|
| Normal/Swift | small green particle burst |
| Armored | shatter into 6 angular fragments |
| Air | falling spiral + smoke trail |
| Boss | shockwave ring + 30-particle burst + 0.5s slow-mo (hit-stop 30 frames) |
| Hero | upward soul-wisp + flag drop |
| Invisible | sudden full visibility then standard burst |

### 5e. Tower firing animations

Each shot adds:
- Muzzle flash at barrel position (4-frame radial pulse)
- Tower recoil kick (translate 2px away from target, 6-frame ease back)
- Visible projectile trail (already exists but extend lifetime for Sniper)

### 5f. Kill-streak visual feedback

Current combo system at [line 2001](game.py:2001) just adds gold. Add:

- Combo ring around mouse position (expanding pulse every kill in streak)
- Combo counter big number in upper-center, scaled to combo size
- Combo end (timeout): briefly show "STREAK ENDED ×{n}" with shake

### Acceptance

- Hitting a Heavy enemy with a Pierce tower shows grey "—8" damage number.
- Killing a boss freezes sim ~0.5s, plays slow-mo death, large screen shake.
- Building 10 towers and clearing wave 5 produces hit-stop on splash kills.
- Toggling reduced-motion (Phase 7) eliminates shake but keeps hit-stop.

---

## Phase 6 — Meta & Longevity

**Goal:** keep players coming back. Roguelite cards + daily seed + endless + small persistent XP.
**Effort:** ~3 days.
**Ships:** card draft every 3 waves, daily seed leaderboard (local), endless mode active, persistent XP unlocks (capped).

### 6a. Roguelite card draft

Every 3 waves (3, 6, 9, 12, ...) present 3 cards. Player picks 1. Card categories:

`data/cards.json`:

```json
{
  "buffs": [
    {"id": "extra_gold",     "name": "Pocketed Reserves", "desc": "+5g per kill",      "weight": 5},
    {"id": "starting_dmg",   "name": "Sharpened Blades",  "desc": "+10% tower damage", "weight": 5},
    {"id": "wider_auras",    "name": "Verdant Reach",     "desc": "+30% aura radius",  "weight": 3},
    {"id": "hero_resilient", "name": "Bound Spirit",      "desc": "Hero +50% HP",      "weight": 4}
  ],
  "unlocks": [
    {"id": "tower_l5",       "name": "Mastered Path",     "desc": "Unlock L5 for a chosen tower", "weight": 1},
    {"id": "second_hero",    "name": "Twin Verdance",     "desc": "Spawn a second hero",          "weight": 1}
  ],
  "hazards": [
    {"id": "double_or_nothing", "name": "Bountiful Risk", "desc": "Next 3 waves: +30% enemies, +60% gold", "weight": 2}
  ]
}
```

UI: card draft modal with three cards (rarity colored), pick 1, others discarded. Skip option (refund 50g).

### 6b. Daily seed

- Seed = hash of date (UTC). Compute on game start if `--daily` flag.
- Daily run has fixed wave + card pool order.
- Local leaderboard: store best score per day in `~/.local/share/green-circle-td/scores.json`.
- Show ladder on main menu: "Best today: 8420 (you), prev best: 7100 (May 10)."

### 6c. Endless mode

- Unlocked after first wave-30 victory.
- After wave 30, waves keep generating via `generate_endless_wave()` (4d).
- Game over on first leak (1 life only in endless to keep stakes).
- Score = waves cleared × 1000 + gold remaining.

### 6d. Persistent XP unlocks (small)

`~/.local/share/green-circle-td/profile.json`:

```json
{
  "total_xp": 0,
  "unlocks": ["starting_gold_5", "starting_life_1", "card_skip_free_3"],
  "stats": {"wins": 0, "best_endless_wave": 0, "total_kills": 0}
}
```

XP per wave cleared (10 × wave_num), unlock tree (cap +15% total power):

| XP cost | Unlock |
|---|---|
| 100 | +5% starting gold |
| 250 | +1 starting life |
| 500 | Card skip is free 3x per run |
| 1000 | Unlock daily-seed leaderboard |
| 2000 | Unlock endless mode (auto-unlocked by wave 30 win anyway) |
| 3000 | +5% all damage |

**Do not gate content** — these are flavor buffs. New player can win wave 30 on a fresh profile.

### Acceptance

- After wave 3, a 3-card picker appears; selecting one applies its effect for the rest of the run.
- `python game.py --daily` plays a fixed seed; leaderboard saves and displays.
- Beating wave 30 unlocks endless mode in main menu.
- Profile XP accumulates; spending it in main menu tree applies on next run.

---

## Phase 7 — UX & Accessibility

**Goal:** every modern-TD UX expectation met; full a11y.
**Effort:** ~2 days.
**Ships:** color-blind palette + symbol overlays, undo, hotkey rebinding, pause-to-think, autosave, reduced motion, controller.

### 7a. Color-blind palette + enemy symbols

Settings menu toggle: `None / Deuteranopia / Protanopia / Tritanopia / High Contrast`.

For each enemy, add a small high-contrast symbol overlay drawn on the unit:
- ▲ Air
- ◆ Armored
- ✦ Invisible (when revealed)
- ⚡ Swift
- ✱ Swarm
- ⊘ Immune
- ♔ Hero
- ✪ Boss

Render in `core/renderer.py:draw_enemy_overlay()`. Symbols always on (low-vision aid).

### 7b. Undo last placement

15-second window after placing. `Ctrl-Z` or button. Returns gold; removes tower. Disabled after any kills made by the tower.

### 7c. Hotkey rebinding

`~/.config/green-circle-td/keybinds.json` with defaults. Settings menu shows table with rebind buttons.

### 7d. Pause-to-think mode

`Space` pauses sim but allows tower placement, upgrades, sells. Resume button or `Space` again to continue. Built on top of multi-speed system from Phase 0.

### 7e. Reduced-motion

Settings toggle. Scales screen shake to 0; replaces hit-stop with brief flash; removes camera pan effects.

### 7f. Autosave per wave

End of each wave clear: write `~/.local/share/green-circle-td/autosave.json`. Main menu: "Continue Run" if autosave exists. Confirms before overwrite on new run.

### 7g. Controller support

Arcade has `arcade.controller`. Map:
- Left stick / D-pad → cursor
- A → confirm/place
- B → cancel/sell
- X → upgrade
- Y → cycle targeting
- LB/RB → cycle tower selection
- Start → pause/resume

### Acceptance

- Toggling Deuteranopia mode swaps palette; armored enemies are visually distinct from normal ones to a color-blind tester (manual).
- All enemies show their type symbol regardless of palette mode.
- Placing a tower then pressing Ctrl-Z within 15 seconds restores gold and removes the tower.
- Pressing Space mid-wave pauses the game; can place a tower while paused; pressing Space again resumes.
- Closing the game mid-wave and reopening offers "Continue Run."
- Plugging in an Xbox controller lets the player complete wave 1.

---

## Phase 8 — Audio (DEFERRED)

**Not now.** Documented here as a reminder for later. Tasks deferred:
- Replace sine-wave SFX with CC0 SFX (freesound.org pack).
- Add 4-track dynamic music (ambient build, percussion combat, strings/brass boss, victory stinger).
- Crossfade between layers per game state.
- Audio settings: master / sfx / music volume sliders, mute toggle.
- Listener position for spatial SFX (subtle).

---

## Cross-cutting standards

These apply to every phase:

1. **Determinism.** Same seed → identical run. No `random.*` outside `core/rng.py`. No wall-clock dependencies in sim.
2. **No sim → renderer coupling.** `core/sim.py` must never `import arcade`. Tests verify with `grep arcade core/sim.py` empty.
3. **Data-driven balance.** Any numeric tweak (damage, range, cost, HP) is a JSON edit, not a code edit. Hard rule.
4. **Test before commit.** Phase 0 lays a pytest skeleton; every later phase adds tests for its new system (matrix calculations, aura stacking, wave manifest loading, card application).
5. **Performance budget.** Sim tick < 8ms on M5 Max with 150 entities + 20 towers. Profile if exceeded.
6. **No magic numbers in code.** All tuning values live in `data/*.json` or `core/settings.py`.
7. **Visuals respect reduced-motion setting.**
8. **No silent failure.** Catch + log + show user-visible error overlay if loading data fails.
9. **Single-file save.** `autosave.json`, `profile.json`, `scores.json` only — no SQLite, no databases.
10. **Keep the README updated** at the end of each phase: features added, current playable scope.

---

## Test plan

Add to `tests/`:

### Phase 0
- `test_seeded_rng.py` — same seed produces identical sequence.
- `test_data_load.py` — JSON files parse; every referenced tower/enemy exists.
- `test_speed_toggle.py` — 2x speed runs sim tick twice per render frame.

### Phase 1
- `test_armor_matrix.py` — pierce vs heavy = 100%, pierce vs light = 200%.
- `test_targeting_modes.py` — each mode picks the correct enemy from a fixture set.
- `test_dps_projection.py` — projected DPS = base × armor multiplier.

### Phase 2
- `test_path_corners.py` — 4 paths exist, all converge at center.
- `test_aura_stacking.py` — 2 overlapping +20% auras = +40% effective damage.
- `test_sell_curve.py` — wave 4 sells at 100%, wave 10 at 75%, wave 20 at 50%.

### Phase 3
- `test_hero_block.py` — ground enemy in hero radius stops moving.
- `test_synergy_frost_pierce.py` — pierce damage to slowed enemy is +25%.
- `test_upgrade_branches.py` — choosing branch A applies its stats, branch B unavailable after.

### Phase 4
- `test_waves_loadable.py` — all 30 waves parse, all enemy IDs exist.
- `test_wave_30_boss.py` — final boss has expected HP scaling.
- `test_endless_generator.py` — endless waves never exceed 150 enemies.

### Phase 5
- `test_damage_number_throttle.py` — 5 hits in 8 frames produces 1 aggregated number.
- `test_shake_magnitude_scaling.py` — boss damage > splash kill > single hit.

### Phase 6
- `test_card_draw.py` — 3 unique cards drawn from weighted pool.
- `test_daily_seed_deterministic.py` — same date → same waves and cards.
- `test_xp_accumulation.py` — wave 5 clear awards 50 XP; saves to profile.

### Phase 7
- `test_undo_window.py` — placement within 15s reversible; after first kill, blocked.
- `test_autosave_round_trip.py` — save mid-wave, load, state identical.

---

## Phase milestones / sequencing

```
Day 1       Phase 0 ends — modular code, multi-speed, seeded RNG
Day 4       Phase 1 ends — armor matrix + wave preview + targeting + range/DPS UI
Day 7       Phase 2 ends — earns the name "Green Circle TD"
Day 11      Phase 3 ends — hero + synergies + branching upgrades
Day 14      Phase 4 ends — 30 waves, hand-tuned
Day 17      Phase 5 ends — feels like a 2026 indie TD
Day 20      Phase 6 ends — replayable indefinitely
Day 22      Phase 7 ends — accessible + ergonomic
(Phase 8 audio later, on demand)
```

**Coding agent: start with Phase 0 unless told otherwise. Do not skip the acceptance criteria. Surface any ambiguity in this doc back to the user before improvising — especially balance numbers in Phase 4.**
