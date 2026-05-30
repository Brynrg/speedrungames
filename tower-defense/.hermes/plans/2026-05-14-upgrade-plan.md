# Green Circle TD - Upgrade Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Upgrade the existing Green Circle TD game with sound effects, save/load, difficulty scaling, visual polish, and code quality improvements.

**Architecture:** All changes stay in the single `game.py` file (monolithic but functional). New features are added as methods/classes within the existing Game class. No refactoring into modules yet — keep it YAGNI.

**Tech Stack:** Python 3.9, Arcade 3.0.2, macOS

---

## Current State Summary

- Single file: `game.py` (1,739 lines)
- 7 tower types: Basic, Sniper, Rapid, Splash, Frost, Poison, Detector
- 9 wave traits: Normal, Swift, Armored, Swarm, Air, Immune, Invisible, Hero, Boss
- 20 waves, concentric build pads, circular path
- 4-level tower upgrades, sell mechanic
- Build phase / combat phase cycle
- No sound, no save/load, no difficulty settings, no particle variety, no combo system

---

## Task 1: Add Sound Effects System

**Objective:** Add a simple sound system using Arcade's built-in sound support with generated tones (no external assets needed).

**Files:**
- Modify: `game.py`

**Step 1: Add sound constants and initialization**

Add after the existing imports (after line 9):

```python
# Sound frequencies for generated tones
SOUNDS = {
    "build": 880,
    "upgrade": 1100,
    "sell": 660,
    "shoot_basic": 440,
    "shoot_sniper": 220,
    "shoot_rapid": 660,
    "shoot_splash": 330,
    "shoot_frost": 1200,
    "shoot_poison": 550,
    "shoot_detector": 990,
    "hit": 200,
    "kill": 1320,
    "leak": 150,
    "wave_start": 770,
    "build_phase": 660,
    "victory": 1046,
    "game_over": 220,
    "error": 180,
}
```

Add to `Game.__init__()` after `self.tower_selection_timer = 0` (around line 958):

```python
        # Sound system
        self.sounds = {}
        for name, freq in SOUNDS.items():
            try:
                self.sounds[name] = arcade.SoundIO()
                # Generate a simple tone using arcade's sound buffer
                import array
                sample_rate = 22050
                duration = 0.1
                num_samples = int(sample_rate * duration)
                samples = array.array('h', [
                    int(32767 * math.sin(2 * math.pi * freq * i / sample_rate))
                    for i in range(num_samples)
                ])
                self.sounds[name].set_buffer(samples.tobytes(), num_samples, 1, sample_rate)
            except Exception:
                self.sounds[name] = None
        self.sound_enabled = True
```

**Step 2: Add a play_sound helper method**

Add to the Game class, after `set_status` method (around line 1032):

```python
    def play_sound(self, name, volume=0.3):
        if not self.sound_enabled:
            return
        sound = self.sounds.get(name)
        if sound:
            try:
                sound.set_volume(volume)
                sound.play()
            except Exception:
                pass
```

**Step 3: Wire up sounds to game events**

Add sound calls at these locations in the existing code:

- In `on_mouse_press` after successful tower build (around line 1593):
  ```python
  self.play_sound("build")
  ```

- In `upgrade_selected_tower` after successful upgrade (around line 1612):
  ```python
  self.play_sound("upgrade")
  ```

- In `sell_selected_tower` after successful sell (around line 1624):
  ```python
  self.play_sound("sell")
  ```

- In `Tower.update` after firing a bullet (around line 654):
  ```python
  self.play_sound(f"shoot_{self.tower_type}")
  ```

- In `Enemy.take_damage` when health reaches 0 (around line 431):
  ```python
  # Add a class-level reference or pass game reference
  ```
  Actually, better to handle kills in the Game.update method. Replace the kill block in `Game.update` (around line 1688):
  ```python
  if not enemy.active:
      if enemy.health <= 0:
          self.score += (
              12 + self.wave * 3 +
              self.current_wave_trait["bounty_bonus"]
          )
          self.play_sound("kill")
          explosion = ExplosionEffect(enemy.center_x, enemy.center_y, 20, ENEMY_COLOR)
          self.explosions.append(explosion)
  ```

- In `Game.update` after leak (around line 1707):
  ```python
  self.play_sound("leak")
  ```

- In `start_wave` (around line 1100):
  ```python
  self.play_sound("wave_start")
  ```

- In `begin_build_phase` (around line 1110):
  ```python
  self.play_sound("build_phase")
  ```

- In `Game.update` after game over (around line 1731):
  ```python
  self.play_sound("game_over")
  ```

- In `Game.update` after victory (around line 1665):
  ```python
  self.play_sound("victory")
  ```

- In `can_build_at` or `on_mouse_press` when build fails:
  ```python
  self.play_sound("error")
  ```

**Step 4: Add T key to toggle sound**

Add to `on_key_press` method (after the N/SPACE handler, around line 1547):

```python
        elif self._key_matches(key, "T"):
            self.sound_enabled = not self.sound_enabled
            self.set_status("Sound ON" if self.sound_enabled else "Sound OFF", 60)
```

**Step 5: Verify**

Run: `cd /Users/jonathangarnett/Developer/Guardian/tower-defense && ./venv/bin/python -c "import game; print('Import OK')"`

Expected: `Import OK`

**Step 6: Commit**

```bash
cd /Users/jonathangarnett/Developer/Guardian/tower-defense
git add game.py
git commit -m "feat: add sound effects system with T toggle"
```

---

## Task 2: Add Save/Load System

**Objective:** Add ability to save and load game state using JSON serialization.

**Files:**
- Modify: `game.py`

**Step 1: Add save method to Game class**

Add after `sell_selected_tower` method (around line 1627):

```python
    def save_game(self, filename="savegame.json"):
        import json
        save_data = {
            "health": self.health,
            "score": self.score,
            "wave": self.wave,
            "enemies": [{"x": e.x, "y": e.y, "current_point": e.current_point,
                         "health": e.health, "max_health": e.max_health,
                         "slow_timer": e.slow_timer, "slow_factor": e.slow_factor,
                         "poison_timer": e.poison_timer, "poison_damage": e.poison_damage,
                         "revealed_timer": e.revealed_timer, "trait_name": e.trait["name"]}
                        for e in self.enemies],
            "towers": [{"grid_x": t.grid_x, "grid_y": t.grid_y, "tower_type": t.tower_type,
                        "level": t.level, "total_spent": t.total_spent,
                        "damage": t.damage, "range": t.range, "cooldown": t.cooldown,
                        "splash_radius": t.splash_radius, "slow": t.slow,
                        "slow_duration": t.slow_duration, "poison_damage": t.poison_damage,
                        "poison_duration": t.poison_duration}
                       for t in self.towers],
            "build_phase": self.build_phase,
            "build_timer": self.build_timer,
            "income": self.income,
            "current_wave_trait": self.current_wave_trait["name"],
            "next_wave_trait": self.next_wave_trait["name"],
            "leaks": self.leaks,
        }
        with open(filename, "w") as f:
            json.dump(save_data, f)
        self.set_status(f"Game saved to {filename}", 120)

    def load_game(self, filename="savegame.json"):
        import json
        try:
            with open(filename, "r") as f:
                save_data = json.load(f)
            self.health = save_data["health"]
            self.score = save_data["score"]
            self.wave = save_data["wave"]
            self.build_phase = save_data["build_phase"]
            self.build_timer = save_data["build_timer"]
            self.income = save_data["income"]
            self.leaks = save_data["leaks"]
            self.current_wave_trait = next(
                (t for t in WAVE_TRAITS if t["name"] == save_data["current_wave_trait"]),
                WAVE_TRAITS[0]
            )
            self.next_wave_trait = next(
                (t for t in WAVE_TRAITS if t["name"] == save_data["next_wave_trait"]),
                WAVE_TRAITS[0]
            )
            # Rebuild enemies from saved state
            self.enemies = []
            for ed in save_data["enemies"]:
                e = Enemy(self.path_points, wave=self.wave, trait=self.current_wave_trait)
                e.x = ed["x"]
                e.y = ed["y"]
                e.current_point = ed["current_point"]
                e.health = ed["health"]
                e.max_health = ed["max_health"]
                e.slow_timer = ed["slow_timer"]
                e.slow_factor = ed["slow_factor"]
                e.poison_timer = ed["poison_timer"]
                e.poison_damage = ed["poison_damage"]
                e.revealed_timer = ed["revealed_timer"]
                self.enemies.append(e)
            # Rebuild towers
            self.towers = []
            for td in save_data["towers"]:
                t = Tower(td["grid_x"], td["grid_y"], td["tower_type"])
                t.level = td["level"]
                t.total_spent = td["total_spent"]
                t.damage = td["damage"]
                t.range = td["range"]
                t.cooldown = td["cooldown"]
                t.splash_radius = td["splash_radius"]
                t.slow = td["slow"]
                t.slow_duration = td["slow_duration"]
                t.poison_damage = td["poison_damage"]
                t.poison_duration = td["poison_duration"]
                self.towers.append(t)
            self.bullets = []
            self.explosions = []
            self.game_state = PLAYING
            self.set_status("Game loaded", 120)
        except FileNotFoundError:
            self.set_status(f"Save file {filename} not found", 90)
        except Exception as e:
            self.set_status(f"Error loading save: {e}", 90)
```

**Step 2: Add F5/F9 key bindings**

Add to `on_key_press` (after the N/SPACE handler):

```python
        elif self._key_matches(key, "F5"):
            self.save_game()
        elif self._key_matches(key, "F9"):
            self.load_game()
```

**Step 3: Update help text in draw_ui**

Change the help text line (around line 1361) from:
```python
help_text = "N next wave  P pause  U upgrade  S/right-click sell  R restart"
```
to:
```python
help_text = "N next wave  P pause  U upgrade  S/right-click sell  F5 save  F9 load  R restart"
```

**Step 4: Verify**

Run: `cd /Users/jonathangarnett/Developer/Guardian/tower-defense && ./venv/bin/python -c "import game; print('Import OK')"`

Expected: `Import OK`

**Step 5: Commit**

```bash
cd /Users/jonathangarnett/Developer/Guardian/tower-defense
git add game.py
git commit -m "feat: add save/load game system with F5/F9"
```

---

## Task 3: Add Difficulty Settings

**Objective:** Add Easy / Normal / Hard difficulty selection from the menu screen.

**Files:**
- Modify: `game.py`

**Step 1: Add difficulty constants**

Add after `GAME_STATES` (around line 265):

```python
# Difficulty settings
DIFFICULTIES = {
    "easy": {"health_mult": 0.7, "enemy_health_mult": 0.8, "enemy_speed_mult": 0.85, "gold_mult": 1.5, "name": "Easy"},
    "normal": {"health_mult": 1.0, "enemy_health_mult": 1.0, "enemy_speed_mult": 1.0, "gold_mult": 1.0, "name": "Normal"},
    "hard": {"health_mult": 1.3, "enemy_health_mult": 1.4, "enemy_speed_mult": 1.15, "gold_mult": 0.8, "name": "Hard"},
}
DEFAULT_DIFFICULTY = "normal"
```

**Step 2: Add difficulty tracking to Game class**

Add to `__init__` (after `self.tower_selection_timer = 0`):

```python
        # Difficulty
        self.difficulty = DEFAULT_DIFFICULTY
        self.difficulty_index = list(DIFFICULTIES.keys()).index(DEFAULT_DIFFICULTY)
```

**Step 3: Apply difficulty in setup()**

Modify the `setup()` method. After `self.health = 20` (around line 1069), add:

```python
        diff = DIFFICULTIES[self.difficulty]
        self.health = int(20 * diff["health_mult"])
        self.score = int(500 * diff["gold_mult"])
```

Modify enemy creation in `update()` (around line 1655). Change the Enemy constructor call to pass difficulty modifiers. Actually, modify the Enemy `__init__` to accept difficulty params, or apply them in the Game class.

Simpler approach: modify `start_wave` to apply difficulty to the trait:

```python
    def start_wave(self):
        self.current_wave_trait = self.get_wave_trait(self.wave)
        diff = DIFFICULTIES[self.difficulty]
        base_count = 4 + self.wave * 2 + self.current_wave_trait["count_bonus"]
        self.enemies_to_spawn = max(1, base_count)
        self.spawn_timer = 0
        self.build_phase = False
        self.build_timer = 0
        self.next_wave_trait = self.get_wave_trait(min(self.wave + 1, self.max_wave))
        self.wave_announcement = f"Wave {self.wave}: {self.current_wave_trait['name']} [{diff['name']}]"
        self.announcement_timer = 120
        self.set_status(f"{self.current_wave_trait['name']} wave incoming", 110)
```

Modify `Enemy.__init__` to accept difficulty multipliers. Add parameters:

```python
def __init__(self, path_points, scale=1.0, wave=1, trait=None, diff_mults=None):
```

And after the trait-based calculations (around line 356), apply:

```python
        if diff_mults:
            self.health *= diff_mults["enemy_health_mult"]
            self.max_health = self.health
            self.base_speed *= diff_mults["enemy_speed_mult"]
            self.speed = self.base_speed
```

Update the spawn call in `Game.update` (around line 1655):

```python
                diff = DIFFICULTIES[self.difficulty]
                enemy = Enemy(self.path_points, wave=self.wave,
                              trait=self.current_wave_trait,
                              diff_mults=diff)
```

**Step 4: Add difficulty cycling on menu**

Add to `on_key_press` (before the PLAYING check, around line 1499):

```python
        if self._key_matches(key, "M"):
            self.difficulty_index = (self.difficulty_index + 1) % len(DIFFICULTIES)
            self.difficulty = list(DIFFICULTIES.keys())[self.difficulty_index]
            self.set_status(f"Difficulty: {DIFFICULTIES[self.difficulty]['name']}", 90)
            return
```

**Step 5: Show difficulty on menu screen**

Modify `draw_menu` to show current difficulty. Add after the subtitle (around line 1419):

```python
        # Difficulty indicator
        diff = DIFFICULTIES[self.difficulty]
        arcade.draw_text(f"Difficulty: {diff['name']} (M to change)", SCREEN_WIDTH // 2,
                        SCREEN_HEIGHT // 2 - 15, UI_TEXT, 16, anchor_x="center")
```

**Step 6: Verify**

Run: `cd /Users/jonathangarnett/Developer/Guardian/tower-defense && ./venv/bin/python -c "import game; print('Import OK')"`

Expected: `Import OK`

**Step 7: Commit**

```bash
cd /Users/jonathangarnett/Developer/Guardian/tower-defense
git add game.py
git commit -m "feat: add Easy/Normal/Hard difficulty with M cycling"
```

---

## Task 4: Add Combo System

**Objective:** Add a kill combo system that rewards rapid successive kills with bonus gold and visual effects.

**Files:**
- Modify: `game.py`

**Step 1: Add combo constants**

Add after `DIFFICULTIES` (around line 272):

```python
# Combo system
COMBO_TIMEOUT = 90  # frames between kills to maintain combo
COMBO_GOLD_BONUS_BASE = 5
COMBO_GOLD_BONUS_SCALE = 3
```

**Step 2: Add combo state to Game.__init__**

Add after `self.tower_selection_timer = 0` (around line 958):

```python
        # Combo system
        self.combo_count = 0
        self.combo_timer = 0
        self.combo_gold_bonus = 0
```

**Step 3: Add combo tracking in update()**

In the kill handling section of `update()` (around line 1688), replace the existing kill block:

```python
        for enemy in self.enemies:
            if not enemy.active:
                if enemy.health <= 0:
                    # Combo tracking
                    self.combo_count += 1
                    self.combo_timer = COMBO_TIMEOUT
                    combo_bonus = COMBO_GOLD_BONUS_BASE + (self.combo_count - 1) * COMBO_GOLD_BONUS_SCALE
                    self.score += (
                        12 + self.wave * 3 +
                        self.current_wave_trait["bounty_bonus"] +
                        combo_bonus
                    )
                    self.combo_gold_bonus = combo_bonus
                    self.play_sound("kill")
                    explosion = ExplosionEffect(enemy.center_x, enemy.center_y, 20, ENEMY_COLOR)
                    self.explosions.append(explosion)
```

**Step 4: Add combo decay in update()**

Add after the combo tracking section in `update()`:

```python
        # Combo decay
        if self.combo_timer > 0:
            self.combo_timer -= 1
        else:
            self.combo_count = 0
            self.combo_gold_bonus = 0
```

**Step 5: Draw combo UI**

Add to `draw_ui()` method, after the stats display (around line 1373):

```python
        # Combo display
        if self.combo_count > 1:
            combo_alpha = min(255, self.combo_timer * 5)
            combo_text = f"COMBO x{self.combo_count}! +{self.combo_gold_bonus}g"
            arcade.draw_text(combo_text, SCREEN_WIDTH // 2, SCREEN_HEIGHT - 120,
                            rgba(UI_TEXT, int(combo_alpha)), 18, anchor_x="center")
```

**Step 6: Reset combo on setup()**

Add to `setup()` method (around line 1089):

```python
        self.combo_count = 0
        self.combo_timer = 0
        self.combo_gold_bonus = 0
```

**Step 7: Verify**

Run: `cd /Users/jonathangarnett/Developer/Guardian/tower-defense && ./venv/bin/python -c "import game; print('Import OK')"`

Expected: `Import OK`

**Step 8: Commit**

```bash
cd /Users/jonathangarnett/Developer/Guardian/tower-defense
git add game.py
git commit -m "feat: add kill combo system with bonus gold and UI display"
```

---

## Task 5: Add Visual Particle Enhancements

**Objective:** Enhance visual effects with more particle variety, screen shake application, and death effects.

**Files:**
- Modify: `game.py`

**Step 1: Apply screen shake in on_draw**

Add to the beginning of `on_draw()` (after `self.clear()` on line 1144):

```python
        # Apply screen shake
        if self.screen_shake > 0:
            shake_x = random.randint(-self.screen_shake, self.screen_shake)
            shake_y = random.randint(-self.screen_shake, self.screen_shake)
            arcade.set_viewport(
                -shake_x, SCREEN_WIDTH - shake_x,
                -shake_y, SCREEN_HEIGHT - shake_y
            )
```

Add at the end of `on_draw()` (before the final return):

```python
        # Reset viewport after screen shake
        if self.screen_shake > 0:
            arcade.set_viewport(0, SCREEN_WIDTH, 0, SCREEN_HEIGHT)
```

**Step 2: Enhance explosion effects**

Modify `ExplosionEffect.__init__` to create more particles:

Change `for _ in range(12):` to `for _ in range(20):` and add a ring effect:

```python
        # Create ring particles
        for i in range(8):
            angle = math.radians(i * 45)
            p = Particle(
                x + math.cos(angle) * 5,
                y + math.sin(angle) * 5,
                random.choice(EXPLOSION_COLORS),
                size=random.uniform(1, 3),
                speed=random.uniform(3, 6),
                lifetime=random.randint(10, 20)
            )
            self.particles.append(p)
```

**Step 3: Add tower-specific death particles**

In the kill handling section of `update()`, after creating the explosion, add tower-type colored particles:

```python
                    # Tower-type colored death sparks
                    for _ in range(5):
                        p = Particle(
                            enemy.center_x, enemy.center_y,
                            random.choice([ENEMY_COLOR, ENEMY_EYE_COLOR]),
                            size=random.uniform(1, 3),
                            speed=random.uniform(0.5, 2),
                            lifetime=random.randint(10, 25)
                        )
                        self.explosions[-1].particles.append(p) if self.explosions else None
```

**Step 4: Add wave completion celebration**

In `Game.update` after wave complete (around line 1669), add:

```python
            # Celebration particles
            for _ in range(30):
                p = Particle(
                    random.uniform(0, SCREEN_WIDTH),
                    random.uniform(0, SCREEN_HEIGHT),
                    random.choice(EXPLOSION_COLORS),
                    size=random.uniform(2, 6),
                    speed=random.uniform(0.5, 3),
                    lifetime=random.randint(30, 60)
                )
                self.explosions.append(ExplosionEffect(0, 0, 0, random.choice(EXPLOSION_COLORS)))
                self.explosions[-1].particles.append(p)
```

**Step 5: Verify**

Run: `cd /Users/jonathangarnett/Developer/Guardian/tower-defense && ./venv/bin/python -c "import game; print('Import OK')"`

Expected: `Import OK`

**Step 6: Commit**

```bash
cd /Users/jonathangarnett/Developer/Guardian/tower-defense
git add game.py
git commit -m "feat: enhance visual effects with screen shake, more particles, celebrations"
```

---

## Task 6: Add Mini-Map

**Objective:** Add a minimap in the corner showing the game arena, path, towers, and enemies.

**Files:**
- Modify: `game.py`

**Step 1: Add minimap constants**

Add after `COMBO_GOLD_BONUS_SCALE = 3`:

```python
# Minimap
MINIMAP_X = SCREEN_WIDTH - 160
MINIMAP_Y = SCREEN_HEIGHT - 160
MINIMAP_SIZE = 140
```

**Step 2: Add minimap drawing method**

Add to the Game class, after `draw_vignette`:

```python
    def draw_minimap(self):
        # Background
        arcade.draw_rectangle_filled(
            MINIMAP_X + MINIMAP_SIZE // 2,
            MINIMAP_Y + MINIMAP_SIZE // 2,
            MINIMAP_SIZE, MINIMAP_SIZE,
            rgba(PANEL_BG, 200)
        )
        arcade.draw_rectangle_outline(
            MINIMAP_X + MINIMAP_SIZE // 2,
            MINIMAP_Y + MINIMAP_SIZE // 2,
            MINIMAP_SIZE, MINIMAP_SIZE,
            UI_BORDER, 2
        )
        
        # Scale factors
        scale_x = MINIMAP_SIZE / SCREEN_WIDTH
        scale_y = MINIMAP_SIZE / SCREEN_HEIGHT
        
        # Draw path
        if self.path_points:
            mini_points = [(p[0] * scale_x + MINIMAP_X, p[1] * scale_y + MINIMAP_Y)
                          for p in self.path_points]
            if len(mini_points) >= 2:
                arcade.draw_line_strip(point_list=mini_points, color=PATH_COLOR, line_width=3)
        
        # Draw towers
        for tower in self.towers:
            tx = tower.center_x * scale_x + MINIMAP_X
            ty = tower.center_y * scale_y + MINIMAP_Y
            arcade.draw_circle_filled(tx, ty, 2, tower.color)
        
        # Draw enemies
        for enemy in self.enemies:
            ex = enemy.center_x * scale_x + MINIMAP_X
            ey = enemy.center_y * scale_y + MINIMAP_Y
            arcade.draw_circle_filled(ex, ey, 2, ENEMY_COLOR)
        
        # Draw build pads
        for x, y, radius, angle in self.build_pads:
            mx = x * scale_x + MINIMAP_X
            my = y * scale_y + MINIMAP_Y
            arcade.draw_circle_outline(mx, my, 3, rgba((116, 255, 136), 80), 1)
```

**Step 3: Call minimap in on_draw**

Add to `on_draw()` after drawing explosions (around line 1162):

```python
        self.draw_minimap()
```

**Step 4: Verify**

Run: `cd /Users/jonathangarnett/Developer/Guardian/tower-defense && ./venv/bin/python -c "import game; print('Import OK')"`

Expected: `Import OK`

**Step 5: Commit**

```bash
cd /Users/jonathangarnett/Developer/Guardian/tower-defense
git add game.py
git commit -m "feat: add minimap showing path, towers, and enemies"
```

---

## Task 7: Add Tower Range Visualization on Hover

**Objective:** Show tower range indicator when hovering over existing towers, and show build pad highlights during build phase.

**Files:**
- Modify: `game.py`

**Step 1: Add range-on-hover logic**

Modify `draw_placement_preview()` to also handle hovering over existing towers (not just build preview). Replace the method:

```python
    def draw_placement_preview(self):
        grid_x, grid_y = self.get_grid(self.mouse_x, self.mouse_y)
        if not self.is_valid_grid(grid_x, grid_y):
            return

        tower = self.get_tower_at_grid(grid_x, grid_y)
        if tower:
            # Show range and info for hovered tower
            arcade.draw_circle_outline(tower.center_x, tower.center_y, tower.range,
                                      SELECTED_COLOR, 2)
            arcade.draw_rectangle_outline(tower.center_x, tower.center_y,
                                         TILE_SIZE - 6, TILE_SIZE - 6,
                                         SELECTED_COLOR, 2)
            # Show tower info tooltip
            upgrade_cost = tower.upgrade_cost()
            info_y = tower.center_y + tower.range + 20
            info_text = f"{tower.name} L{tower.level} Dmg:{tower.damage} Rng:{tower.range}"
            if upgrade_cost is not None:
                info_text += f" Upg:{upgrade_cost}g"
            else:
                info_text += " MAX"
            arcade.draw_text(info_text, tower.center_x, info_y,
                            UI_TEXT_GREEN, 10, anchor_x="center")
            return

        # Existing build preview logic
        center_x, center_y = self.tower_center_for_grid(grid_x, grid_y)
        existing = self.get_tower_at_grid(grid_x, grid_y)
        valid, _ = self.can_build_at(grid_x, grid_y)
        preview_color = VALID_BUILD_COLOR if valid else INVALID_BUILD_COLOR

        arcade.draw_rectangle_filled(center_x, center_y, TILE_SIZE - 8,
                                    TILE_SIZE - 8, preview_color)
        arcade.draw_rectangle_outline(center_x, center_y, TILE_SIZE - 8,
                                     TILE_SIZE - 8,
                                     arcade.color.LIGHT_GREEN if valid else arcade.color.RED,
                                     2)
        arcade.draw_circle_outline(center_x, center_y,
                                  TOWER_DATA[self.selected_tower]["range"],
                                  arcade.color.LIGHT_GREEN if valid else arcade.color.RED,
                                  1)
```

**Step 2: Highlight build pads during build phase**

Add to `draw_background()` method, after the build pads are drawn (around line 1209):

```python
        # Highlight build pads during build phase
        if self.build_phase:
            for x, y, radius, angle in self.build_pads:
                # Check if pad is free
                is_occupied = any(
                    math.sqrt((t.center_x - x)**2 + (t.center_y - y)**2) < 20
                    for t in self.towers
                )
                if not is_occupied:
                    pulse = 40 + math.sin(self.rotation if hasattr(self, 'rotation') else 0) * 15
                    arcade.draw_circle_outline(x, y, radius + 3,
                                              rgba((116, 255, 136), pulse), 1)
```

Actually, the Game class doesn't have a `rotation` attribute at the game level. Use `self.announcement_timer` or a new timer. Simpler: use `self.wave` as a phase:

```python
        if self.build_phase:
            for x, y, radius, angle in self.build_pads:
                is_occupied = any(
                    math.sqrt((t.center_x - x)**2 + (t.center_y - y)**2) < 20
                    for t in self.towers
                )
                if not is_occupied:
                    pulse = 30 + math.sin(self.wave * 0.5) * 10
                    arcade.draw_circle_outline(x, y, radius + 3,
                                              rgba((116, 255, 136), pulse), 1)
```

**Step 3: Verify**

Run: `cd /Users/jonathangarnett/Developer/Guardian/tower-defense && ./venv/bin/python -c "import game; print('Import OK')"`

Expected: `Import OK`

**Step 4: Commit**

```bash
cd /Users/jonathangarnett/Developer/Guardian/tower-defense
git add game.py
git commit -m "feat: add tower range on hover and build pad highlights"
```

---

## Task 8: Add Requirements File and README

**Objective:** Create a `requirements.txt` and `README.md` for the project.

**Files:**
- Create: `requirements.txt`
- Create: `README.md`

**Step 1: Create requirements.txt**

```
arcade>=3.0.0
```

**Step 2: Create README.md**

```markdown
# Green Circle TD

Warcraft 3-inspired tower defense game built with Python and Arcade.

## Features

- 7 tower types: Basic, Sniper, Rapid, Splash, Frost, Poison, Detector
- 9 wave traits: Normal, Swift, Armored, Swarm, Air, Immune, Invisible, Hero, Boss
- 20 waves with increasing difficulty
- 4-level tower upgrade system
- Build phase / combat phase cycle
- Combo system for rapid kills
- Save/Load game support
- Difficulty settings (Easy, Normal, Hard)
- Warcraft 3 Green Circle aesthetic

## Controls

- **1-7**: Select tower type
- **Click**: Place selected tower / Select existing tower
- **Right-click**: Sell selected tower
- **U**: Upgrade selected tower
- **N / Space**: Send next wave early
- **P / Escape**: Pause game
- **F5**: Save game
- **F9**: Load game
- **T**: Toggle sound
- **M**: Cycle difficulty (on menu)
- **R**: Restart game

## Installation

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python game.py
```

## Distribution (macOS)

Build a `.app` bundle:

```bash
mkdir -p GreenCircleTD.app/Contents/MacOS
# Write Info.plist and launch script (see references/macos-app-bundle.md)
chmod +x GreenCircleTD.app/Contents/MacOS/launch
```

## Tech Stack

- Python 3.9+
- Arcade 3.0.2
- macOS (tested)
```

**Step 3: Verify files exist**

```bash
ls -la /Users/jonathangarnett/Developer/Guardian/tower-defense/requirements.txt
ls -la /Users/jonathangarnett/Developer/Guardian/tower-defense/README.md
```

**Step 4: Commit**

```bash
cd /Users/jonathangarnett/Developer/Guardian/tower-defense
git add requirements.txt README.md
git commit -m "docs: add requirements.txt and README.md"
```

---

## Task 9: Add macOS .app Bundle

**Objective:** Create a double-clickable `.app` bundle for macOS distribution.

**Files:**
- Create: `GreenCircleTD.app/Contents/Info.plist`
- Create: `GreenCircleTD.app/Contents/MacOS/launch`

**Step 1: Create directory structure**

```bash
mkdir -p /Users/jonathangarnett/Developer/Guardian/tower-defense/GreenCircleTD.app/Contents/MacOS
```

**Step 2: Find the venv Python path**

```bash
/Users/jonathangarnett/Developer/Guardian/tower-defense/venv/bin/python -c "import sys; print(sys.executable)"
```

**Step 3: Write Info.plist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>launch</string>
    <key>CFBundleIdentifier</key>
    <string>com.guardian.greencircletd</string>
    <key>CFBundleName</key>
    <string>Green Circle TD</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
</dict>
</plist>
```

**Step 4: Write launch script**

Replace `/path/to/venv/bin/python` with the actual path from Step 2:

```bash
#!/bin/bash
cd "$(dirname "$0")/../.."
/path/to/venv/bin/python game.py
```

**Step 5: Make executable**

```bash
chmod +x /Users/jonathangarnett/Developer/Guardian/tower-defense/GreenCircleTD.app/Contents/MacOS/launch
```

**Step 6: Commit**

```bash
cd /Users/jonathangarnett/Developer/Guardian/tower-defense
git add GreenCircleTD.app/
git commit -m "dist: add macOS .app bundle for distribution"
```

---

## Task 10: Add Unit Tests

**Objective:** Add basic unit tests for tower damage calculation, wave spawning, and path following.

**Files:**
- Create: `tests/test_game.py`
- Create: `tests/__init__.py`
- Modify: `test_simple.py` (replace with proper test)

**Step 1: Create tests directory**

```bash
mkdir -p /Users/jonathangarnett/Developer/Guardian/tower-defense/tests
touch /Users/jonathangarnett/Developer/Guardian/tower-defense/tests/__init__.py
```

**Step 2: Create test file**

```python
"""Unit tests for Green Circle TD game logic."""
import math
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from game import (
    Tower, Enemy, TOWER_DATA, WAVE_TRAITS,
    COMBO_TIMEOUT, DIFFICULTIES,
)


class TestTower:
    """Tests for Tower class."""

    def test_tower_creation(self):
        tower = Tower(5, 5, "basic")
        assert tower.grid_x == 5
        assert tower.grid_y == 5
        assert tower.tower_type == "basic"
        assert tower.level == 1
        assert tower.damage == TOWER_DATA["basic"]["damage"]
        assert tower.range == TOWER_DATA["basic"]["range"]

    def test_tower_upgrade(self):
        tower = Tower(5, 5, "basic")
        cost = tower.upgrade()
        assert cost is not None
        assert tower.level == 2
        assert tower.damage > TOWER_DATA["basic"]["damage"]
        assert tower.range > TOWER_DATA["basic"]["range"]
        assert tower.cooldown < TOWER_DATA["basic"]["cooldown"]

    def test_tower_max_level(self):
        tower = Tower(5, 5, "basic")
        tower.upgrade()
        tower.upgrade()
        tower.upgrade()
        assert tower.level == 4
        assert tower.upgrade_cost() is None

    def test_tower_upgrade_cost(self):
        tower = Tower(5, 5, "basic")
        cost_l1 = tower.upgrade_cost()
        assert cost_l1 is not None
        assert cost_l1 > 0
        cost_l2 = tower.upgrade_cost()
        assert cost_l2 > cost_l1

    def test_tower_sell_value(self):
        tower = Tower(5, 5, "basic")
        sell_value = tower.sell_value()
        assert sell_value > 0
        assert sell_value < tower.cost

    def test_tower_splash_upgrade(self):
        tower = Tower(5, 5, "splash")
        original_radius = tower.splash_radius
        tower.upgrade()
        assert tower.splash_radius > original_radius

    def test_tower_frost_upgrade(self):
        tower = Tower(5, 5, "frost")
        original_slow = tower.slow
        tower.upgrade()
        assert tower.slow < original_slow  # Lower factor = more slow

    def test_tower_detector_upgrade(self):
        tower = Tower(5, 5, "detector")
        original_range = tower.range
        tower.upgrade()
        assert tower.range > original_range


class TestEnemy:
    """Tests for Enemy class."""

    def test_enemy_creation(self):
        path = [(0, 0), (100, 0), (200, 0)]
        enemy = Enemy(path, wave=1, trait=WAVE_TRAITS[0])
        assert enemy.health > 0
        assert enemy.max_health == enemy.health
        assert enemy.active
        assert enemy.current_point == 0

    def test_enemy_damage(self):
        path = [(0, 0), (100, 0), (200, 0)]
        enemy = Enemy(path, wave=1, trait=WAVE_TRAITS[0])
        enemy.take_damage(enemy.health + 1)
        assert not enemy.active
        assert enemy.health == 0

    def test_enemy_slow(self):
        path = [(0, 0), (100, 0), (200, 0)]
        enemy = Enemy(path, wave=1, trait=WAVE_TRAITS[0])
        enemy.apply_slow(0.5, 30)
        assert enemy.slow_timer > 0
        assert enemy.slow_factor == 0.5

    def test_enemy_immune_slow(self):
        path = [(0, 0), (100, 0), (200, 0)]
        immune_trait = next(t for t in WAVE_TRAITS if t["name"] == "Immune")
        enemy = Enemy(path, wave=1, trait=immune_trait)
        enemy.apply_slow(0.5, 30)
        assert enemy.slow_timer == 0
        assert enemy.slow_factor == 1.0

    def test_enemy_invisible(self):
        path = [(0, 0), (100, 0), (200, 0)]
        invisible_trait = next(t for t in WAVE_TRAITS if t["name"] == "Invisible")
        enemy = Enemy(path, wave=1, trait=invisible_trait)
        assert enemy.is_invisible
        assert not enemy.is_targetable_by("basic")
        assert enemy.is_targetable_by("detector")

    def test_enemy_air(self):
        path = [(0, 0), (100, 0), (200, 0)]
        air_trait = next(t for t in WAVE_TRAITS if t["name"] == "Air")
        enemy = Enemy(path, wave=1, trait=air_trait)
        assert enemy.is_air
        assert not enemy.is_targetable_by("basic")
        assert enemy.is_targetable_by("sniper")

    def test_enemy_path_following(self):
        path = [(0, 0), (100, 0), (200, 0)]
        enemy = Enemy(path, wave=1, trait=WAVE_TRAITS[0])
        # Move enemy to end
        for _ in range(100):
            enemy.update()
        assert enemy.current_point >= len(path)


class TestWaveTraits:
    """Tests for wave trait system."""

    def test_trait_health_scaling(self):
        trait = WAVE_TRAITS[2]  # Armored
        assert trait["health_mult"] > 1.0

    def test_trait_speed_scaling(self):
        trait = WAVE_TRAITS[1]  # Swift
        assert trait["speed_mult"] > 1.0

    def test_trait_flags(self):
        air_trait = next(t for t in WAVE_TRAITS if t["name"] == "Air")
        assert "air" in air_trait["flags"]


class TestDifficulty:
    """Tests for difficulty system."""

    def test_difficulty_health(self):
        assert DIFFICULTIES["easy"]["health_mult"] < 1.0
        assert DIFFICULTIES["normal"]["health_mult"] == 1.0
        assert DIFFICULTIES["hard"]["health_mult"] > 1.0

    def test_difficulty_gold(self):
        assert DIFFICULTIES["easy"]["gold_mult"] > 1.0
        assert DIFFICULTIES["hard"]["gold_mult"] < 1.0


class TestCombo:
    """Tests for combo system."""

    def test_combo_timeout_value(self):
        assert COMBO_TIMEOUT > 0
        assert COMBO_TIMEOUT == 90


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
```

**Step 3: Install pytest**

```bash
cd /Users/jonathangarnett/Developer/Guardian/tower-defense
./venv/bin/pip install pytest
```

**Step 4: Run tests**

```bash
cd /Users/jonathangarnett/Developer/Guardian/tower-defense
./venv/bin/python -m pytest tests/test_game.py -v
```

Expected: All tests pass (green).

**Step 5: Commit**

```bash
cd /Users/jonathangarnett/Developer/Guardian/tower-defense
git add tests/
git commit -m "test: add unit tests for towers, enemies, waves, difficulty, combo"
```

---

## Summary of All Upgrades

| # | Feature | Status |
|---|---------|--------|
| 1 | Sound Effects System | Planned |
| 2 | Save/Load System | Planned |
| 3 | Difficulty Settings | Planned |
| 4 | Combo System | Planned |
| 5 | Visual Enhancements | Planned |
| 6 | Mini-Map | Planned |
| 7 | Tower Range on Hover | Planned |
| 8 | Requirements + README | Planned |
| 9 | macOS .app Bundle | Planned |
| 10 | Unit Tests | Planned |

Each task is designed to be 2-5 minutes of focused work. All changes stay in `game.py` except for the new test file and documentation files.
