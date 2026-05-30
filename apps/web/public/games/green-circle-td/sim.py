"""Green Circle TD - Main game simulation (Game class)."""
import math
import array
import json
import os
import random
import sys

import arcade

from core.settings import (
    SCREEN_WIDTH, SCREEN_HEIGHT, SCREEN_TITLE,
    TILE_SIZE, GRID_WIDTH, GRID_HEIGHT,
    BG_COLOR, GRASS_LIGHT, GRASS_DARK, GRID_LINE_COLOR,
    VIGNETTE_COLOR, PATH_COLOR, PATH_HIGHLIGHT, PATH_SHADOW,
    PATH_BORDER_COLOR, PATH_BORDER_WIDTH,
    TOWER_BASE_COLOR, TOWER_RING_COLOR, TOWER_ACCENT_COLOR,
    ENEMY_COLOR, ENEMY_OUTLINE, ENEMY_EYE_COLOR,
    ENEMY_HEALTH_BAR_BG, ENEMY_HEALTH_BAR_FG,
    BULLET_COLOR, BULLET_GLOW, BULLET_TRAIL,
    SPLASH_COLOR, SPLASH_EXPLOSION,
    EXPLOSION_COLORS,
    UI_BG, UI_BORDER, UI_TEXT, UI_TEXT_WHITE, UI_TEXT_GREEN, UI_TEXT_RED,
    VALID_BUILD_COLOR, INVALID_BUILD_COLOR, SELECTED_COLOR, SHADOW_COLOR,
    PANEL_BG, PANEL_BG_LIGHT, GOLD_GLOW,
    MENU, PLAYING, GAME_OVER, VICTORY,
    DIFFICULTIES, DEFAULT_DIFFICULTY,
    COMBO_TIMEOUT, COMBO_GOLD_BONUS_BASE, COMBO_GOLD_BONUS_SCALE,
    MINIMAP_X, MINIMAP_Y, MINIMAP_SIZE, MAX_WAVE,
    SPEEDS, DEFAULT_SPEED,
)
from core.rng import Rng
from core.data import load_towers, load_enemies, load_waves, load_hero, load_upgrades, load_cards
from core.path import make_green_circle_path, make_four_corner_paths
from core.particle import ExplosionEffect
from core.aura import get_active_aura_towers, compute_tower_modifiers
from core.tower import Tower
from core.enemy import Enemy
from core.hero import Hero
from core.bullet import Bullet, SplashBullet, rgba


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


class Game(arcade.Window):
    """Main game window - Warcraft 3 green circle TD style."""

    def __init__(self, seed=None):
        try:
            super().__init__(SCREEN_WIDTH, SCREEN_HEIGHT, SCREEN_TITLE)
        except Exception as e:
            print(f"Error creating window: {e}")
            sys.exit(1)

        # Seeded RNG
        self.seed = seed if seed is not None else random.randint(0, 99999)
        self.rng = Rng(self.seed)
        print(f"Seed: {self.seed}")

        self.game_state = MENU
        self.enemies = []
        self.towers = []
        self.bullets = []
        self.explosions = []
        self.path_points = []
        self.health = 20
        self.score = 500  # Start with some gold
        self.wave = 1
        self.wave_timer = 0
        self.enemies_to_spawn = 0
        self.spawn_timer = 0
        self.selected_tower = "basic"
        self.selected_grid = None
        self.mouse_x = SCREEN_WIDTH // 2
        self.mouse_y = SCREEN_HEIGHT // 2
        self.status_message = ""
        self.status_timer = 0
        self.paused = False
        self.max_wave = MAX_WAVE
        self.current_wave_trait = load_enemies()[0]
        self.next_wave_trait = load_enemies()[0]
        self.build_phase = False
        self.build_timer = 0
        self.build_phase_duration = 360
        self.income = 20
        self.income_timer = 0
        self.leaks = 0
        self.screen_shake = 0
        # Phase 5: Visual effects (no screen shake)
        from core.fx import EffectManager
        self.fx = EffectManager(self.rng)
        self.wave_announcement = ""
        self.announcement_timer = 0
        self.tower_selection_timer = 0

        # Multi-speed
        self.speed = DEFAULT_SPEED
        self.speed_index = 0
        self.sim_ticks_per_frame = SPEEDS[DEFAULT_SPEED]

        # Tower data from JSON
        self.tower_data = load_towers()
        self.tower_order = list(self.tower_data.keys())

        # Enemy wave traits from JSON
        self.wave_traits = load_enemies()

        # Wave manifest from JSON (Phase 4)
        self.wave_manifest = load_waves()
        self.wave_by_id = {w["id"]: w for w in self.wave_manifest}
        self.total_manifest_waves = len(self.wave_manifest)

        # Sound system
        self.sounds = {}
        for name, freq in SOUNDS.items():
            try:
                self.sounds[name] = arcade.SoundIO()
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

        # Difficulty
        self.difficulty = DEFAULT_DIFFICULTY
        self.difficulty_index = list(DIFFICULTIES.keys()).index(DEFAULT_DIFFICULTY)

        # Combo system
        self.combo_count = 0
        self.combo_timer = 0
        self.combo_gold_bonus = 0

        # Hero unit (Phase 3a)
        self.hero_data = load_hero()
        self.hero = None  # Created in setup()

        # Card draft system (Phase 6)
        self.card_effects = None
        self.card_state = None  # None, "draft"
        self.draft_cards = []
        self.draft_selection = None

        # Branching upgrade UI (Phase 3c)
        self.upgrade_state = None  # None or "branch"
        self.upgrade_pending_tower = None
        self.upgrade_branch_options = None

        # Reduced motion (Phase 7)
        self.reduced_motion = False

        # Terrain generation - four corner paths
        self.paths, self.spawn_points, self.center_point = make_four_corner_paths(SCREEN_WIDTH, SCREEN_HEIGHT)
        self.current_path_index = 0  # Which path enemies use (for single-path mode)
        self.path_points = self.paths  # Use all 4 paths for dynamic enemy routing
        self.spawn_corner_index = 0  # Round-robin corner index for spawning
        self.terrain_marks = []
        self.path_stones = []
        self.build_pads = []
        self._generate_terrain()

        arcade.set_background_color(BG_COLOR)

    def _generate_terrain(self):
        """Generate terrain decorations, path stones, and build pads."""
        rng = self.rng
        for i in range(70):
            self.terrain_marks.append((
                rng.randint(0, SCREEN_WIDTH),
                rng.randint(0, SCREEN_HEIGHT),
                rng.randint(3, 13),
                rng.choice([GRASS_LIGHT, (35, 126, 65), (10, 67, 41)]),
                rng.uniform(-28, 28),
            ))
        for p1, p2 in zip(self.path_points, self.path_points[1:]):
            dx = p2[0] - p1[0]
            dy = p2[1] - p1[1]
            length = max(1, math.sqrt(dx * dx + dy * dy))
            steps = max(1, int(length // 42))
            normal_x = -dy / length
            normal_y = dx / length
            for step in range(steps + 1):
                t = step / steps
                center_x = p1[0] + dx * t + rng.uniform(-6, 6)
                center_y = p1[1] + dy * t + rng.uniform(-6, 6)
                side = rng.choice([-1, 1])
                offset = side * rng.uniform(7, 15)
                self.path_stones.append((
                    center_x + normal_x * offset,
                    center_y + normal_y * offset,
                    rng.uniform(4, 9),
                    rng.uniform(2, 5),
                    rng.uniform(-35, 35),
                ))
        arena_x = SCREEN_WIDTH // 2
        arena_y = SCREEN_HEIGHT // 2 - 10
        for ring_radius in (122, 185, 246):
            pad_count = 8 if ring_radius < 200 else 12
            for index in range(pad_count):
                angle = math.radians(index * 360 / pad_count + (18 if ring_radius == 185 else 0))
                self.build_pads.append((
                    arena_x + math.cos(angle) * ring_radius,
                    arena_y + math.sin(angle) * ring_radius,
                    14 if ring_radius < 200 else 11,
                    angle,
                ))

    @staticmethod
    def _key_matches(key, *names):
        return any(key == getattr(arcade.key, name, None) for name in names)

    def set_status(self, message, duration=120):
        self.status_message = message
        self.status_timer = duration

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

    def tower_cost(self, tower_type=None):
        td = self.tower_data[tower_type or self.selected_tower]
        return td["cost"]

    def get_grid(self, x, y):
        return int(x // TILE_SIZE), int(y // TILE_SIZE)

    def get_tower_at_grid(self, grid_x, grid_y):
        for tower in self.towers:
            if tower.grid_x == grid_x and tower.grid_y == grid_y:
                return tower
        return None

    def is_valid_grid(self, grid_x, grid_y):
        return 0 <= grid_x < GRID_WIDTH and 0 <= grid_y < GRID_HEIGHT

    def tower_center_for_grid(self, grid_x, grid_y):
        return grid_x * TILE_SIZE + TILE_SIZE // 2, grid_y * TILE_SIZE + TILE_SIZE // 2

    def is_on_path(self, x, y):
        """Check if a point is on any of the four corner paths."""
        for path in self.paths:
            for i in range(len(path) - 1):
                p1 = path[i]
                p2 = path[i + 1]
                dx = p2[0] - p1[0]
                dy = p2[1] - p1[1]
                length = math.sqrt(dx * dx + dy * dy)
                if length == 0:
                    continue
                t = max(0, min(1, ((x - p1[0]) * dx + (y - p1[1]) * dy) / (length * length)))
                proj_x = p1[0] + t * dx
                proj_y = p1[1] + t * dy
                dist = math.sqrt((x - proj_x) ** 2 + (y - proj_y) ** 2)
                if dist < PATH_BORDER_WIDTH // 2 + 10:
                    return True
        return False

    def can_build_at(self, grid_x, grid_y):
        if not self.is_valid_grid(grid_x, grid_y):
            return False, "Out of bounds"
        center_x, center_y = self.tower_center_for_grid(grid_x, grid_y)
        if self.is_on_path(center_x, center_y):
            return False, "Cannot build on path"
        if self.get_tower_at_grid(grid_x, grid_y):
            return False, "Tower already here"
        cost = self.tower_cost()
        if self.score < cost:
            return False, f"Need {cost} gold"
        return True, ""

    def setup(self):
        self.enemies = []
        self.towers = []
        self.bullets = []
        self.explosions = []
        diff = DIFFICULTIES[self.difficulty]
        self.health = int(20 * diff["health_mult"])
        self.score = int(500 * diff["gold_mult"])
        self.wave = 1
        self.wave_timer = 0
        self.enemies_to_spawn = 5
        self.spawn_timer = 0
        self.selected_tower = "basic"
        self.selected_grid = None
        self.status_message = ""
        self.status_timer = 0
        self.paused = False
        wave_data = self.get_wave_manifest(1)
        self.current_wave_trait = wave_data["trait"]
        self.next_wave_trait = wave_data["trait"]
        self.build_phase = True
        self.build_timer = self.build_phase_duration
        self.income = 20
        self.income_timer = 0
        self.leaks = 0
        self.wave_announcement = "Build Phase"
        self.announcement_timer = 120
        self.tower_selection_timer = 0
        self.combo_count = 0
        self.combo_timer = 0
        self.combo_gold_bonus = 0

        # Create hero at center
        cx, cy = self.center_point
        self.hero = Hero(cx, cy, self.hero_data, self.rng)

        # Reset card effects
        from core.card import CardEffect
        self.card_effects = CardEffect()
        self.card_state = None
        self.draft_cards = []
        self.draft_selection = None

        # Reset branching upgrade UI
        self.upgrade_state = None
        self.upgrade_pending_tower = None
        self.upgrade_branch_options = None

    def get_wave_manifest(self, wave_num):
        """Get wave manifest entry for a given wave number.

        For waves 1-30, returns the hand-designed manifest entry.
        For waves > 30, generates an endless mode wave.

        Returns:
            Dict with 'trait' (enemy trait) and 'spawns' (spawn entries).
        """
        if wave_num in self.wave_by_id:
            manifest = self.wave_by_id[wave_num]
            # Determine primary trait from first spawn entry
            first_spawn = manifest["spawns"][0]
            trait_name = first_spawn["enemy"]
            trait = next(
                (t for t in self.wave_traits if t["name"] == trait_name),
                self.wave_traits[0]
            )
            return {"trait": trait, "manifest": manifest}
        return self._generate_endless_wave(wave_num)

    def _generate_endless_wave(self, wave_num):
        """Generate an endless mode wave for waves > 30.

        Procedurally composes waves using trait pools and modifier stacking.
        """
        # Cycle through traits more aggressively
        trait_pool = ["Normal", "Swift", "Armored", "Swarm", "Air", "Immune", "Invisible", "Hero"]
        # Pick 2-3 random traits based on wave difficulty
        num_traits = min(3, 1 + (wave_num - 30) // 10)
        traits = []
        for i in range(num_traits):
            t = trait_pool[(wave_num + i) % len(trait_pool)]
            traits.append(t)

        # Scale counts with wave number
        base_count = 10 + (wave_num - 30) * 3
        base_count = min(base_count, 150)  # Cap at 150

        spawns = []
        trait = self.wave_traits[0]  # Default
        for i, trait_name in enumerate(traits):
            count = base_count // num_traits
            corner = i % 4
            trait = next(
                (t for t in self.wave_traits if t["name"] == trait_name),
                self.wave_traits[0]
            )
            spawns.append({
                "enemy": trait_name,
                "count": count,
                "interval": max(0.2, 0.7 - (wave_num - 30) * 0.01),
                "corner": corner,
                "start_at": i * 2.0
            })

        return {"trait": trait, "spawns": spawns}

    def get_wave_trait(self, wave):
        """Legacy: get wave trait by modulo (for backward compat with tests)."""
        by_name = {trait["name"]: trait for trait in self.wave_traits}
        if wave % 10 == 0:
            return by_name["Boss"]
        if wave % 9 == 0:
            return by_name["Invisible"]
        if wave % 8 == 0:
            return by_name["Hero"]
        if wave % 7 == 0:
            return by_name["Air"]
        if wave % 6 == 0:
            return by_name["Immune"]
        if wave % 5 == 0:
            return by_name["Armored"]
        if wave % 4 == 0:
            return by_name["Swarm"]
        if wave % 3 == 0:
            return by_name["Swift"]
        return by_name["Normal"]

    def start_wave(self):
        # Load wave manifest
        wave_data = self.get_wave_manifest(self.wave)
        self.current_wave_trait = wave_data["trait"]
        manifest = wave_data.get("manifest")

        if manifest and "spawns" in manifest:
            # Use manifest-based spawning
            self.wave_manifest_spawns = []
            total_to_spawn = 0
            for spawn_entry in manifest["spawns"]:
                enemy_type = spawn_entry["enemy"]
                count = spawn_entry["count"]
                interval = spawn_entry["interval"]
                corner = spawn_entry["corner"]
                start_at = spawn_entry.get("start_at", 0.0)

                # Resolve corner index
                if isinstance(corner, str):
                    corner_map = {"TL": 0, "TR": 1, "BL": 2, "BR": 3}
                    corner = corner_map.get(corner, 0)

                self.wave_manifest_spawns.append({
                    "enemy_type": enemy_type,
                    "count": count,
                    "interval": interval,
                    "corner": corner,
                    "start_at": start_at,
                    "spawned": 0,
                    "timer": 0,
                })
                total_to_spawn += count

            self.enemies_to_spawn = total_to_spawn
            self.spawn_timer = 0
            self.spawn_corner_index = 0
        else:
            # Fallback: old count-based spawning
            base_count = 4 + self.wave * 2 + self.current_wave_trait["count_bonus"]
            self.enemies_to_spawn = max(1, base_count)
            self.spawn_timer = 0
            self.spawn_corner_index = 0

        self.build_phase = False
        self.build_timer = 0

        # Next wave trait
        next_wave_data = self.get_wave_manifest(min(self.wave + 1, self.max_wave))
        self.next_wave_trait = next_wave_data["trait"]

        diff = DIFFICULTIES[self.difficulty]
        wave_name = self.current_wave_trait["name"]
        if manifest and "name" in manifest:
            wave_name = manifest["name"]
        self.wave_announcement = f"Wave {self.wave}: {wave_name} [{diff['name']}]"
        self.announcement_timer = 120
        self.set_status(f"{wave_name} wave incoming", 110)
        self.play_sound("wave_start")

        # Assign spawn corner(s) for this wave
        if manifest and "spawns" in manifest:
            # Use corners from manifest spawns
            self.spawn_corners = list(set(s["corner"] if isinstance(s["corner"], int) else 0 for s in manifest["spawns"]))
        else:
            if self.wave <= 2:
                self.spawn_corners = [0]
            elif self.wave <= 4:
                self.spawn_corners = [0, 1]
            else:
                self.spawn_corners = [0, 1, 2, 3]
        self._corner_index = 0

    def begin_build_phase(self):
        self.build_phase = True
        self.build_timer = self.build_phase_duration
        # Use manifest for next wave trait
        next_wave_data = self.get_wave_manifest(self.wave)
        self.next_wave_trait = next_wave_data["trait"]
        self.income = min(160, self.income + 4)
        self.score += self.income
        self.wave_announcement = "Build Phase"
        self.announcement_timer = 90
        self.set_status(f"Income +{self.income} gold. Press N to send wave early.", 150)
        self.play_sound("build_phase")
        # Respawn hero at center
        if self.hero:
            self.hero.respawn()

    def send_next_wave_early(self):
        if not self.build_phase:
            self.set_status("Wave already active", 70)
            return
        bonus = max(0, self.build_timer // 30) * 3
        if bonus:
            self.score += bonus
        self.set_status(f"Wave called early +{bonus} gold", 90)
        self.start_wave()

    def get_wave_trait(self, wave):
        by_name = {trait["name"]: trait for trait in self.wave_traits}
        if wave % 10 == 0:
            return by_name["Boss"]
        if wave % 9 == 0:
            return by_name["Invisible"]
        if wave % 8 == 0:
            return by_name["Hero"]
        if wave % 7 == 0:
            return by_name["Air"]
        if wave % 6 == 0:
            return by_name["Immune"]
        if wave % 5 == 0:
            return by_name["Armored"]
        if wave % 4 == 0:
            return by_name["Swarm"]
        if wave % 3 == 0:
            return by_name["Swift"]
        return by_name["Normal"]

    def save_game(self, filename="savegame.json"):
        save_data = {
            "health": self.health,
            "score": self.score,
            "wave": self.wave,
            "enemies": [{"x": e.x, "y": e.y, "current_point": e.current_point,
                         "health": e.health, "max_health": e.max_health,
                         "base_speed": e.base_speed,
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
                (t for t in self.wave_traits if t["name"] == save_data["current_wave_trait"]),
                self.wave_traits[0]
            )
            self.next_wave_trait = next(
                (t for t in self.wave_traits if t["name"] == save_data["next_wave_trait"]),
                self.wave_traits[0]
            )
            self.enemies = []
            for ed in save_data["enemies"]:
                e = Enemy(self.path_points, wave=self.wave, trait=self.current_wave_trait)
                e.x = ed["x"]
                e.y = ed["y"]
                e.current_point = ed["current_point"]
                e.health = ed["health"]
                e.max_health = ed["max_health"]
                e.base_speed = ed.get("base_speed", e.base_speed)
                e.slow_timer = ed["slow_timer"]
                e.slow_factor = ed["slow_factor"]
                e.poison_timer = ed["poison_timer"]
                e.poison_damage = ed["poison_damage"]
                e.revealed_timer = ed["revealed_timer"]
                self.enemies.append(e)
            self.towers = []
            for td in save_data["towers"]:
                t = Tower(td["grid_x"], td["grid_y"], td["tower_type"],
                          tower_data=self.tower_data.get(td["tower_type"], {}))
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

    def upgrade_selected_tower(self):
        if not self.selected_grid:
            self.set_status("Select a tower first", 90)
            return
        tower = self.get_tower_at_grid(*self.selected_grid)
        if not tower:
            self.selected_grid = None
            self.set_status("Select a tower first", 90)
            return
        cost = tower.upgrade_cost()
        if cost is None:
            self.set_status(f"{tower.name} is max level", 90)
            return
        if self.score < cost:
            self.set_status(f"Need {cost} gold", 90)
            return
        self.score -= tower.upgrade()
        if tower.level == 3:
            # Show branch picker
            branch_options = tower._get_branch_options()
            if branch_options:
                self.upgrade_state = "branch"
                self.upgrade_pending_tower = tower
                self.upgrade_branch_options = branch_options
                self.set_status(f"{tower.name} ready for branch upgrade! Press U to choose", 120)
                return
        self.set_status(f"{tower.name} upgraded to L{tower.level}", 100)
        self.play_sound("upgrade")

    def sell_selected_tower(self):
        if not self.selected_grid:
            self.set_status("Select a tower first", 90)
            return
        tower = self.get_tower_at_grid(*self.selected_grid)
        if not tower:
            self.selected_grid = None
            self.set_status("Select a tower first", 90)
            return
        refund = tower.sell_value(self.wave)
        self.score += refund
        self.towers.remove(tower)
        self.selected_grid = None
        self.set_status(f"Sold {tower.name} for {refund} gold", 100)
        self.play_sound("sell")

    # ---- Card draft helpers ----

    def _select_card(self, index):
        """Select a card from the draft."""
        if not self.draft_cards or index >= len(self.draft_cards):
            return
        card = self.draft_cards[index]
        if self.card_effects:
            self.card_effects.apply_card(card)
        self.card_state = None
        self.draft_cards = []
        self.set_status(f"Card selected: {card.get('name', card.get('id', 'Unknown'))}", 120)

    def _skip_card(self):
        """Skip card draft, refund 50g."""
        self.score += 50
        self.card_state = None
        self.draft_cards = []
        self.set_status("Skipped card (+50g)", 90)

    def _apply_branch(self, index):
        """Apply a branching upgrade."""
        if not self.upgrade_pending_tower or not self.upgrade_branch_options:
            return
        branches = self.upgrade_branch_options.get("branches", [])
        if index >= len(branches):
            return
        branch = branches[index]
        self.upgrade_pending_tower.apply_branch(branch["id"])
        self.upgrade_state = None
        self.upgrade_pending_tower = None
        self.upgrade_branch_options = None
        self.set_status(f"{self.upgrade_pending_tower.name if self.upgrade_pending_tower else 'Tower'} → {branch['name']}", 120)

    # ---- Branch upgrade UI ----

    def _draw_branch_picker(self):
        """Draw the branching upgrade picker modal."""
        import arcade as _arc
        if self.upgrade_state != "branch" or not self.upgrade_branch_options:
            return
        branches = self.upgrade_branch_options.get("branches", [])
        if not branches:
            return

        # Center of screen
        cx, cy = SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2
        card_w, card_h = 220, 160

        # Background
        _arc.draw_rectangle_filled(cx, cy, 480, 200, rgba((0, 0, 0, 180)))
        _arc.draw_rectangle_outline(cx, cy, 480, 200, UI_BORDER, 2)
        _arc.draw_text("CHOOSE UPGRADE BRANCH", cx, cy + 80, UI_TEXT, 14, anchor_x="center")

        for i, branch in enumerate(branches):
            bx = cx - 130 + i * 260
            by = cy - 10
            color = rgba((42, 178, 84), 200) if i == 0 else rgba((64, 215, 255), 200)
            _arc.draw_rectangle_filled(bx, by, card_w, card_h, rgba((20, 40, 20), 220))
            _arc.draw_rectangle_outline(bx, by, card_w, card_h, color, 2)
            _arc.draw_text(f"[{i + 1}] {branch['name']}", bx, by + 50, UI_TEXT_WHITE, 11, anchor_x="center")
            stats = branch.get("stats", {})
            stat_text = ", ".join(f"{k}: {v}" for k, v in list(stats.items())[:3])
            _arc.draw_text(stat_text, bx, by + 25, UI_TEXT, 8, anchor_x="center")
            if "damage_type" in branch:
                _arc.draw_text(f"Type: {branch['damage_type']}", bx, by + 5, UI_TEXT_GREEN, 9, anchor_x="center")

        _arc.draw_text("Press 1 or 2 to choose, Q/Esc to cancel", cx, cy - 90, UI_TEXT, 10, anchor_x="center")

    # ---- Card draft UI ----

    def _draw_card_draft(self):
        """Draw the card draft modal."""
        import arcade as _arc
        if self.card_state != "draft" or not self.draft_cards:
            return

        cx, cy = SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2
        card_w, card_h = 180, 220

        # Background
        _arc.draw_rectangle_filled(cx, cy, 600, 300, rgba((0, 0, 0, 180)))
        _arc.draw_rectangle_outline(cx, cy, 600, 300, UI_BORDER, 2)
        _arc.draw_text("CHOOSE A CARD", cx, cy + 130, UI_TEXT, 16, anchor_x="center")

        for i, card in enumerate(self.draft_cards):
            bx = cx - 220 + i * 220
            by = cy - 20
            rarity_colors = {
                "buff": (42, 178, 84),
                "unlock": (64, 215, 255),
                "hazard": (255, 146, 41),
            }
            rc = rarity_colors.get(card.get("type", "buff"), UI_TEXT)
            _arc.draw_rectangle_filled(bx, by, card_w, card_h, rgba((20, 40, 20), 220))
            _arc.draw_rectangle_outline(bx, by, card_w, card_h, rc, 2)
            _arc.draw_text(f"[{i + 1}] {card.get('name', 'Unknown')}", bx, by + 80, UI_TEXT_WHITE, 10, anchor_x="center")
            desc = card.get("desc", card.get("description", ""))
            _arc.draw_text(desc, bx, by + 50, UI_TEXT, 8, anchor_x="center")
            cat = card.get("type", "buff")
            _arc.draw_text(f"({cat.upper()})", bx, by + 30, rc, 8, anchor_x="center")

        _arc.draw_text("Press 1-3 to pick, 0 to skip (+50g)", cx, cy - 120, UI_TEXT, 10, anchor_x="center")

    def _start_card_draft(self):
        """Start a card draft session."""
        all_cards = load_cards()
        if not all_cards:
            return
        # Pick 3 random cards
        import random as _random
        self.draft_cards = _random.sample(all_cards, min(3, len(all_cards)))
        self.card_state = "draft"
        self.set_status("Choose a card! Press 1-3 to pick, 0 to skip (+50g)", 180)

    # ---- Input handling ----

    def on_key_press(self, key, modifiers):
        """Handle tower selection with number keys."""
        if self._key_matches(key, "R"):
            self.game_state = PLAYING
            self.setup()
            return

        if self._key_matches(key, "M"):
            self.difficulty_index = (self.difficulty_index + 1) % len(DIFFICULTIES)
            self.difficulty = list(DIFFICULTIES.keys())[self.difficulty_index]
            self.set_status(f"Difficulty: {DIFFICULTIES[self.difficulty]['name']}", 90)
            return

        if self.game_state != PLAYING:
            return

        if self._key_matches(key, "P", "ESCAPE"):
            self.paused = not self.paused
            self.set_status("Paused" if self.paused else "Resumed", 60)
            return

        if self._key_matches(key, "COMMA"):
            # 1x speed
            self.speed = "1x"
            self.speed_index = 0
            self.sim_ticks_per_frame = SPEEDS["1x"]
            self.set_status("Speed: 1x", 60)
        elif self._key_matches(key, "PERIOD"):
            # 2x speed
            self.speed = "2x"
            self.speed_index = 1
            self.sim_ticks_per_frame = SPEEDS["2x"]
            self.set_status("Speed: 2x", 60)
        elif self._key_matches(key, "SLASH"):
            # 3x speed
            self.speed = "3x"
            self.speed_index = 2
            self.sim_ticks_per_frame = SPEEDS["3x"]
            self.set_status("Speed: 3x", 60)

        if self._key_matches(key, "KEY_1", "NUM_1"):
            self.selected_tower = "basic"
            self.selected_grid = None
            self.tower_selection_timer = 30
            self.set_status("Selected Basic tower", 60)
        elif self._key_matches(key, "KEY_2", "NUM_2"):
            self.selected_tower = "sniper"
            self.selected_grid = None
            self.tower_selection_timer = 30
            self.set_status("Selected Sniper tower", 60)
        elif self._key_matches(key, "KEY_3", "NUM_3"):
            self.selected_tower = "rapid"
            self.selected_grid = None
            self.tower_selection_timer = 30
            self.set_status("Selected Rapid tower", 60)
        elif self._key_matches(key, "KEY_4", "NUM_4"):
            self.selected_tower = "splash"
            self.selected_grid = None
            self.tower_selection_timer = 30
            self.set_status("Selected Splash tower", 60)
        elif self._key_matches(key, "KEY_5", "NUM_5"):
            self.selected_tower = "frost"
            self.selected_grid = None
            self.tower_selection_timer = 30
            self.set_status("Selected Frost tower", 60)
        elif self._key_matches(key, "KEY_6", "NUM_6"):
            self.selected_tower = "poison"
            self.selected_grid = None
            self.tower_selection_timer = 30
            self.set_status("Selected Poison tower", 60)
        elif self._key_matches(key, "KEY_7", "NUM_7"):
            self.selected_tower = "detector"
            self.selected_grid = None
            self.tower_selection_timer = 30
            self.set_status("Selected Detector tower", 60)
        elif self._key_matches(key, "KEY_8", "NUM_8"):
            self.selected_tower = "damage_aura"
            self.selected_grid = None
            self.tower_selection_timer = 30
            self.set_status("Selected Damage Aura tower", 60)
        elif self._key_matches(key, "KEY_9", "NUM_9"):
            self.selected_tower = "speed_aura"
            self.selected_grid = None
            self.tower_selection_timer = 30
            self.set_status("Selected Speed Aura tower", 60)
        elif self._key_matches(key, "U"):
            self.upgrade_selected_tower()
        elif self._key_matches(key, "S"):
            self.sell_selected_tower()
        elif self._key_matches(key, "N", "SPACE"):
            self.send_next_wave_early()
        elif self._key_matches(key, "T"):
            # Cycle targeting mode on selected tower, or toggle sound if no tower selected
            if self.selected_grid:
                tower = self.get_tower_at_grid(*self.selected_grid)
                if tower:
                    modes = ["FIRST", "LAST", "CLOSEST", "STRONG", "WEAK"]
                    idx = modes.index(tower.targeting_mode)
                    tower.targeting_mode = modes[(idx + 1) % len(modes)]
                    self.set_status(f"Targeting: {tower.targeting_mode}", 90)
            else:
                self.sound_enabled = not self.sound_enabled
                self.set_status("Sound ON" if self.sound_enabled else "Sound OFF", 60)
        elif self._key_matches(key, "F5"):
            self.save_game()
        elif self._key_matches(key, "F9"):
            self.load_game()
        elif self._key_matches(key, "F10"):
            self.reduced_motion = not self.reduced_motion
            self.set_status(f"Reduced motion: {'ON' if self.reduced_motion else 'OFF'}", 90)

        # Card draft input
        if self.card_state == "draft":
            if self._key_matches(key, "KEY_1", "NUM_1"):
                self._select_card(0)
            elif self._key_matches(key, "KEY_2", "NUM_2"):
                self._select_card(1)
            elif self._key_matches(key, "KEY_3", "NUM_3"):
                self._select_card(2)
            elif self._key_matches(key, "KEY_0", "NUM_0"):
                self._skip_card()

        # Branch upgrade input
        if self.upgrade_state == "branch":
            if self.upgrade_branch_options and len(self.upgrade_branch_options.get("branches", [])) >= 2:
                if self._key_matches(key, "KEY_1", "NUM_1"):
                    self._apply_branch(0)
                elif self._key_matches(key, "KEY_2", "NUM_2"):
                    self._apply_branch(1)
                elif self._key_matches(key, "ESCAPE", "Q"):
                    self.upgrade_state = None
                    self.upgrade_pending_tower = None
                    self.upgrade_branch_options = None
                    self.set_status("Branch selection cancelled", 60)

    def on_mouse_motion(self, x, y, dx, dy):
        self.mouse_x = x
        self.mouse_y = y
        
        # DPS Tooltip: Show when hovering over a tower
        for tower in self.towers:
            if (tower.center_x - 32 <= x <= tower.center_x + 32 and
                tower.center_y - 32 <= y <= tower.center_y + 32):
                self.dps_tooltip = tower
                return
        self.dps_tooltip = None
        
        # Range Preview: Show range when hovering over valid build spot
        if self.game_state == PLAYING and not self.selected_grid and self.build_phase:
            grid_x, grid_y = self.get_grid(x, y)
            is_valid, _ = self.can_build_at(grid_x, grid_y)
            if is_valid:
                self.selected_grid = (grid_x, grid_y)
                self.selected_tower = self.selected_tower  # Ensure it's set
            elif self.selected_grid and not is_valid:
                self.selected_grid = None
        
        # Targeting Mode Toggle (T key handled in on_key_press)
        # (No action needed here — handled in key handler)

    def on_mouse_press(self, x, y, button, modifiers):
        self.mouse_x = x
        self.mouse_y = y
        if self.game_state == MENU:
            self.game_state = PLAYING
            self.setup()
            return

        if self.game_state == GAME_OVER or self.game_state == VICTORY:
            self.game_state = PLAYING
            self.setup()
            return

        if self.game_state != PLAYING or self.paused:
            return

        grid_x, grid_y = self.get_grid(x, y)
        tower = self.get_tower_at_grid(grid_x, grid_y)

        if button == arcade.MOUSE_BUTTON_RIGHT:
            self.selected_grid = (grid_x, grid_y) if tower else None
            self.sell_selected_tower()
            return

        if tower:
            self.selected_grid = (grid_x, grid_y)
            upgrade_cost = tower.upgrade_cost()
            upgrade_text = "max level" if upgrade_cost is None else f"upgrade {upgrade_cost}g"
            self.set_status(f"{tower.name} L{tower.level} selected ({upgrade_text})", 120)
            return

        # Move hero to clicked position (left-click on empty space)
        if self.hero and self.hero.alive and button == arcade.MOUSE_BUTTON_LEFT:
            self.hero.move_to(x, y)
            self.set_status(f"Hero moving to ({x:.0f}, {y:.0f})", 60)
            return

        valid, reason = self.can_build_at(grid_x, grid_y)
        if not valid:
            self.set_status(reason, 90)
            self.play_sound("error")
            return

        tower = Tower(grid_x, grid_y, self.selected_tower,
                      tower_data=self.tower_data.get(self.selected_tower, {}),
                      rng=self.rng)
        self.towers.append(tower)
        self.score -= tower.cost
        self.selected_grid = (grid_x, grid_y)
        self.set_status(f"Built {tower.name} tower", 90)
        self.play_sound("build")

    # ---- Update ----

    def update(self, delta_time):
        if self.game_state != PLAYING:
            return

        if self.status_timer > 0:
            self.status_timer -= 1

        if self.paused:
            return

        # Run sim ticks based on speed
        for _ in range(self.sim_ticks_per_frame):
            if self.build_phase:
                self.build_timer -= 1
                self.income_timer += 1
                if self.income_timer >= 120:
                    self.income_timer = 0
                    trickle = max(1, self.income // 10)
                    self.score += trickle
                if self.build_timer <= 0:
                    self.start_wave()
                break  # Only one sim tick per frame during build phase

            # Spawn enemies from corners (manifest-based or legacy)
            if self.enemies_to_spawn > 0 and hasattr(self, "wave_manifest_spawns"):
                # Manifest-based spawning: each spawn entry has its own timer and corner
                for spawn_entry in self.wave_manifest_spawns:
                    if spawn_entry["spawned"] >= spawn_entry["count"]:
                        continue
                    spawn_entry["timer"] += 1
                    start_ticks = int(spawn_entry["start_at"] * 15)  # Convert seconds to ticks
                    if spawn_entry["timer"] < start_ticks:
                        continue
                    interval_ticks = int(spawn_entry["interval"] * 15)
                    if spawn_entry["timer"] - start_ticks >= interval_ticks:
                        corner = spawn_entry["corner"]
                        path = self.paths[corner]
                        # Look up trait for this enemy type
                        enemy_trait = next(
                            (t for t in self.wave_traits if t["name"] == spawn_entry["enemy_type"]),
                            self.current_wave_trait
                        )
                        enemy = Enemy(path, wave=self.wave,
                                      trait=enemy_trait, rng=self.rng,
                                      corner_index=corner)
                        self.enemies.append(enemy)
                        self.enemies_to_spawn -= 1
                        spawn_entry["spawned"] += 1
                        spawn_entry["timer"] = start_ticks
            elif self.enemies_to_spawn > 0:
                # Legacy: single trait, round-robin corners
                self.spawn_timer += 1
                if self.spawn_timer >= 45:
                    corner = self.spawn_corners[self.spawn_corner_index % len(self.spawn_corners)]
                    path = self.paths[corner]
                    enemy = Enemy(path, wave=self.wave,
                                  trait=self.current_wave_trait, rng=self.rng,
                                  corner_index=corner)
                    self.enemies.append(enemy)
                    self.enemies_to_spawn -= 1
                    self.spawn_corner_index += 1
                    self.spawn_timer = 0

            # Check wave complete
            if self.enemies_to_spawn == 0 and len(self.enemies) == 0:
                if self.wave >= self.max_wave:
                    self.game_state = VICTORY
                    self.set_status("All waves cleared", 180)
                    self.play_sound("victory")
                    return
                self.score += 50 + self.wave * 20
                self.wave += 1
                # Celebration particles
                for _ in range(15):
                    ex = self.rng.uniform(0, SCREEN_WIDTH)
                    ey = self.rng.uniform(0, SCREEN_HEIGHT)
                    explosion = ExplosionEffect(ex, ey, 30, self.rng.choice(EXPLOSION_COLORS))
                    self.explosions.append(explosion)
                self.begin_build_phase()
                # Phase 6: Card draft every 3 waves
                if self.wave % 3 == 0 and not self.draft_cards:
                    self._start_card_draft()
                return

            # Update towers with aura modifiers
            aura_towers = get_active_aura_towers(self.towers)
            for tower in self.towers:
                aura_mods = compute_tower_modifiers(tower, self.towers)
                tower.update(self.enemies, self.bullets, self.explosions, self.paths,
                            aura_modifiers=aura_mods, all_towers=self.towers)

            # Update hero
            if self.hero and self.hero.alive:
                self.hero.update(self.enemies)
                # Apply card hero HP mult
                if self.card_effects:
                    self.hero.hp = max(self.hero.hp, int(self.hero.current_hp * self.card_effects.get_effective_hero_hp_mult()))

            # Update bullets
            for bullet in self.bullets:
                bullet.update()
            # Phase 5: Spawn damage numbers from bullet hits
            from core.armor import get_multiplier
            for bullet in self.bullets:
                if hasattr(bullet, "hit_info") and bullet.hit_info:
                    hi = bullet.hit_info
                    if isinstance(hi, list):
                        # Splash: multiple hits
                        for h in hi:
                            self._spawn_damage_number(h["x"], h["y"], h["damage"],
                                                     h["damage_type"], self.enemies)
                    else:
                        self._spawn_damage_number(hi["x"], hi["y"], hi["damage"],
                                                 hi["damage_type"], self.enemies)
                    bullet.hit_info = None  # Clear after processing
            self.bullets = [b for b in self.bullets if b.active]

            # Update enemies
            for enemy in self.enemies:
                enemy.update()

            # Remove dead enemies
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

                        # Phase 5: Death effects and damage numbers
                        enemy_type = self.current_wave_trait.get("name", "Normal").lower()
                        self.fx.add_death_effect(enemy.center_x, enemy.center_y, enemy_type)

                        # Hero XP for kills and assists
                        if self.hero and self.hero.alive:
                            hdist = math.sqrt(
                                (enemy.center_x - self.hero.center_x) ** 2 +
                                (enemy.center_y - self.hero.center_y) ** 2
                            )
                            if hdist < 150:
                                self.hero.add_xp(self.hero.xp_per_kill)
                                if self.card_effects:
                                    self.hero.add_xp(
                                        int(self.hero.xp_per_assist * self.card_effects.get_effective_hero_xp_mult())
                                    )
                            elif hdist < 300:
                                self.hero.add_xp(self.hero.xp_per_assist)

                        # Phase 5: Hit-stop on heavy hits
                        if enemy.is_boss:
                            self.fx.trigger_hit_stop(30)
                            self.fx.add_damage_number(enemy.center_x, enemy.center_y, 0, is_effective=True)
                        elif self.combo_count >= 5:
                            self.fx.trigger_hit_stop(4)

                        # Legacy explosion
                        explosion = ExplosionEffect(enemy.center_x, enemy.center_y, 20, ENEMY_COLOR)
                        self.explosions.append(explosion)

            self.enemies = [e for e in self.enemies if e.active]

            # Check enemies reaching end (on any path)
            for enemy in self.enemies:
                if enemy.current_point >= len(enemy.path_points):
                    leak_damage = 3 if enemy.is_boss else 2 if enemy.is_hero else 1
                    self.health -= leak_damage
                    self.leaks += 1
                    enemy.active = False
                    self.screen_shake = 10
                    self.set_status(f"Leak -{leak_damage} life", 70)
                    self.play_sound("leak")

            self.enemies = [e for e in self.enemies if e.active]

            # Update explosions
            for explosion in self.explosions:
                explosion.update()
            self.explosions = [e for e in self.explosions if e.active]

            # Phase 5: Hit-stop decay (no screen shake)
            self.fx.hit_stop.update()

            # Combo decay
            if self.combo_timer > 0:
                self.combo_timer -= 1
            else:
                self.combo_count = 0
                self.combo_gold_bonus = 0

            # Announcement timer
            if self.announcement_timer > 0:
                self.announcement_timer -= 1

            # Tower selection timer
            if self.tower_selection_timer > 0:
                self.tower_selection_timer -= 1

            # Check game over
            if self.health <= 0:
                self.game_state = GAME_OVER
                self.play_sound("game_over")
                return

    # ---- DPS helpers ----

    def _calc_dps(self, tower):
        """Calculate DPS and projected damage against each armor type."""
        from core.armor import get_matrix
        matrix = get_matrix()["matrix"]
        dt = tower.damage_type
        cooldown_sec = tower.cooldown / 60.0
        shots_per_sec = 1.0 / cooldown_sec if tower.cooldown > 0 else 999
        dps = {}
        for armor_type in get_matrix()["armor_types"]:
            mult = matrix.get(dt, {}).get(armor_type, 1.0)
            effective_dmg = tower.damage * max(1.0, mult)
            dps[armor_type] = round(effective_dmg * shots_per_sec, 1)
        return dps

    def _draw_dps_tooltip(self, x, y, dps, damage_type):
        """Draw DPS tooltip showing projected damage against each armor type."""
        import arcade as _arc
        y_pos = y
        _arc.draw_text(f"DMG TYPE: {damage_type.upper()}", x, y_pos + 10,
                      UI_TEXT_GREEN, 9, anchor_x="left")
        y_pos -= 10
        _arc.draw_text(f"{'Armor':<12}{'DPS':>8}", x, y_pos,
                      UI_TEXT, 8, anchor_x="left")
        y_pos -= 10
        for armor_type in ["light", "medium", "heavy", "fortified", "hero"]:
            val = dps.get(armor_type, 0)
            color = UI_TEXT_WHITE
            if val >= 100:
                color = UI_TEXT_GREEN
            elif val < 20:
                color = UI_TEXT_RED
            _arc.draw_text(f"{armor_type:<12}{val:>8.1f}", x, y_pos,
                          color, 8, anchor_x="left")
            y_pos -= 10

    # ---- Wave preview HUD ----

    def _draw_wave_preview(self):
        """Draw wave preview sidebar on the right side of the screen."""
        import arcade as _arc
        sidebar_x = SCREEN_WIDTH - 160
        sidebar_y = SCREEN_HEIGHT - 100
        sidebar_w = 150
        sidebar_h = 200

        # Background
        _arc.draw_rectangle_filled(sidebar_x + sidebar_w // 2,
                                  sidebar_y + sidebar_h // 2,
                                  sidebar_w, sidebar_h,
                                  rgba(PANEL_BG, 180))
        _arc.draw_rectangle_outline(sidebar_x + sidebar_w // 2,
                                   sidebar_y + sidebar_h // 2,
                                   sidebar_w, sidebar_h,
                                   UI_BORDER, 2)

        _arc.draw_text("NEXT WAVES", sidebar_x + sidebar_w // 2,
                      sidebar_y + sidebar_h - 15,
                      UI_TEXT, 10, anchor_x="center")

        # Show next 3 waves
        for i in range(3):
            wave_num = self.wave + i + 1
            if wave_num > self.max_wave:
                break
            trait = self.get_wave_trait(wave_num)
            wy = sidebar_y + sidebar_h - 35 - i * 55

            # Wave number
            _arc.draw_text(f"W{wave_num}", sidebar_x + 8, wy + 20,
                          UI_TEXT, 9, anchor_x="left")

            # Trait name and color
            _arc.draw_text(trait["name"], sidebar_x + 40, wy + 20,
                          trait["color"], 9, anchor_x="left")

            # Health bar (visual indicator of difficulty)
            bar_x = sidebar_x + 8
            bar_y = wy + 2
            bar_w = sidebar_w - 16
            bar_h = 6
            _arc.draw_rectangle_filled(bar_x + bar_w // 2, bar_y,
                                      bar_w, bar_h,
                                      rgba((40, 40, 40), 200))
            health_pct = min(1.0, trait["health_mult"])
            _arc.draw_rectangle_filled(bar_x + bar_w * health_pct // 2, bar_y,
                                      bar_w * health_pct, bar_h,
                                      trait["color"])

            # Enemy count indicator
            base_count = 4 + wave_num * 2 + trait["count_bonus"]
            count_text = f"{max(1, base_count)} enemies"
            _arc.draw_text(count_text, sidebar_x + 8, wy - 2,
                          UI_TEXT, 7, anchor_x="left")

            # Flags
            flags = trait.get("flags", [])
            if "boss" in flags:
                _arc.draw_text("BOSS", sidebar_x + sidebar_w - 8, wy + 20,
                              arcade.color.RED, 7, anchor_x="right")
            elif "hero" in flags:
                _arc.draw_text("HERO", sidebar_x + sidebar_w - 8, wy + 20,
                              arcade.color.ORANGE, 7, anchor_x="right")
            elif "invisible" in flags:
                _arc.draw_text("INVIS", sidebar_x + sidebar_w - 8, wy + 20,
                              (200, 150, 255), 7, anchor_x="right")
            elif "air" in flags:
                _arc.draw_text("AIR", sidebar_x + sidebar_w - 8, wy + 20,
                              (100, 180, 255), 7, anchor_x="right")
            elif "immune" in flags:
                _arc.draw_text("IMMUNE", sidebar_x + sidebar_w - 8, wy + 20,
                              (255, 235, 120), 7, anchor_x="right")

            # Armor matrix effectiveness indicators
            if "armor_types" in _armor_matrix:
                damage_types = _armor_matrix["damage_types"]
                armor_types = _armor_matrix["armor_types"]
                best_eff = get_best_damage_types(trait.get("armor_type", "medium"), top_n=2)
                worst_eff = get_worst_damage_types(trait.get("armor_type", "medium"), top_n=1)
                
                # Best effectiveness
                if best_eff:
                    best_dtype, best_mult = best_eff[0]
                    _arc.draw_text(f"{best_dtype.upper()}↑", sidebar_x + 8, wy - 18,
                                  UI_TEXT_GREEN, 7, anchor_x="left")
                    
                # Worst effectiveness
                if worst_eff:
                    worst_dtype, worst_mult = worst_eff[0]
                    _arc.draw_text(f"{worst_dtype.upper()}↓", sidebar_x + 60, wy - 18,
                                  UI_TEXT_RED, 7, anchor_x="left")

            # DPS projection
            if trait.get("armor_type"):
                # Estimate average DPS based on typical tower stats
                avg_dmg = 20 + (wave_num * 1.5)
                avg_rate = 1.0  # 1 shot per second
                avg_range = 120 + (wave_num * 5)
                
                # Apply armor multiplier
                armor_mult = get_multiplier("normal", trait["armor_type"])
                projected_dps = avg_dmg * avg_rate * armor_mult
                
                # Show as small text
                _arc.draw_text(f"{int(projected_dps)} DPS", sidebar_x + 8, wy - 30,
                              UI_TEXT_WHITE, 7, anchor_x="left")

    # ---- Rendering ----

    def on_draw(self):
        self.clear()

        # Update game logic
        self.update(1 / 60)

        # Phase 5: Apply hit-stop (skip sim frames during hit-stop, but keep rendering)
        # (hit-stop is handled in update loop)

        self.draw_background()

        # Draw path
        self.draw_path()

        # Draw game objects
        for tower in self.towers:
            tower.draw(selected=self.selected_grid == (tower.grid_x, tower.grid_y))
        for enemy in self.enemies:
            enemy.draw()
        if self.hero:
            self.hero.draw()
        for bullet in self.bullets:
            bullet.draw()
        for explosion in self.explosions:
            explosion.draw()

        # Phase 5: Draw death effects
        for de in self.fx.death_effects:
            self._draw_death_effect(de)

        # Phase 5: Draw damage numbers
        for dn in self.fx.damage_numbers:
            self._draw_damage_number(dn)

        self.draw_minimap()

        if self.game_state == PLAYING:
            self.draw_placement_preview()

        # Draw UI
        if self.game_state == PLAYING:
            self.draw_ui()

        # Draw wave announcement
        if self.announcement_timer > 0:
            self.draw_wave_announcement()

        # Draw wave preview sidebar
        if self.game_state == PLAYING:
            self._draw_wave_preview()

        # Draw state-specific overlays
        if self.game_state == MENU:
            self.draw_menu()
        elif self.game_state == PLAYING and self.paused:
            self.draw_pause_overlay()
        elif self.game_state == GAME_OVER:
            self.draw_game_over()
        elif self.game_state == VICTORY:
            self.draw_victory()

        # Draw branch picker and card draft overlays
        if self.game_state == PLAYING:
            self._draw_branch_picker()
            self._draw_card_draft()

    # ---- Drawing helpers ----

    # ---- Phase 5: FX drawing helpers ----

    def _spawn_damage_number(self, x, y, damage, damage_type, enemies):
        """Spawn a damage number with effectiveness coloring."""
        from core.armor import get_multiplier
        # Find the enemy at this position to determine effectiveness
        is_block = False
        is_effective = False
        for enemy in enemies:
            if not enemy.active:
                continue
            dist = math.sqrt((enemy.center_x - x) ** 2 + (enemy.center_y - y) ** 2)
            if dist < 30:
                mult = get_multiplier(damage_type, enemy.armor_type)
                if mult < 0.5:
                    is_block = True
                elif mult > 1.5:
                    is_effective = True
                break
        self.fx.add_damage_number(x, y, damage, is_crit=False,
                                 is_block=is_block, is_effective=is_effective)

    def _draw_damage_number(self, dn):
        """Draw a floating damage number."""
        import arcade as _arc
        alpha = dn.alpha
        if alpha <= 0:
            return
        color = (*dn.color, alpha)
        _arc.draw_text(
            dn.text, dn.x, dn.y,
            color, dn.size,
            anchor_x="center", bold=dn.is_crit
        )

    def _draw_death_effect(self, de):
        """Draw a type-specific death animation."""
        import arcade as _arc
        life_ratio = de.life / de.max_life if de.max_life > 0 else 0

        # Draw shockwave ring for boss
        if de.ring_max > 0:
            ring_alpha = int(200 * life_ratio)
            _arc.draw_circle_outline(
                de.x, de.y, de.ring_radius,
                (255, 200, 50, ring_alpha), 3
            )

        # Draw particles
        for p in de.particles:
            p_life_ratio = p["life"] / p["max_life"] if p["max_life"] > 0 else 0
            p_alpha = int(255 * p_life_ratio)
            size = p["size"] * p_life_ratio
            if p.get("angular"):
                # Angular fragments for armored
                _arc.draw_polygon_filled(
                    [
                        (p["x"], p["y"] + size),
                        (p["x"] - size, p["y"] - size),
                        (p["x"] + size, p["y"] - size),
                    ],
                    (*p["color"], p_alpha)
                )
            else:
                _arc.draw_circle_filled(
                    p["x"], p["y"], max(1, size),
                    (*p["color"], p_alpha)
                )

    # ---- Drawing helpers ----

    def draw_background(self):
        arcade.draw_rect_filled(LBWH(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT), BG_COLOR)
        for index, color in enumerate([(8, 59, 34), (6, 52, 32), (5, 45, 29)]):
            y = SCREEN_HEIGHT - 70 - index * 145
            arcade.draw_rectangle_filled(SCREEN_WIDTH // 2, y, SCREEN_WIDTH,
                                        150, rgba(color, 72 - index * 14))
        for y in range(0, SCREEN_HEIGHT + 1, TILE_SIZE):
            arcade.draw_line(0, y, SCREEN_WIDTH, y, GRID_LINE_COLOR, 1)
        for x in range(0, SCREEN_WIDTH + 1, TILE_SIZE):
            arcade.draw_line(x, 0, x, SCREEN_HEIGHT, GRID_LINE_COLOR, 1)

        arena_x = SCREEN_WIDTH // 2
        arena_y = SCREEN_HEIGHT // 2 - 10
        arcade.draw_circle_filled(arena_x, arena_y, 295, rgba((9, 18, 14), 70))
        arcade.draw_circle_filled(arena_x, arena_y, 262, rgba((22, 130, 62), 34))
        arcade.draw_circle_filled(arena_x, arena_y, 198, rgba((27, 151, 72), 26))
        arcade.draw_circle_outline(arena_x, arena_y, 260, rgba((96, 255, 126), 72), 4)
        arcade.draw_circle_outline(arena_x, arena_y, 235, rgba((96, 255, 126), 80), 3)
        arcade.draw_circle_outline(arena_x, arena_y, 180, rgba(UI_TEXT, 55), 2)
        arcade.draw_circle_outline(arena_x, arena_y, 118, rgba((96, 255, 126), 48), 2)
        for x, y, radius, angle in self.build_pads:
            arcade.draw_ellipse_filled(x, y, radius * 2.2, radius,
                                      rgba((46, 156, 76), 52), math.degrees(angle))
            arcade.draw_circle_outline(x, y, radius, rgba((116, 255, 136), 55), 1)
        # Highlight build pads during build phase
        if self.build_phase:
            for x, y, radius, angle in self.build_pads:
                is_occupied = any(
                    math.sqrt((t.center_x - x) ** 2 + (t.center_y - y) ** 2) < 20
                    for t in self.towers
                )
                if not is_occupied:
                    pulse = 30 + math.sin(self.wave * 0.5) * 10
                    arcade.draw_circle_outline(x, y, radius + 3,
                                              rgba((116, 255, 136), pulse), 1)
        arcade.draw_text("GREEN CIRCLE", arena_x, arena_y - 6,
                        rgba((96, 255, 126), 42), 24, anchor_x="center")

        for x, y, size, color, tilt in self.terrain_marks:
            arcade.draw_ellipse_filled(x, y, size * 2.4, size, rgba(color, 52), tilt)
            if size > 8:
                arcade.draw_circle_filled(x + size * 0.25, y + size * 0.1,
                                         size * 0.28, rgba(GRASS_LIGHT, 70))

        for i in range(9):
            x = 70 + i * 115
            y = 55 + (i % 4) * 150
            radius = 16 + (i % 3) * 7
            arcade.draw_circle_outline(x, y, radius, rgba(TOWER_ACCENT_COLOR, 42), 2)
            arcade.draw_arc_outline(x, y, radius * 1.7, radius * 1.7,
                                    rgba(UI_TEXT, 45), 30, 260, 1)

        self.draw_vignette()

    def draw_vignette(self):
        arcade.draw_lrbt_rectangle_filled(0, SCREEN_WIDTH, 0, 70,
                                         rgba(VIGNETTE_COLOR, 68))
        arcade.draw_lrbt_rectangle_filled(0, SCREEN_WIDTH, SCREEN_HEIGHT - 80,
                                         SCREEN_HEIGHT, rgba(VIGNETTE_COLOR, 62))
        arcade.draw_lrbt_rectangle_filled(0, 80, 0, SCREEN_HEIGHT,
                                         rgba(VIGNETTE_COLOR, 58))
        arcade.draw_lrbt_rectangle_filled(SCREEN_WIDTH - 90, SCREEN_WIDTH, 0,
                                         SCREEN_HEIGHT, rgba(VIGNETTE_COLOR, 58))

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
        # Draw all paths on minimap
        for path in self.paths:
            if path:
                mini_points = [(p[0] * scale_x + MINIMAP_X, p[1] * scale_y + MINIMAP_Y)
                              for p in path]
                if len(mini_points) >= 2:
                    arcade.draw_line_strip(point_list=mini_points, color=PATH_COLOR, line_width=2)
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

    def draw_path(self):
        # Draw all four corner paths
        corner_colors = [
            ((78, 255, 126), "SPAWN TL"),
            ((255, 126, 78), "SPAWN TR"),
            ((126, 78, 255), "SPAWN BL"),
            ((255, 255, 78), "SPAWN BR"),
        ]
        for path_idx, (path, (spawn_color, spawn_label)) in enumerate(zip(self.paths, corner_colors)):
            if len(path) >= 2:
                # Shadow
                arcade.draw_line_strip(point_list=path,
                                      color=PATH_SHADOW,
                                      line_width=PATH_BORDER_WIDTH + 24)
                # Border
                arcade.draw_line_strip(point_list=path,
                                      color=PATH_BORDER_COLOR,
                                      line_width=PATH_BORDER_WIDTH + 14)
                # Main path
                arcade.draw_line_strip(point_list=path,
                                      color=PATH_COLOR,
                                      line_width=PATH_BORDER_WIDTH + 2)
                # Inner path
                arcade.draw_line_strip(point_list=path,
                                      color=(92, 52, 28),
                                      line_width=PATH_BORDER_WIDTH - 7)
                # Highlight
                arcade.draw_line_strip(point_list=path,
                                      color=PATH_HIGHLIGHT,
                                      line_width=4)
                arcade.draw_line_strip(point_list=path,
                                      color=rgba((255, 219, 118), 95),
                                      line_width=1)

            # Spawn point marker
            if path:
                sx, sy = path[0]
                arcade.draw_circle_filled(sx, sy, 31, rgba(spawn_color, 55))
                arcade.draw_circle_outline(sx, sy, 30, rgba(spawn_color, 185), 3)
                arcade.draw_circle_outline(sx, sy, 20, rgba(arcade.color.WHITE, 100), 1)
                arcade.draw_text(spawn_label, sx, sy - 5, rgba(spawn_color, 230), 8,
                                anchor_x="center")

        # Center convergence point
        cx, cy = self.center_point
        arcade.draw_circle_filled(cx, cy, 35, rgba((255, 255, 255), 55))
        arcade.draw_circle_outline(cx, cy, 34, rgba((255, 255, 255), 185), 3)
        arcade.draw_text("CORE", cx, cy - 5, rgba((255, 200, 50), 230), 10,
                        anchor_x="center")

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

        # Build preview logic
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
                                  self.tower_data[self.selected_tower]["range"],
                                  arcade.color.LIGHT_GREEN if valid else arcade.color.RED,
                                  1)

    def draw_ui(self):
        # UI Panel background - dark green panel
        panel_y = SCREEN_HEIGHT - 100
        panel_width = 820
        panel_center_x = panel_width // 2 + 10
        arcade.draw_rectangle_filled(panel_center_x + 4, panel_y - 4,
                                    panel_width, 90, SHADOW_COLOR)
        arcade.draw_rectangle_filled(panel_center_x, panel_y,
                                    panel_width, 90, PANEL_BG)
        arcade.draw_rectangle_filled(panel_center_x, panel_y + 31,
                                    panel_width - 8, 20, PANEL_BG_LIGHT)
        arcade.draw_rectangle_outline(panel_width // 2 + 10, panel_y,
                                     panel_width, 90, UI_BORDER, 2)

        # Health
        arcade.draw_text(f"❤ Health: {self.health}", 20, panel_y + 55,
                        UI_TEXT_WHITE, 14)
        # Score (gold)
        arcade.draw_text(f"⚡ Gold: {self.score}", 20, panel_y + 30,
                        UI_TEXT, 14)
        # Wave
        arcade.draw_text(f"🌊 Wave: {self.wave}/{self.max_wave}", 20, panel_y + 5,
                        self.current_wave_trait["color"], 14)
        if self.build_phase:
            phase_text = f"Build {self.build_timer // 60 + 1}s"
            trait = self.next_wave_trait
        else:
            phase_text = self.current_wave_trait["name"]
            trait = self.current_wave_trait
        arcade.draw_text(phase_text, 158, panel_y + 5, trait["color"], 12)
        arcade.draw_text(f"Income {self.income}g  Leaks {self.leaks}",
                        245, panel_y + 5, UI_TEXT_WHITE, 10)

        # Tower selection buttons
        button_y = panel_y - 25
        for i, tower_type in enumerate(self.tower_order):
            data = self.tower_data[tower_type]
            x = 20 + i * 55
            name = data["name"]
            # Button background
            btn_color = data["color"] if self.selected_tower == tower_type else (40, 60, 40)
            arcade.draw_rectangle_filled(x + 26, button_y + 9, 54, 22, SHADOW_COLOR)
            arcade.draw_rectangle_filled(x + 25, button_y + 10, 50, 20,
                                        rgba(btn_color, 235))
            arcade.draw_rectangle_outline(x + 25, button_y + 10, 50, 20,
                                         UI_BORDER if self.selected_tower == tower_type
                                         else rgba(UI_BORDER, 120), 2)
            # Text
            arcade.draw_text(f"{i + 1}", x + 10, button_y + 5, UI_TEXT, 10)
            arcade.draw_text(f"{name}", x + 5, button_y - 5, UI_TEXT_WHITE, 7)

        help_text = "N next wave  P pause  U upgrade  S/right-click sell  F5 save  F9 load  R restart"
        arcade.draw_text(help_text, 430, panel_y + 50, UI_TEXT_WHITE, 11)
        selected = self.get_tower_at_grid(*self.selected_grid) if self.selected_grid else None
        if selected:
            upgrade_cost = selected.upgrade_cost()
            upgrade_text = "MAX" if upgrade_cost is None else f"Upgrade {upgrade_cost}g"
            stats = (
                f"{selected.name} L{selected.level}  "
                f"Dmg {selected.damage}  Rng {selected.range}  {upgrade_text}"
            )
            arcade.draw_text(stats, 430, panel_y + 28, UI_TEXT_GREEN, 11)
            arcade.draw_text(f"Sell value {selected.sell_value(self.wave)}g", 430, panel_y + 8,
                            UI_TEXT, 11)
            # DPS tooltip with armor projections
            dps = self._calc_dps(selected)
            self._draw_dps_tooltip(430, panel_y - 14, dps, selected.damage_type)
        else:
            selected_data = self.tower_data[self.selected_tower]
            preview = (
                f"Next: {self.next_wave_trait['name']}"
                if self.build_phase else
                f"Active: {self.current_wave_trait['name']}"
            )
            # Show projected DPS for selected tower type
            temp_tower = Tower(0, 0, self.selected_tower,
                              tower_data=self.tower_data.get(self.selected_tower, {}))
            dps = self._calc_dps(temp_tower)
            self._draw_dps_tooltip(430, panel_y + 28, dps, selected_data.get("damage_type", "normal"))
            arcade.draw_text(
                f"Build {selected_data['name']} - {selected_data['cost']}g   {preview}",
                430,
                panel_y + 8,
                self.next_wave_trait["color"] if self.build_phase else UI_TEXT_GREEN,
                11,
            )

        # Combo display
        if self.combo_count > 1:
            combo_alpha = min(255, self.combo_timer * 5)
            combo_text = f"COMBO x{self.combo_count}! +{self.combo_gold_bonus}g"
            arcade.draw_text(combo_text, SCREEN_WIDTH // 2, SCREEN_HEIGHT - 120,
                            rgba(UI_TEXT, int(combo_alpha)), 18, anchor_x="center")

        if self.status_timer > 0 and self.status_message:
            color = UI_TEXT_RED if "Cannot" in self.status_message or "Need" in self.status_message else UI_TEXT
            arcade.draw_text(self.status_message, 430, panel_y - 14, color, 11)

    def draw_wave_announcement(self):
        alpha = min(1.0, self.announcement_timer / 30)
        text_color = (UI_TEXT[0], UI_TEXT[1], UI_TEXT[2], int(255 * alpha))
        size = 40 + (120 - self.announcement_timer) * 0.15
        arcade.draw_text(self.wave_announcement, SCREEN_WIDTH // 2 + 3,
                        SCREEN_HEIGHT // 2 - 3,
                        rgba((0, 0, 0), int(170 * alpha)), size,
                        anchor_x="center")
        arcade.draw_text(self.wave_announcement, SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2,
                        text_color, size, anchor_x="center")

    def draw_menu(self):
        arcade.draw_rectangle_filled(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2,
                                    SCREEN_WIDTH, SCREEN_HEIGHT, (0, 0, 0, 45))
        # Title with Warcraft 3 style
        arcade.draw_text("GREEN CIRCLE TD", SCREEN_WIDTH // 2 + 4,
                        SCREEN_HEIGHT // 2 + 96,
                        (0, 0, 0, 90), 52, anchor_x="center")
        arcade.draw_text("GREEN CIRCLE TD", SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 100,
                        UI_TEXT, 52, anchor_x="center")
        # Subtitle
        arcade.draw_text("Warcraft 3 Style Tower Defense", SCREEN_WIDTH // 2 + 2,
                        SCREEN_HEIGHT // 2 + 48,
                        (0, 0, 0, 90), 24, anchor_x="center")
        arcade.draw_text("Warcraft 3 Style Tower Defense", SCREEN_WIDTH // 2,
                        SCREEN_HEIGHT // 2 + 50,
                        UI_TEXT_GREEN, 24, anchor_x="center")
        # Difficulty indicator
        diff = DIFFICULTIES[self.difficulty]
        arcade.draw_text(f"Difficulty: {diff['name']} (M to change)", SCREEN_WIDTH // 2,
                        SCREEN_HEIGHT // 2 - 15, UI_TEXT, 16, anchor_x="center")
        # Instructions
        arcade.draw_rectangle_filled(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 2,
                                    260, 44, PANEL_BG)
        arcade.draw_rectangle_outline(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 2,
                                     260, 44, UI_BORDER, 2)
        arcade.draw_text("Click to Start", SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2,
                        UI_TEXT_WHITE, 26, anchor_x="center")
        # Controls
        arcade.draw_text("1-7 Select | Click Build | U Upgrade | Right-click Sell",
                        SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 - 50,
                        UI_TEXT, 18, anchor_x="center")
        arcade.draw_text(f"Survive {self.max_wave} waves | N sends next wave early",
                        SCREEN_WIDTH // 2,
                        SCREEN_HEIGHT // 2 - 85,
                        UI_TEXT_WHITE, 16, anchor_x="center")

    def draw_pause_overlay(self):
        arcade.draw_rectangle_filled(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2,
                                    SCREEN_WIDTH, SCREEN_HEIGHT,
                                    (0, 0, 0, 120))
        arcade.draw_text("PAUSED", SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 35,
                        UI_TEXT, 46, anchor_x="center")
        arcade.draw_text("P to resume | R to restart", SCREEN_WIDTH // 2,
                        SCREEN_HEIGHT // 2 - 10,
                        UI_TEXT_WHITE, 20, anchor_x="center")

    def draw_game_over(self):
        arcade.draw_text("GAME OVER", SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 100,
                        arcade.color.RED, 56, anchor_x="center")
        arcade.draw_text(f"Final Score: {self.score}", SCREEN_WIDTH // 2,
                        SCREEN_HEIGHT // 2 + 40,
                        UI_TEXT_WHITE, 28, anchor_x="center")
        arcade.draw_text("Click or press R to Restart", SCREEN_WIDTH // 2,
                        SCREEN_HEIGHT // 2 - 20,
                        UI_TEXT, 24, anchor_x="center")

    def draw_victory(self):
        arcade.draw_text("VICTORY!", SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 100,
                        UI_TEXT_GREEN, 56, anchor_x="center")
        arcade.draw_text(f"Final Score: {self.score}", SCREEN_WIDTH // 2,
                        SCREEN_HEIGHT // 2 + 40,
                        UI_TEXT_WHITE, 28, anchor_x="center")
        arcade.draw_text("Click or press R to Play Again", SCREEN_WIDTH // 2,
                        SCREEN_HEIGHT // 2 - 20,
                        UI_TEXT, 24, anchor_x="center")
