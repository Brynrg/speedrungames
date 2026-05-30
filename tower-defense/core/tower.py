"""Green Circle TD - Tower class."""
import math
from core.settings import (
    TOWER_BASE_COLOR, TOWER_RING_COLOR, TOWER_ACCENT_COLOR,
    SELECTED_COLOR, UI_TEXT, rgba,
)


class Tower:
    """Tower with concentric rotating circles - Warcraft 3 style."""

    def __init__(self, grid_x, grid_y, tower_type="basic", tower_data=None, rng=None):
        self.grid_x = grid_x
        self.grid_y = grid_y
        self.center_x = grid_x * 64 + 32  # TILE_SIZE // 2
        self.center_y = grid_y * 64 + 32
        self.tower_type = tower_type
        self.angle = 0
        self.cooldown_timer = 0
        self.hit_flash = 0
        self.rotation = 0
        self.pulse_phase = (rng.uniform if rng else __import__('random').uniform)(0, 360)
        self.level = 1
        # Use provided data or fall back to TOWER_DATA from settings
        from core.settings import TOWER_DATA as _TD
        self.data = tower_data if tower_data is not None else _TD.get(tower_type, {})
        self.name = self.data.get("name", tower_type.capitalize())
        self.range = self.data.get("range", 200)
        self.damage = self.data.get("damage", 25)
        self.cooldown = self.data.get("cooldown", 30)
        self.cost = self.data.get("cost", 100)
        self.total_spent = self.cost
        self.color = self.data.get("color", TOWER_RING_COLOR)
        self.accent_color = self.data.get("accent", TOWER_ACCENT_COLOR)
        self.splash_radius = self.data.get("splash_radius", 0)
        self.slow = self.data.get("slow", 1.0)
        self.slow_duration = self.data.get("slow_duration", 0)
        self.poison_damage = self.data.get("poison_damage", 0)
        self.poison_duration = self.data.get("poison_duration", 0)
        self.detect = self.data.get("detect", False)
        self.damage_type = self.data.get("damage_type", "normal")
        self.targeting_mode = "CLOSEST"  # FIRST, LAST, CLOSEST, STRONG, WEAK
        self.aura = self.data.get("aura", None)  # Aura definition for aura towers
        self._damage_bonus = 0.0  # Applied damage bonus from auras
        self._cooldown_reduction = 0.0  # Applied cooldown reduction from auras
        # Branching upgrade (Phase 3c)
        self.branch_id = None  # e.g. "sniper_truesight"
        self.branch_name = None  # e.g. "Truesight Bolt"
        self._branch_stats = {}  # Applied branch stats
        # Synergy tracking (Phase 3b)
        self._synergies_triggered = set()  # Track discovered synergies
        # Status effect application (Phase 3d)
        self._burn_dot = 0
        self._burn_duration = 0
        self._crit_chance = 0.0
        self._crit_mult = 2.5
        self._projectiles_per_shot = 1
        self._poison_spread_on_death = False
        self._poison_dmg_mult = 1.0
        self._armor_shred = 0.0
        self._armor_shred_duration = 0
        self._true_sight = False
        self._marked_damage_bonus = 0.0
        self._chill_aura_radius = 0
        self._chill_value = 0.0
        self._freeze_chance = 0.0
        self._global_reveal = False
        self._reveal_radius = 0
        self._rng = rng

    def upgrade_cost(self):
        if self.level >= 4:
            return None
        return int(self.cost * (0.65 + self.level * 0.58))

    def sell_value(self, current_wave=None):
        """Sell value based on wave-dependent curve.
        
        If current_wave is None, uses legacy flat 60% for backward compatibility.
        """
        if current_wave is None:
            return max(1, int(self.total_spent * 0.6))
        if current_wave < 5:
            rate = 1.00
        elif current_wave < 15:
            rate = 0.75
        else:
            rate = 0.50
        return int(self.total_spent * rate)

    def upgrade(self):
        """Upgrade tower by one level. Returns cost or None if max level.

        At level 3, returns a dict with branch options instead of upgrading directly.
        Call apply_branch() separately to choose a branch.
        """
        cost = self.upgrade_cost()
        if cost is None:
            return None

        if self.level == 3:
            # Return branch options instead of upgrading
            return self._get_branch_options()

        self.level += 1
        self.total_spent += cost
        self.damage = int(self.damage * 1.4)
        self.range += 28
        self.cooldown = max(6, int(self.cooldown * 0.86))
        if self.splash_radius:
            self.splash_radius += 18
        if self.slow_duration:
            self.slow = max(0.35, self.slow - 0.08)
            self.slow_duration += 28
        if self.poison_duration:
            self.poison_damage += 2
            self.poison_duration += 35
        if self.detect:
            self.range += 36
        if self.level == 4:
            self.damage = int(self.damage * 1.25)
            self.range += 18
            self.cooldown = max(5, int(self.cooldown * 0.82))
        self.hit_flash = 18
        return cost

    def _get_branch_options(self):
        """Get L4 branch options for this tower type.

        Returns a dict with branch choices, or None if no branches defined.
        """
        from core.settings import UPGRADE_BRANCHES
        branches = UPGRADE_BRANCHES.get(self.tower_type, {}).get("L4_branches", [])
        if not branches:
            return None
        return {
            "type": "branch",
            "branches": branches,
        }

    def apply_branch(self, branch_id):
        """Apply a branching upgrade at L4.

        Args:
            branch_id: The branch ID string (e.g. "sniper_truesight")

        Returns:
            True if branch was applied, False if already has a branch.
        """
        if self.branch_id is not None:
            return False

        from core.settings import UPGRADE_BRANCHES
        branches = UPGRADE_BRANCHES.get(self.tower_type, {}).get("L4_branches", [])
        branch = None
        for b in branches:
            if b["id"] == branch_id:
                branch = b
                break
        if branch is None:
            return False

        self.branch_id = branch["id"]
        self.branch_name = branch["name"]
        self._branch_stats = branch.get("stats", {})
        self.level = 4

        # Apply branch-level fields (damage_type may be outside stats)
        if "damage_type" in branch:
            self.damage_type = branch["damage_type"]

        # Apply branch stats
        stats = self._branch_stats
        if "damage_mult" in stats:
            self.damage = int(self.damage * stats["damage_mult"])
        if "range_delta" in stats:
            self.range += stats["range_delta"]
        if "cooldown_mult" in stats:
            self.cooldown = max(5, int(self.cooldown * stats["cooldown_mult"]))
        if "damage_type" in stats:
            self.damage_type = stats["damage_type"]
        if "true_sight" in stats:
            self._true_sight = True
        if "splash_radius_delta" in stats:
            self.splash_radius += stats["splash_radius_delta"]
        if "crit_chance" in stats:
            self._crit_chance = stats["crit_chance"]
        if "crit_mult" in stats:
            self._crit_mult = stats["crit_mult"]
        if "burn_dot" in stats:
            self._burn_dot = stats["burn_dot"]
        if "burn_duration" in stats:
            self._burn_duration = stats["burn_duration"]
        if "slow_factor" in stats:
            self.slow = stats["slow_factor"]
        if "freeze_chance" in stats:
            self._freeze_chance = stats["freeze_chance"]
        if "chill_aura_radius" in stats:
            self._chill_aura_radius = stats["chill_aura_radius"]
        if "chill_value" in stats:
            self._chill_value = stats["chill_value"]
        if "poison_spread_on_death" in stats:
            self._poison_spread_on_death = True
        if "poison_dmg_mult" in stats:
            self._poison_dmg_mult = stats["poison_dmg_mult"]
        if "armor_shred" in stats:
            self._armor_shred = stats["armor_shred"]
        if "armor_shred_duration" in stats:
            self._armor_shred_duration = stats["armor_shred_duration"]
        if "projectiles_per_shot" in stats:
            self._projectiles_per_shot = stats["projectiles_per_shot"]
        if "global_reveal" in stats:
            self._global_reveal = True
        if "reveal_radius" in stats:
            self._reveal_radius = stats["reveal_radius"]
        if "marked_damage_bonus" in stats:
            self._marked_damage_bonus = stats["marked_damage_bonus"]

        self.hit_flash = 18
        return True

    def get_branch_info(self):
        """Get current branch info for display."""
        if self.branch_id:
            info = {
                "id": self.branch_id,
                "name": self.branch_name,
                "stats": dict(self._branch_stats),
            }
            # Include branch-level fields that aren't in stats
            if self.damage_type != "normal":
                info["damage_type"] = self.damage_type
            return info
        return None

    def on_hit(self, enemy, damage, bullets=None, explosions=None):
        """Called after a hit to apply synergies and status effects.

        Args:
            enemy: The enemy that was hit.
            damage: The damage dealt.
            bullets: List of bullets (for splash).
            def on_hit(self, enemy, damage, bullets=None, explosions=None):
                """Called after a hit to apply synergies and status effects.

                Args:
                    damage: The damage dealt (raw, pre-armor).

                Returns:
                    List of synergy strings triggered (e.g. ["frosted_pierce_bonus"]).
                def on_hit(self, enemy, damage, bullets=None, explosions=None):
                    """Called after a hit to apply synergies and status effects.

                    Args:
                        damage: The damage dealt (raw, pre-armor).

                    Returns:
                        List of synergy strings triggered (e.g. ["frosted_pierce_bonus"]).
                    """
                    triggered = []

                    # Apply armor matrix multiplier
                    from core.armor import get_multiplier
                    armor_mult = get_multiplier(self.damage_type, enemy.armor_type)
                    damage = int(damage * armor_mult)

                    # --- Synergy: Frosted + Pierce bonus ---
                    # Sniper/Rapid hits a slowed enemy → +25% damage
                    if enemy.status_manager.is_slowed() and self.tower_type in ("sniper", "rapid"):
                        triggered.append("frosted_pierce_bonus")

                    # --- Synergy: Frost shatter ---
                    # Magic-type tower kills a slowed enemy with overkill > 1.5x HP
                    if self.damage_type == "magic" and enemy.health <= 0 and enemy.status_manager.is_slowed():
                        overkill = damage - enemy.max_health * 0.5
                        if overkill > enemy.max_health * 1.5:
                            triggered.append("frost_shatter")

                    # --- Synergy: Poison spread ---
                    # Splash kills a poisoned enemy → poison transfers to all in splash radius
                    if self.tower_type == "splash" and enemy.health <= 0 and enemy.status_manager.is_poisoned():
                        if self._poison_spread_on_death:
                            triggered.append("poison_spread")

                    # --- Synergy: Detector crit ---
                    # Tower fires from inside any Detector range → +10% crit
                    # (checked in update, not here)

                    # Apply status effects from branch upgrades
                    if self._burn_dot > 0 and enemy.active:
                        enemy.status_manager.add_burn(self._burn_dot, self._burn_duration)

                    if self._armor_shred > 0 and enemy.active:
                        enemy.status_manager.add_armor_shred(
                            self._armor_shred, self._armor_shred_duration
                        )

                    # Track triggered synergies
                    for s in triggered:
                        self._synergies_triggered.add(s)

                    return triggered

    def get_synergies_triggered(self):
        """Return set of synergy names that have been triggered this run."""
        return set(self._synergies_triggered)

    def find_target(self, enemies, path_points=None):
        """Find target based on targeting mode."""
        in_range = []
        for enemy in enemies:
            if not enemy.is_targetable_by(self.tower_type):
                continue
            distance = math.sqrt(
                (enemy.center_x - self.center_x) ** 2 +
                (enemy.center_y - self.center_y) ** 2
            )
            if distance <= self.range:
                in_range.append((enemy, distance))

        if not in_range:
            return None

        mode = self.targeting_mode
        if mode == "FIRST" and path_points:
            # Closest to end of path
            in_range.sort(key=lambda x: x[0].current_point, reverse=True)
        elif mode == "LAST":
            # Furthest from end (smallest current_point)
            in_range.sort(key=lambda x: x[0].current_point)
        elif mode == "CLOSEST":
            in_range.sort(key=lambda x: x[1])
        elif mode == "STRONG":
            in_range.sort(key=lambda x: x[0].health, reverse=True)
        elif mode == "WEAK":
            in_range.sort(key=lambda x: x[0].health)

        return in_range[0][0]

    def update(self, enemies, bullets, explosions=None, path_points=None, aura_modifiers=None, all_towers=None):
        if self.cooldown_timer > 0:
            self.cooldown_timer -= 1
            return

        # Apply aura modifiers
        effective_cooldown = self.cooldown
        if aura_modifiers and self.aura is None:  # Only apply to non-aura towers
            effective_cooldown = max(5, int(self.cooldown * (1 - aura_modifiers.get("cooldown_reduction", 0))))
            effective_damage = int(self.damage * (1 + aura_modifiers.get("damage_bonus", 0)))
        else:
            effective_cooldown = self.cooldown
            effective_damage = self.damage

        # Detector synergy: +10% crit if firing from inside any Detector range
        if all_towers:
            for other in all_towers:
                if other.tower_type == "detector" and other.branch_id == "detector_pulse":
                    dx = self.center_x - other.center_x
                    dy = self.center_y - other.center_y
                    if math.sqrt(dx*dx + dy*dy) <= other._reveal_radius:
                        self._crit_chance = max(self._crit_chance, 0.10)
                        break

        # Find target based on mode
        target = self.find_target(enemies, path_points)

        if target:
            self.angle = math.degrees(math.atan2(
                target.center_y - self.center_y,
                target.center_x - self.center_x
            ))

            if self.detect:
                target.reveal(30 + self.level * 15)

            # Apply crit check
            is_crit = False
            if self._rng and self._rng.random() < self._crit_chance:
                is_crit = True
                effective_damage = int(effective_damage * self._crit_mult)

            # Apply marked damage bonus
            if target._marked and self._marked_damage_bonus > 0:
                effective_damage = int(effective_damage * (1 + self._marked_damage_bonus))

            # Apply frosted+pierce synergy: +25% damage to slowed enemies
            if target.status_manager.is_slowed() and self.tower_type in ("sniper", "rapid"):
                effective_damage = int(effective_damage * 1.25)

            # Apply poison damage multiplier from branch
            if self._poison_dmg_mult > 1.0 and self.poison_damage > 0:
                self.poison_damage = int(self.data.get("poison_damage", 0) * self._poison_dmg_mult)

            # Multi-projectile (Volley branch)
            count = self._projectiles_per_shot
            for i in range(count):
                if self.tower_type == "splash":
                    bullet = SplashBullet(self.center_x, self.center_y, target,
                                         effective_damage, self.splash_radius, enemies,
                                         explosions, damage_type=self.damage_type)
                else:
                    speed = 15 if self.tower_type == "sniper" else 10
                    # Slight spread for volley
                    spread = (i - (count - 1) / 2) * 5 if count > 1 else 0
                    bullet = Bullet(self.center_x, self.center_y, target,
                                  effective_damage, speed, self.tower_type, self,
                                  damage_type=self.damage_type, spread=spread)
                bullets.append(bullet)

            self.cooldown_timer = effective_cooldown
            self.hit_flash = 6

    def draw(self, selected=False):
        import arcade
        self.rotation += 1
        self.pulse_phase += 2

        arcade.draw_ellipse_filled(self.center_x + 4, self.center_y - 24, 50, 15,
                                  (0, 0, 0, 90))
        arcade.draw_circle_filled(self.center_x, self.center_y, 27,
                                 rgba(self.color, 60))
        arcade.draw_circle_filled(self.center_x, self.center_y, 24,
                                 TOWER_BASE_COLOR)
        arcade.draw_circle_outline(self.center_x, self.center_y, 26,
                                  rgba(self.accent_color, 185), 2)
        arcade.draw_circle_filled(self.center_x, self.center_y, 20, self.color)
        arcade.draw_circle_filled(self.center_x - 5, self.center_y + 6, 8,
                                 rgba(arcade.color.WHITE, 45))

        if self.tower_type == "sniper":
            arcade.draw_circle_outline(self.center_x, self.center_y, 15,
                                      self.accent_color, 2)
            arc_start = self.rotation % 360
            arcade.draw_arc_outline(self.center_x, self.center_y, 34, 34,
                                    rgba(self.accent_color, 185),
                                    arc_start,
                                    arc_start + 105,
                                    3)
        elif self.tower_type == "rapid":
            for spoke in range(3):
                spoke_angle = math.radians(self.rotation * 2 + spoke * 120)
                arcade.draw_circle_filled(
                    self.center_x + math.cos(spoke_angle) * 11,
                    self.center_y + math.sin(spoke_angle) * 11,
                    5,
                    self.accent_color,
                )
        elif self.tower_type == "splash":
            points = []
            for i in range(6):
                angle = math.radians(self.rotation + i * 60)
                radius = 16 if i % 2 == 0 else 9
                points.append((
                    self.center_x + math.cos(angle) * radius,
                    self.center_y + math.sin(angle) * radius,
                ))
            arcade.draw_polygon_filled(points, rgba(self.accent_color, 210))
            arcade.draw_polygon_outline(points, TOWER_BASE_COLOR, 2)
        elif self.tower_type == "frost":
            arcade.draw_arc_outline(self.center_x, self.center_y, 38, 38,
                                    rgba(self.accent_color, 220),
                                    20 + self.rotation, 145 + self.rotation, 3)
            arcade.draw_arc_outline(self.center_x, self.center_y, 27, 27,
                                    rgba(self.accent_color, 180),
                                    205 - self.rotation, 330 - self.rotation, 2)
        elif self.tower_type == "poison":
            for bubble in range(4):
                angle = math.radians(self.rotation + bubble * 90)
                arcade.draw_circle_filled(
                    self.center_x + math.cos(angle) * 12,
                    self.center_y + math.sin(angle) * 12,
                    3 + bubble % 2,
                    rgba(self.accent_color, 210),
                )
        elif self.tower_type == "detector":
            arcade.draw_circle_outline(self.center_x, self.center_y, 15,
                                      self.accent_color, 2)
            arcade.draw_arc_outline(self.center_x, self.center_y, 42, 42,
                                    rgba(self.accent_color, 210),
                                    self.rotation * 2, self.rotation * 2 + 70, 3)
            arcade.draw_arc_outline(self.center_x, self.center_y, 30, 30,
                                    rgba((248, 214, 65), 160),
                                    -self.rotation * 2, -self.rotation * 2 + 105, 2)
        else:
            arcade.draw_circle_outline(self.center_x, self.center_y, 14,
                                      self.accent_color, 2)

        # Rotating cross/detail
        cross_angle = math.radians(self.rotation)
        cross_len = 10
        arcade.draw_line(
            self.center_x + math.cos(cross_angle) * cross_len,
            self.center_y + math.sin(cross_angle) * cross_len,
            self.center_x - math.cos(cross_angle) * cross_len,
            self.center_y - math.sin(cross_angle) * cross_len,
            rgba(TOWER_ACCENT_COLOR, 185), 2
        )

        # Center dot
        pulse_size = 4 + math.sin(math.radians(self.pulse_phase)) * 1
        arcade.draw_circle_filled(self.center_x, self.center_y, pulse_size,
                                 self.accent_color)

        # Barrel (points at target)
        barrel_length = 28
        barrel_angle = math.radians(self.angle)
        end_x = self.center_x + math.cos(barrel_angle) * barrel_length
        end_y = self.center_y + math.sin(barrel_angle) * barrel_length
        arcade.draw_line(self.center_x, self.center_y, end_x, end_y,
                        TOWER_BASE_COLOR, 5)
        arcade.draw_line(self.center_x, self.center_y, end_x, end_y,
                        self.color, 3)
        arcade.draw_circle_filled(end_x, end_y, 4, self.accent_color)

        # Range indicator (faint)
        if selected:
            arcade.draw_circle_outline(self.center_x, self.center_y, self.range,
                                      SELECTED_COLOR, 2)
            arcade.draw_rectangle_outline(self.center_x, self.center_y,
                                         58, 58,
                                         SELECTED_COLOR, 2)
        elif self.hit_flash > 0:
            arcade.draw_circle_outline(self.center_x, self.center_y, self.range,
                                      self.accent_color, 2)
            self.hit_flash -= 1

        for i in range(self.level):
            arcade.draw_circle_filled(
                self.center_x - 13 + i * 9,
                self.center_y - 27,
                3,
                SELECTED_COLOR if self.level < 4 else rgba(arcade.color.WHITE, 230),
            )

        # Targeting mode indicator (small text above level dots)
        import arcade as _arc
        mode_text = self.targeting_mode[:3]  # e.g. "FIR", "LAS"
        _arc.draw_text(mode_text, self.center_x, self.center_y - 34,
                      rgba(UI_TEXT, 140), 7, anchor_x="center")

        # Aura tower rendering: draw aura ring
        if self.aura:
            import arcade as _arc
            aura_radius = self.aura["radius"]
            aura_type = self.aura["type"]
            if aura_type == "damage_bonus":
                aura_color = rgba((255, 80, 80), 40 + math.sin(self.rotation * 0.05) * 15)
            else:  # cooldown_reduction
                aura_color = rgba((255, 255, 80), 40 + math.sin(self.rotation * 0.05) * 15)
            _arc.draw_circle_outline(self.center_x, self.center_y, aura_radius,
                                    aura_color, 2)
            # Fill aura zone faintly
            _arc.draw_circle_filled(self.center_x, self.center_y, aura_radius,
                                   rgba(aura_color[:3] if isinstance(aura_color, tuple) else (200, 200, 200), 15))
