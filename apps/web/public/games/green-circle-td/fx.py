"""Green Circle TD - Visual effects (Phase 5, no screen shake).

Damage numbers, hit-stop, and type-specific death animations.
"""
import math
import random


class DamageNumber:
    """Floating damage number that arcs upward and fades."""

    def __init__(self, x, y, damage, is_crit=False, is_block=False, is_effective=False):
        self.x = x
        self.y = y
        self.damage = damage
        self.is_crit = is_crit
        self.is_block = is_block
        self.is_effective = is_effective
        self.life = 45  # frames
        self.max_life = 45
        self.vx = random.uniform(-1.5, 1.5)
        self.vy = -2.5
        self.active = True

    def update(self):
        """Update position and fade."""
        self.x += self.vx
        self.y += self.vy
        self.vy -= 0.03  # slight upward acceleration
        self.life -= 1
        if self.life <= 0:
            self.active = False

    @property
    def alpha(self):
        """Fade alpha based on remaining life."""
        return max(0, int(255 * (self.life / self.max_life)))

    @property
    def size(self):
        """Font size based on type."""
        if self.is_crit:
            return 16
        if self.is_block:
            return 10
        if self.is_effective:
            return 13
        return 11

    @property
    def text(self):
        """Text representation."""
        if self.is_block:
            return f"-{self.damage}"
        if self.is_crit:
            return f"CRIT {self.damage}!"
        return str(self.damage)

    @property
    def color(self):
        """Color based on effectiveness."""
        if self.is_crit:
            return (255, 255, 0)  # Yellow
        if self.is_block:
            return (180, 180, 180)  # Grey
        if self.is_effective:
            return (0, 255, 100)  # Green
        return (255, 255, 255)  # White


class DeathEffect:
    """Type-specific death animation."""

    def __init__(self, x, y, enemy_type="normal", rng=None):
        self.x = x
        self.y = y
        self.enemy_type = enemy_type
        self.particles = []
        self.ring_radius = 0
        self.ring_max = 0
        self.life = 0
        self.max_life = 0
        self.active = True
        self._rng = rng or random

        if enemy_type == "normal" or enemy_type == "swift":
            self._spawn_normal_death()
        elif enemy_type == "armored":
            self._spawn_armored_death()
        elif enemy_type == "air":
            self._spawn_air_death()
        elif enemy_type == "boss":
            self._spawn_boss_death()
        elif enemy_type == "invisible":
            self._spawn_invisible_death()
        else:
            self._spawn_normal_death()

    def _spawn_normal_death(self):
        """Small green particle burst."""
        for _ in range(12):
            angle = self._rng.uniform(0, 360)
            speed = self._rng.uniform(1, 4)
            self.particles.append({
                "x": self.x, "y": self.y,
                "vx": math.cos(math.radians(angle)) * speed,
                "vy": math.sin(math.radians(angle)) * speed,
                "life": 20 + self._rng.randint(0, 10),
                "max_life": 30,
                "size": 2 + self._rng.randint(0, 3),
                "color": (0, 200, 80),
            })
        self.max_life = 30
        self.life = 30

    def _spawn_armored_death(self):
        """Shatter into 6 angular fragments."""
        for i in range(6):
            angle = i * 60
            self.particles.append({
                "x": self.x, "y": self.y,
                "vx": math.cos(math.radians(angle)) * 5,
                "vy": math.sin(math.radians(angle)) * 5,
                "life": 25,
                "max_life": 25,
                "size": 6,
                "color": (150, 150, 170),
                "angular": True,
            })
        self.max_life = 25
        self.life = 25

    def _spawn_air_death(self):
        """Falling spiral + smoke trail."""
        for i in range(20):
            angle = i * 30
            radius = i * 0.5
            self.particles.append({
                "x": self.x + math.cos(math.radians(angle)) * radius,
                "y": self.y + math.sin(math.radians(angle)) * radius,
                "vx": 0,
                "vy": 1.5 + self._rng.uniform(0, 1),
                "life": 30 - i,
                "max_life": 30,
                "size": 3,
                "color": (180, 180, 200),
            })
        self.max_life = 30
        self.life = 30

    def _spawn_boss_death(self):
        """Shockwave ring + 30-particle burst."""
        self.ring_max = 80
        self.ring_radius = 0
        self.max_life = 40
        self.life = 40
        for _ in range(30):
            angle = self._rng.uniform(0, 360)
            speed = self._rng.uniform(2, 6)
            self.particles.append({
                "x": self.x, "y": self.y,
                "vx": math.cos(math.radians(angle)) * speed,
                "vy": math.sin(math.radians(angle)) * speed,
                "life": 35,
                "max_life": 35,
                "size": 3 + self._rng.randint(0, 4),
                "color": (255, 200, 50),
            })

    def _spawn_invisible_death(self):
        """Sudden full visibility then standard burst."""
        # Flash particles
        for _ in range(8):
            angle = self._rng.uniform(0, 360)
            self.particles.append({
                "x": self.x, "y": self.y,
                "vx": math.cos(math.radians(angle)) * 2,
                "vy": math.sin(math.radians(angle)) * 2,
                "life": 15,
                "max_life": 15,
                "size": 4,
                "color": (200, 180, 255),
            })
        # Then normal burst
        for _ in range(12):
            angle = self._rng.uniform(0, 360)
            speed = self._rng.uniform(1, 3)
            self.particles.append({
                "x": self.x, "y": self.y,
                "vx": math.cos(math.radians(angle)) * speed,
                "vy": math.sin(math.radians(angle)) * speed,
                "life": 25,
                "max_life": 25,
                "size": 2 + self._rng.randint(0, 2),
                "color": (0, 200, 80),
            })
        self.max_life = 25
        self.life = 25

    def update(self):
        """Update particles and ring."""
        self.life -= 1
        if self.life <= 0:
            self.active = False
            return

        # Update shockwave ring
        if self.ring_max > 0:
            self.ring_radius = self.ring_max * (1 - self.life / self.max_life)

        # Update particles
        for p in self.particles:
            p["x"] += p["vx"]
            p["y"] += p["vy"]
            p["vy"] += 0.05  # gravity
            p["life"] -= 1

        # Remove dead particles
        self.particles = [p for p in self.particles if p["life"] > 0]


class HitStop:
    """Manages hit-stop (freeze frames) for heavy hits."""

    def __init__(self):
        self.frames_remaining = 0
        self.active = False

    def trigger(self, frames):
        """Trigger hit-stop for given number of frames."""
        self.frames_remaining = max(self.frames_remaining, frames)
        self.active = True

    def update(self):
        """Update hit-stop counter."""
        if self.frames_remaining > 0:
            self.frames_remaining -= 1
            if self.frames_remaining <= 0:
                self.active = False

    @property
    def is_stopped(self):
        return self.active


class EffectManager:
    """Manages all visual effects: damage numbers, death FX, hit-stop."""

    def __init__(self, rng=None):
        self.damage_numbers = []
        self.death_effects = []
        self.hit_stop = HitStop()
        self._rng = rng or random
        # Throttle: track last damage number per enemy position
        self._last_damage_frame = {}  # (x, y) -> frame

    def add_damage_number(self, x, y, damage, is_crit=False, is_block=False, is_effective=False):
        """Add a floating damage number, with frame throttling."""
        key = (int(x), int(y))
        current_frame = getattr(self, "_current_frame", 0)
        if key in self._last_damage_frame:
            if current_frame - self._last_damage_frame[key] < 8:
                # Aggregate: update the existing number
                for dn in self.damage_numbers:
                    if (int(dn.x), int(dn.y)) == key and dn.active:
                        dn.damage += damage
                        if is_crit:
                            dn.is_crit = True
                        break
                return
        self._last_damage_frame[key] = current_frame
        self.damage_numbers.append(
            DamageNumber(x, y, damage, is_crit, is_block, is_effective)
        )

    def add_death_effect(self, x, y, enemy_type="normal"):
        """Add a type-specific death animation."""
        self.death_effects.append(DeathEffect(x, y, enemy_type, self._rng))

    def trigger_hit_stop(self, frames):
        """Trigger hit-stop."""
        self.hit_stop.trigger(frames)

    def update(self):
        """Update all effects."""
        self._current_frame = getattr(self, "_current_frame", 0) + 1

        self.hit_stop.update()

        for dn in self.damage_numbers:
            dn.update()
        self.damage_numbers = [dn for dn in self.damage_numbers if dn.active]

        for de in self.death_effects:
            de.update()
        self.death_effects = [de for de in self.death_effects if de.active]

    def clear(self):
        """Clear all effects."""
        self.damage_numbers.clear()
        self.death_effects.clear()
        self.hit_stop = HitStop()
