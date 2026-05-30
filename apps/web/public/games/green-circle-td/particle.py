"""Green Circle TD - Particle and explosion effects."""
import math
from core.settings import EXPLOSION_COLORS, rgba


class Particle:
    """Particle for visual effects - green/yellow sparks."""

    def __init__(self, x, y, color, size=3, speed=2, lifetime=30, rng=None):
        self.x = x
        self.y = y
        self.color = color
        self.size = size
        self.angle = (rng.uniform if rng else __import__('random').uniform)(0, 360)
        self.speed = speed * ((rng.uniform if rng else __import__('random').uniform)(0.5, 1.5))
        self.vx = math.cos(math.radians(self.angle)) * self.speed
        self.vy = math.sin(math.radians(self.angle)) * self.speed
        self.lifetime = lifetime
        self.max_lifetime = lifetime
        self.active = True

    def update(self):
        self.x += self.vx
        self.y += self.vy
        self.vy += 0.05  # gravity
        self.lifetime -= 1
        if self.lifetime <= 0:
            self.active = False

    def draw(self):
        alpha = self.lifetime / self.max_lifetime
        size = self.size * alpha
        import arcade
        arcade.draw_circle_filled(self.x, self.y, size, rgba(self.color, int(220 * alpha)))


class ExplosionEffect:
    """Explosion visual effect - green circle style."""

    def __init__(self, x, y, radius=40, color=None, rng=None):
        self.x = x
        self.y = y
        self.radius = radius
        self.max_radius = radius
        self.lifetime = 25
        self.active = True
        self.color = color or EXPLOSION_COLORS[0]
        self.particles = []
        use_rng = rng or __import__('random')

        # Create particles
        for _ in range(20):
            p = Particle(x, y, use_rng.choice(EXPLOSION_COLORS),
                        size=use_rng.uniform(2, 5),
                        speed=use_rng.uniform(1, 4),
                        lifetime=use_rng.randint(15, 30))
            self.particles.append(p)

        # Create ring particles
        for i in range(8):
            angle = math.radians(i * 45)
            p = Particle(
                x + math.cos(angle) * 5,
                y + math.sin(angle) * 5,
                use_rng.choice(EXPLOSION_COLORS),
                size=use_rng.uniform(1, 3),
                speed=use_rng.uniform(3, 6),
                lifetime=use_rng.randint(10, 20)
            )
            self.particles.append(p)

    def update(self):
        self.lifetime -= 1
        if self.lifetime <= 0:
            self.active = False
        for p in self.particles:
            p.update()

    def draw(self):
        import arcade
        # Draw expanding ring
        progress = 1 - (self.lifetime / 25)
        current_radius = self.max_radius * progress
        ring_color = rgba(self.color, max(0, int(210 * (1 - progress))))
        arcade.draw_circle_outline(self.x, self.y, current_radius,
                                  ring_color, 3)
        arcade.draw_circle_outline(self.x, self.y, current_radius * 0.55,
                                  rgba(arcade.color.WHITE, max(0, int(130 * (1 - progress)))),
                                  2)
        # Draw particles
        for p in self.particles:
            p.draw()
