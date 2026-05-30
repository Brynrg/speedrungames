"""Green Circle TD - Bullet classes."""
import math
from core.settings import (
    BULLET_COLOR, BULLET_GLOW, BULLET_TRAIL,
    SPLASH_COLOR, SPLASH_EXPLOSION,
)


class Bullet:
    """Bullet fired from a tower - glowing green circle."""

    def __init__(self, x, y, target, damage=25, speed=8, bullet_type="basic",
                 source_tower=None, damage_type="normal"):
        self.x = x
        self.y = y
        self.speed = speed
        self.damage = damage
        self.target = target
        self.bullet_type = bullet_type
        self.source_tower = source_tower
        self.damage_type = damage_type
        self.active = True
        self.trail = []

    def update(self):
        if not self.target or not self.target.active:
            self.active = False
            return

        dx = self.target.center_x - self.x
        dy = self.target.center_y - self.y
        distance = math.sqrt(dx * dx + dy * dy)

        # Add to trail
        self.trail.append((self.x, self.y))
        if len(self.trail) > 6:
            self.trail.pop(0)

        if distance < self.speed:
            self.active = False
            # Record hit info for sim to process (Phase 5: damage numbers)
            self.hit_info = {
                "x": self.target.center_x,
                "y": self.target.center_y,
                "damage": self.damage,
                "damage_type": self.damage_type,
                "is_crit": False,
                "is_block": False,
                "is_effective": False,
            }
            self.target.take_damage(self.damage, damage_type=self.damage_type)
            if self.source_tower and self.bullet_type == "frost":
                self.target.apply_slow(self.source_tower.slow,
                                       self.source_tower.slow_duration)
            elif self.source_tower and self.bullet_type == "poison":
                self.target.apply_poison(self.source_tower.poison_damage,
                                         self.source_tower.poison_duration)
        else:
            self.x += (dx / distance) * self.speed
            self.y += (dy / distance) * self.speed

    def draw(self):
        import arcade
        # Draw trail
        for i, (tx, ty) in enumerate(self.trail):
            alpha = i / len(self.trail)
            size = 5 * alpha
            arcade.draw_circle_filled(tx, ty, size, rgba(BULLET_TRAIL, int(180 * alpha)))

        if self.bullet_type == "frost":
            glow = (124, 220, 255)
            core = (226, 252, 255)
        elif self.bullet_type == "poison":
            glow = (132, 255, 70)
            core = (220, 255, 96)
        else:
            glow = BULLET_GLOW
            core = BULLET_COLOR
        # Draw bullet with glow
        arcade.draw_circle_filled(self.x, self.y, 9, rgba(glow, 90))
        arcade.draw_circle_filled(self.x, self.y, 6, glow)
        arcade.draw_circle_filled(self.x, self.y, 4, core)
        arcade.draw_circle_filled(self.x, self.y, 2, arcade.color.WHITE)


class SplashBullet:
    """Bullet that explodes on impact - green circle style."""

    def __init__(self, x, y, target, damage, splash_radius, enemies_list=None,
                 explosions_list=None, damage_type="siege"):
        self.x = x
        self.y = y
        self.speed = 6
        self.damage = damage
        self.splash_radius = splash_radius
        self.target = target
        self.exploded = False
        self.enemies_list = enemies_list
        self.explosions_list = explosions_list
        self.active = True
        self.trail = []
        self.damage_type = damage_type

    def update(self):
        if self.exploded:
            self.active = False
            return

        if not self.target or not self.target.active:
            # Target died before impact — explode at current position
            self.explode()
            return

        dx = self.target.center_x - self.x
        dy = self.target.center_y - self.y
        distance = math.sqrt(dx * dx + dy * dy)

        self.trail.append((self.x, self.y))
        if len(self.trail) > 8:
            self.trail.pop(0)

        if distance < self.speed:
            self.explode()
        else:
            self.x += (dx / distance) * self.speed
            self.y += (dy / distance) * self.speed

    def explode(self):
        self.exploded = True
        self.active = False

        # Create explosion effect
        from core.particle import ExplosionEffect
        explosion = ExplosionEffect(self.x, self.y, self.splash_radius, SPLASH_EXPLOSION)
        if self.explosions_list is not None:
            self.explosions_list.append(explosion)

        # Damage enemies in radius
        enemies = self.enemies_list if self.enemies_list else []
        self.hit_info = []  # Record all splash hits for sim
        for enemy in enemies:
            distance = math.sqrt(
                (enemy.center_x - self.x) ** 2 +
                (enemy.center_y - self.y) ** 2
            )
            if distance <= self.splash_radius:
                enemy.take_damage(self.damage, damage_type=self.damage_type)
                self.hit_info.append({
                    "x": enemy.center_x,
                    "y": enemy.center_y,
                    "damage": self.damage,
                    "damage_type": self.damage_type,
                })

    def draw(self):
        import arcade
        # Draw trail
        for i, (tx, ty) in enumerate(self.trail):
            alpha = i / len(self.trail)
            size = 7 * alpha
            arcade.draw_circle_filled(tx, ty, size, rgba(SPLASH_COLOR, int(160 * alpha)))

        # Draw bullet
        arcade.draw_circle_filled(self.x, self.y, 12, rgba(SPLASH_COLOR, 80))
        arcade.draw_circle_filled(self.x, self.y, 7, SPLASH_COLOR)
        arcade.draw_circle_filled(self.x, self.y, 5, arcade.color.WHITE)


def rgba(color, alpha):
    """Convert color to RGBA."""
    return (color[0], color[1], color[2], max(0, min(255, int(alpha))))
