"""Green Circle TD - Enemy class."""
import math
from core.settings import (
    ENEMY_COLOR, ENEMY_OUTLINE, ENEMY_EYE_COLOR,
    ENEMY_HEALTH_BAR_BG, ENEMY_HEALTH_BAR_FG,
    SHADOW_COLOR, UI_TEXT, rgba,
)


class Enemy:
    """Enemy that moves along a path - green circle style."""

    def __init__(self, path_points, scale=1.0, wave=1, trait=None, rng=None, corner_index=0):
        self.path_points = path_points
        self.corner_index = corner_index  # Which corner this enemy spawned from
        self.current_point = 0
        self.trait = trait or {"name": "Normal", "color": (138, 255, 148),
                               "count_bonus": 0, "health_mult": 1.0,
                               "speed_mult": 1.0, "bounty_bonus": 0, "flags": [],
                               "armor_type": "medium"}
        self.flags = set(self.trait.get("flags", []))
        self.is_air = "air" in self.flags
        self.is_immune = "immune" in self.flags
        self.is_invisible = "invisible" in self.flags
        self.is_boss = "boss" in self.flags
        self.is_hero = "hero" in self.flags
        self.armor_type = self.trait.get("armor_type", "medium")
        self.base_speed = 2.5 * (1 + wave * 0.08) * self.trait["speed_mult"]
        self.speed = self.base_speed
        self.health = 80 * (1 + wave * 0.25) * self.trait["health_mult"]
        self.max_health = self.health
        self.radius = 15 + min(5, wave // 4)
        if self.trait["name"] == "Boss":
            self.radius += 7
        self.x = path_points[0][0]
        self.y = path_points[0][1]
        self.center_x = self.x
        self.center_y = self.y
        self.angle = 0
        self.active = True
        self.hit_flash = 0
        self.rotation = 0
        self.glow_phase = (rng.uniform if rng else __import__('random').uniform)(0, 360)
        # Legacy slow/poison fields (kept for backward compat with tests)
        self.slow_timer = 0
        self.slow_factor = 1.0
        self.poison_timer = 0
        self.poison_damage = 0
        self.poison_tick = 0
        self.revealed_timer = 0
        # Phase 3d: Status manager
        from core.status import StatusManager
        self.status_manager = StatusManager()
        # Marked target (for detector_marker synergy)
        self._marked = False
        palette = [
            ((0, 210, 116), (206, 255, 20)),
            ((18, 188, 224), (168, 248, 255)),
            ((183, 100, 255), (255, 190, 255)),
            ((255, 146, 52), (255, 238, 98)),
        ]
        self.body_color, self.core_color = palette[(wave - 1) // 3 % len(palette)]

    def update(self):
        if self.slow_timer > 0:
            self.slow_timer -= 1
        else:
            self.slow_factor = 1.0
        self.speed = self.base_speed * self.slow_factor

        if self.poison_timer > 0:
            self.poison_timer -= 1
            self.poison_tick += 1
            if self.poison_tick >= 20:
                self.poison_tick = 0
                self.take_damage(self.poison_damage, flash=False)
        if self.revealed_timer > 0:
            self.revealed_timer -= 1

        # Phase 3d: Process status effects
        status_dmg = self.status_manager.update_all()
        if status_dmg > 0:
            self.take_damage(status_dmg, damage_type="magic", flash=False)

        # Apply slow from status manager
        if self.status_manager.is_slowed():
            self.slow_factor = min(self.slow_factor, self.status_manager.get_total_slow_factor())

        if self.current_point >= len(self.path_points):
            return

        target_x, target_y = self.path_points[self.current_point]
        dx = target_x - self.x
        dy = target_y - self.y
        distance = math.sqrt(dx * dx + dy * dy)

        if distance < self.speed:
            self.x = target_x
            self.y = target_y
            self.center_x = self.x
            self.center_y = self.y
            self.current_point += 1
        else:
            self.x += (dx / distance) * self.speed
            self.y += (dy / distance) * self.speed
            self.center_x = self.x
            self.center_y = self.y
            self.angle = math.degrees(math.atan2(dy, dx))
            self.rotation += 3  # Rotate enemy

        if self.hit_flash > 0:
            self.hit_flash -= 1

    def take_damage(self, amount, damage_type="normal", flash=True):
        """Take damage, modified by the armor matrix.
        
        Args:
            amount: Base damage before matrix multiplier.
            damage_type: One of "pierce", "siege", "magic", "normal".
            flash: Whether to show hit flash.
        """
        from core.armor import get_multiplier
        multiplier = get_multiplier(damage_type, self.armor_type)
        final_damage = amount * multiplier
        self.health -= final_damage
        if flash:
            self.hit_flash = 6
        if self.health <= 0:
            self.health = 0
            self.active = False

    def apply_slow(self, factor, duration):
        if self.is_immune:
            return
        if factor < self.slow_factor or self.slow_timer <= 0:
            self.slow_factor = factor
        self.slow_timer = max(self.slow_timer, duration)

    def apply_poison(self, damage, duration):
        if self.is_immune:
            return
        self.poison_damage = max(self.poison_damage, damage)
        self.poison_timer = max(self.poison_timer, duration)

    def reveal(self, duration=8):
        self.revealed_timer = max(self.revealed_timer, duration)

    def is_targetable_by(self, tower_type):
        if self.is_air and tower_type not in {"sniper", "frost", "detector"}:
            return False
        if self.is_invisible and self.revealed_timer <= 0 and tower_type != "detector":
            return False
        return True

    def draw(self):
        import arcade
        # Outer circle (body)
        body_color = self.body_color
        if self.is_invisible and self.revealed_timer <= 0:
            body_color = rgba(body_color, 95)
        if self.hit_flash > 0:
            body_color = arcade.color.RED
        elif self.poison_timer > 0:
            body_color = (118, 255, 74)
        elif self.slow_timer > 0:
            body_color = (120, 220, 255)
        pulse = 3 + math.sin(math.radians(self.glow_phase + self.rotation * 2)) * 1.5
        shadow_y = self.center_y - self.radius - (12 if self.is_air else 4)
        arcade.draw_ellipse_filled(self.center_x + 3, shadow_y,
                                  self.radius * 2.2, 9,
                                  rgba(SHADOW_COLOR, 45 if self.is_air else 90))
        if self.is_air:
            wing_y = self.center_y + 3
            arcade.draw_triangle_filled(
                self.center_x - self.radius, wing_y,
                self.center_x - self.radius - 14, wing_y + 10,
                self.center_x - self.radius - 8, wing_y - 7,
                rgba(body_color, 190),
            )
            arcade.draw_triangle_filled(
                self.center_x + self.radius, wing_y,
                self.center_x + self.radius + 14, wing_y + 10,
                self.center_x + self.radius + 8, wing_y - 7,
                rgba(body_color, 190),
            )
        arcade.draw_circle_filled(self.center_x, self.center_y,
                                 self.radius + pulse, rgba(body_color, 70))
        arcade.draw_circle_filled(self.center_x, self.center_y, self.radius, body_color)
        arcade.draw_circle_outline(self.center_x, self.center_y, self.radius,
                                  ENEMY_OUTLINE, 3)

        # Inner circle (detail)
        inner_radius = self.radius * 0.6
        arcade.draw_circle_filled(self.center_x, self.center_y, inner_radius,
                                 ENEMY_OUTLINE)
        arcade.draw_circle_outline(self.center_x, self.center_y, inner_radius + 3,
                                  rgba(self.core_color, 190), 2)

        # Rotating inner detail (Warcraft 3 style)
        arcade.draw_circle_filled(
            self.center_x + math.cos(math.radians(self.rotation)) * 5,
            self.center_y + math.sin(math.radians(self.rotation)) * 5,
            3, self.core_color
        )
        arcade.draw_circle_filled(
            self.center_x - math.cos(math.radians(self.rotation)) * 6,
            self.center_y - math.sin(math.radians(self.rotation)) * 6,
            2, rgba(arcade.color.WHITE, 180)
        )
        if self.slow_timer > 0:
            arcade.draw_circle_outline(self.center_x, self.center_y,
                                      self.radius + 6, rgba((160, 235, 255), 210), 2)
        if self.poison_timer > 0:
            arcade.draw_circle_outline(self.center_x, self.center_y,
                                      self.radius + 9, rgba((166, 255, 72), 185), 2)
        if self.is_immune:
            arcade.draw_circle_outline(self.center_x, self.center_y,
                                      self.radius + 12, rgba((255, 224, 80), 165), 2)
        if self.revealed_timer > 0 and self.is_invisible:
            arcade.draw_circle_outline(self.center_x, self.center_y,
                                      self.radius + 15, rgba((230, 190, 255), 220), 2)
        if self.is_hero or self.is_boss:
            arcade.draw_text("H" if self.is_hero else "B", self.center_x,
                            self.center_y - 4, rgba(UI_TEXT, 220), 11,
                            anchor_x="center")

        # Health bar
        bar_width = 28
        bar_height = 4
        bar_x = self.center_x - bar_width // 2
        bar_y = self.center_y + self.radius + 6
        health_ratio = max(0, self.health / self.max_health)

        # Background
        arcade.draw_rectangle_filled(self.center_x, bar_y, bar_width + 2, bar_height + 2,
                                    ENEMY_HEALTH_BAR_BG)
        # Health
        health_color = ENEMY_HEALTH_BAR_FG if health_ratio > 0.6 else \
                      arcade.color.ORANGE if health_ratio > 0.3 else arcade.color.RED
        arcade.draw_rectangle_filled(bar_x + bar_width * health_ratio // 2, bar_y,
                                    int(bar_width * health_ratio), bar_height, health_color)
