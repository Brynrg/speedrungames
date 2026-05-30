"""Green Circle TD - Hero unit.

The Verdant Hero is a click-to-move combatant that body-blocks enemies,
attacks nearby foes, and levels up through kills/assists.
"""
import math


class Hero:
    """Hero unit that moves, attacks, and body-blocks enemies."""

    def __init__(self, x, y, hero_data=None, rng=None):
        self.x = x
        self.y = y
        self.center_x = x
        self.center_y = y
        self.target_x = x
        self.target_y = y
        self.hero_data = hero_data or {}
        self.name = self.hero_data.get("name", "Verdant Hero")
        self.hp_base = self.hero_data.get("hp_base", 200)
        self.hp_per_level = self.hero_data.get("hp_per_level", 40)
        self.damage_base = self.hero_data.get("damage_base", 18)
        self.damage_per_level = self.hero_data.get("damage_per_level", 4)
        self.attack_speed = self.hero_data.get("attack_speed", 30)
        self.move_speed = self.hero_data.get("move_speed", 3.0)
        self.block_radius = self.hero_data.get("block_radius", 24)
        self.xp_per_kill = self.hero_data.get("xp_per_kill", 10)
        self.xp_per_assist = self.hero_data.get("xp_per_assist", 3)
        self.xp_to_level = self.hero_data.get("xp_to_level", [50, 120, 220, 360])

        self.level = 1
        self.xp = 0
        self.max_hp = self.hp_base
        self.hp = self.max_hp
        self.damage = self.damage_base
        self.attack_timer = 0
        self.alive = True
        self.angle = 0
        self.rotation = 0
        self.pulse_phase = 0
        self.hit_flash = 0
        self._rng = rng

    @property
    def current_damage(self):
        """Damage scales with level: +15% per level."""
        return int(self.damage_base * (1 + (self.level - 1) * 0.15) +
                   self.damage_per_level * (self.level - 1))

    @property
    def current_hp(self):
        """HP scales with level: +20% per level."""
        return int(self.hp_base + self.hp_per_level * (self.level - 1))

    def move_to(self, x, y):
        """Set movement target."""
        self.target_x = x
        self.target_y = y

    def update(self, enemies, dt=1):
        """Update hero: move, attack, body-block.

        Args:
            enemies: List of Enemy objects.
            dt: Delta time (sim ticks).
        """
        if not self.alive:
            return

        self.rotation += 1
        self.pulse_phase += 2

        # Move toward target
        dx = self.target_x - self.x
        dy = self.target_y - self.y
        dist = math.sqrt(dx * dx + dy * dy)

        if dist > 2:
            self.x += (dx / dist) * self.move_speed * dt
            self.y += (dy / dist) * self.move_speed * dt
            self.center_x = self.x
            self.center_y = self.y
            self.angle = math.degrees(math.atan2(dy, dx))

        # Body-block: find ground enemies within block radius
        for enemy in enemies:
            if not enemy.active:
                continue
            if enemy.is_air or enemy.is_boss:
                continue
            edx = enemy.center_x - self.center_x
            edy = enemy.center_y - self.center_y
            edist = math.sqrt(edx * edx + edy * edy)
            if edist < self.block_radius + enemy.radius:
                # Push enemy away from hero
                push_x = (edx / edist) * (self.block_radius + enemy.radius - edist + 1)
                push_y = (edy / edist) * (self.block_radius + enemy.radius - edist + 1)
                enemy.x += push_x * dt
                enemy.y += push_y * dt
                enemy.center_x = enemy.x
                enemy.center_y = enemy.y

        # Attack cooldown
        if self.attack_timer > 0:
            self.attack_timer -= dt
            return

        # Find nearest enemy to attack
        nearest = None
        nearest_dist = 120  # Attack range
        for enemy in enemies:
            if not enemy.active:
                continue
            adx = enemy.center_x - self.center_x
            ady = enemy.center_y - self.center_y
            adist = math.sqrt(adx * adx + ady * ady)
            if adist < nearest_dist:
                nearest = enemy
                nearest_dist = adist

        if nearest:
            self.angle = math.degrees(math.atan2(
                nearest.center_y - self.center_y,
                nearest.center_x - self.center_x
            ))
            nearest.take_damage(self.current_damage, damage_type="normal", flash=True)
            self.attack_timer = self.attack_speed
            self.hit_flash = 6

    def take_damage(self, amount, flash=True):
        """Take damage."""
        self.hp -= amount
        if flash:
            self.hit_flash = 6
        if self.hp <= 0:
            self.hp = 0
            self.alive = False

    def add_xp(self, amount):
        """Add XP and check for level up."""
        self.xp += amount
        leveled = False
        while self.level <= len(self.xp_to_level):
            if self.xp >= self.xp_to_level[self.level - 1]:
                self.level += 1
                self.hp = self.current_hp  # Full heal on level up
                leveled = True
            else:
                break
        return leveled

    def respawn(self):
        """Respawn hero at center (called during build phase)."""
        self.alive = True
        self.hp = self.current_hp
        self.x = self.center_x
        self.y = self.center_y
        self.target_x = self.center_x
        self.target_y = self.center_y

    def draw(self):
        """Draw the hero unit."""
        import arcade

        if not self.alive:
            return

        # Shadow
        shadow_y = self.center_y - 24 - 4
        arcade.draw_ellipse_filled(
            self.center_x + 3, shadow_y,
            30, 9,
            (0, 0, 0, 90)
        )

        # Body color with flash
        body_color = (180, 80, 220)  # Purple
        if self.hit_flash > 0:
            body_color = arcade.color.RED

        # Outer glow
        pulse = 2 + math.sin(math.radians(self.pulse_phase)) * 1
        arcade.draw_circle_filled(
            self.center_x, self.center_y,
            18 + pulse,
            (180, 80, 220, 60)
        )

        # Main body
        arcade.draw_circle_filled(
            self.center_x, self.center_y,
            18, body_color
        )
        arcade.draw_circle_outline(
            self.center_x, self.center_y, 18,
            (220, 160, 255), 2
        )

        # Inner detail
        arcade.draw_circle_filled(
            self.center_x, self.center_y, 10,
            (140, 60, 180)
        )
        arcade.draw_circle_outline(
            self.center_x, self.center_y, 10,
            (200, 140, 240), 1
        )

        # Crown icon
        crown_y = self.center_y + 6
        arcade.draw_triangle_filled(
            self.center_x - 8, crown_y,
            self.center_x - 4, crown_y - 8,
            self.center_x, crown_y,
            (255, 215, 0)
        )
        arcade.draw_triangle_filled(
            self.center_x, crown_y,
            self.center_x + 4, crown_y - 8,
            self.center_x + 8, crown_y,
            (255, 215, 0)
        )
        arcade.draw_rectangle_filled(
            self.center_x, crown_y - 2,
            16, 3, (255, 215, 0)
        )

        # Level indicator
        import arcade as _arc
        _arc.draw_text(
            f"L{self.level}",
            self.center_x, self.center_y - 26,
            (255, 255, 255, 200), 8,
            anchor_x="center"
        )

        # HP bar
        hp_ratio = self.hp / self.current_hp
        bar_width = 30
        bar_height = 4
        bar_x = self.center_x - bar_width // 2
        bar_y = self.center_y + 22
        hp_color = (0, 200, 0) if hp_ratio > 0.6 else \
                   (255, 200, 0) if hp_ratio > 0.3 else (255, 50, 50)
        arcade.draw_rectangle_filled(
            self.center_x, bar_y,
            bar_width + 2, bar_height + 2,
            (0, 0, 0, 150)
        )
        arcade.draw_rectangle_filled(
            bar_x + bar_width * hp_ratio // 2, bar_y,
            int(bar_width * hp_ratio), bar_height,
            hp_color
        )

        # Attack range indicator when selected
        if self.hit_flash > 0:
            arcade.draw_circle_outline(
                self.center_x, self.center_y, 120,
                (255, 200, 255, 80), 1
            )
