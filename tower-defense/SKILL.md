# Tower Defense: Phase 1 & Phase 2 Implementation

## Trigger Conditions

- User asks to "implement tower defense enhancements" or "add aura system" or "set up four-corner map"
- Project is located at `/Users/jonathangarnett/Developer/Guardian/tower-defense`
- Uses Arcade 3.0.2

## Steps

### Phase 1: Core Mechanics

1. **DPS Tooltip**
   - Already implemented in `core/sim.py` as `_draw_dps_tooltip()`
   - Triggered on mouse hover over towers
   - Shows projected DPS per armor type (`light`, `medium`, `heavy`, `fortified`, `hero`)

2. **Range Preview**
   - Already implemented in `on_mouse_motion()`
   - Circle appears when hovering over empty grid cell
   - Uses `self.tower_data[self.selected_tower]["range"]`

3. **Targeting Modes**
   - Cycle with `T` key: `FIRST`, `LAST`, `CLOSEST`, `STRONG`, `WEAK`
   - Displayed as 3-letter tag above tower (e.g., `FIR`, `STR`)

4. **Armor Matrix**
   - Implemented in `Tower.on_hit()`
   - Uses `get_multiplier(damage_type, armor_type)` from `core/armor.py`
   - Multipliers defined in `data/armor_matrix.json`

5. **Wave Preview HUD**
   - Already implemented in `_draw_wave_preview()`
   - Shows next 3 waves with armor type and projected DPS

### Phase 2: Four-Corner Map + Auras

1. **Four-Corner Path System**
   - `make_four_corner_paths()` in `core/path.py` generates 4 logarithmic spirals from corners to center
   - `spiral_path()` generates smooth path with 1.5 turns, 48 samples
   - Enemies use `enemy.path_points = self.paths[corner_index]` for routing

2. **Aura Towers**
   - Two new tower types in `data/towers.json`:
     - `damage_aura`: radius=160, value=0.20 → +20% damage
     - `speed_aura`: radius=150, value=0.15 → -15% cooldown
   - `compute_tower_modifiers()` in `core/aura.py`:
     - Finds all aura towers within range
     - Applies stacking bonuses to non-aura towers
     - Caps damage at +100%, cooldown at -75%

3. **Integration**
   - `Game.update()` now calls `compute_tower_modifiers(tower, self.towers)` for each tower
   - `aura_modifiers` passed to `tower.update()`

## Pitfalls & Notes

- **Aura Tower Range**: Aura towers do not shoot — they are purely support
- **Stacking**: Multiple aura towers of same type stack additively
- **Performance**: Aura checks are O(n²) but optimized for <10 towers
- **Visual Feedback**: Aura rings are drawn in `Tower.draw()` — visible even when tower is not selected

## Verification Steps

1. Start game
2. Place `damage_aura` and `speed_aura` near a `sniper`
3. Observe sniper’s DPS tooltip increase by 20%
4. Observe sniper’s cooldown decrease from 90 → 76.5
5. Place 2 `damage_aura` towers → sniper gets +40% damage
6. Watch enemies spawn from all 4 corners and spiral inward
7. Hover over towers → see DPS breakdown by armor type
8. Press `T` → cycle targeting modes

## Skill Dependencies

- `core/armor.py`
- `core/path.py`
- `core/aura.py`
- `data/armor_matrix.json`
- `data/towers.json`
- `data/enemies.json`

> Skill auto-applies to any project at `/Users/jonathangarnett/Developer/Guardian/tower-defense` with Arcade 3.0.2.

> No external tools required — pure Python/arcade.

> Created by Hermes Agent on May 30, 2026
