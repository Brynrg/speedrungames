"""
Tower Defense Game - Warcraft 3 Green Circle TD Style
A tower defense game with Warcraft 3-inspired green circle aesthetics,
concentric rotating towers, and polished geometric visuals.
"""

import arcade
import math
import random
import array

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

if not hasattr(arcade, "draw_rectangle_filled"):
    def _draw_rectangle_filled(center_x, center_y, width, height, color, tilt_angle=0):
        arcade.draw_rect_filled(
            arcade.XYWH(center_x, center_y, width, height),
            color,
            tilt_angle,
        )

    arcade.draw_rectangle_filled = _draw_rectangle_filled

if not hasattr(arcade, "draw_rectangle_outline"):
    def _draw_rectangle_outline(center_x, center_y, width, height, color,
                                border_width=1, tilt_angle=0):
        arcade.draw_rect_outline(
            arcade.XYWH(center_x, center_y, width, height),
            color,
            border_width,
            tilt_angle,
        )

    arcade.draw_rectangle_outline = _draw_rectangle_outline

# Constants
SCREEN_WIDTH = 960
SCREEN_HEIGHT = 720
SCREEN_TITLE = "Green Circle TD"

# Game constants
TILE_SIZE = 64
GRID_WIDTH = SCREEN_WIDTH // TILE_SIZE
GRID_HEIGHT = SCREEN_HEIGHT // TILE_SIZE

# Warcraft 3 Green Circle TD Color Palette
BG_COLOR = (6, 44, 28)
GRASS_COLOR = (17, 92, 48)
GRASS_LIGHT = (50, 154, 78)
GRASS_DARK = (3, 31, 23)
GRID_LINE_COLOR = (72, 170, 94, 34)
VIGNETTE_COLOR = (0, 13, 10)
PATH_COLOR = (118, 76, 42)
PATH_HIGHLIGHT = (170, 114, 58)
PATH_SHADOW = (50, 28, 20)
PATH_BORDER_COLOR = (8, 56, 34)
PATH_BORDER_WIDTH = 24

# Tower colors - Warcraft 3 style
TOWER_BASE_COLOR = (8, 36, 28)
TOWER_RING_COLOR = (42, 178, 84)
TOWER_ACCENT_COLOR = (166, 255, 144)

# Enemy colors - green circles
ENEMY_COLOR = (0, 210, 116)
ENEMY_OUTLINE = (6, 45, 33)
ENEMY_EYE_COLOR = (206, 255, 20)
ENEMY_HEALTH_BAR_BG = arcade.color.BLACK
ENEMY_HEALTH_BAR_FG = (114, 255, 118)

# Projectile colors - glowing green/yellow
BULLET_COLOR = (220, 255, 68)
BULLET_GLOW = (255, 197, 44)
BULLET_TRAIL = (105, 255, 116, 170)

# Splash colors
SPLASH_COLOR = (180, 97, 255)
SPLASH_EXPLOSION = (244, 228, 83)

# Particle colors - green/yellow explosions
EXPLOSION_COLORS = [
    arcade.color.YELLOW_GREEN,
    arcade.color.LIGHT_GREEN,
    arcade.color.GOLDEN_POPPY,
    arcade.color.FERN_GREEN,
    arcade.color.YELLOW,
]

# UI colors
UI_BG = (20, 40, 20, 220)
UI_BORDER = (224, 188, 54)
UI_TEXT = (248, 214, 65)
UI_TEXT_WHITE = arcade.color.WHITE
UI_TEXT_GREEN = (138, 255, 148)
UI_TEXT_RED = arcade.color.RED
VALID_BUILD_COLOR = (120, 255, 120, 95)
INVALID_BUILD_COLOR = (255, 80, 80, 95)
SELECTED_COLOR = (255, 224, 76)
SHADOW_COLOR = (0, 0, 0, 90)
PANEL_BG = (6, 23, 20, 220)
PANEL_BG_LIGHT = (19, 62, 38, 205)
GOLD_GLOW = (255, 210, 66)


def rgba(color, alpha):
    return (color[0], color[1], color[2], max(0, min(255, int(alpha))))

TOWER_DATA = {
    "basic": {
        "name": "Basic",
        "range": 200,
        "damage": 25,
        "cooldown": 30,
        "cost": 100,
        "color": TOWER_RING_COLOR,
        "accent": TOWER_ACCENT_COLOR,
    },
    "sniper": {
        "name": "Sniper",
        "range": 350,
        "damage": 75,
        "cooldown": 90,
        "cost": 200,
        "color": (64, 215, 255),
        "accent": (204, 250, 255),
    },
    "rapid": {
        "name": "Rapid",
        "range": 120,
        "damage": 10,
        "cooldown": 10,
        "cost": 150,
        "color": (255, 146, 41),
        "accent": (255, 238, 98),
    },
    "splash": {
        "name": "Splash",
        "range": 180,
        "damage": 40,
        "cooldown": 60,
        "cost": 180,
        "color": (178, 92, 255),
        "accent": (255, 168, 245),
        "splash_radius": 80,
    },
    "frost": {
        "name": "Frost",
        "range": 175,
        "damage": 14,
        "cooldown": 34,
        "cost": 165,
        "color": (102, 185, 255),
        "accent": (220, 250, 255),
        "slow": 0.55,
        "slow_duration": 95,
    },
    "poison": {
        "name": "Poison",
        "range": 185,
        "damage": 12,
        "cooldown": 36,
        "cost": 145,
        "color": (100, 224, 66),
        "accent": (210, 255, 95),
        "poison_damage": 4,
        "poison_duration": 140,
    },
    "detector": {
        "name": "Detector",
        "range": 230,
        "damage": 8,
        "cooldown": 24,
        "cost": 125,
        "color": (255, 214, 78),
        "accent": (255, 255, 210),
        "detect": True,
    },
}
TOWER_ORDER = ["basic", "sniper", "rapid", "splash", "frost", "poison", "detector"]
WAVE_TRAITS = [
    {
        "name": "Normal",
        "color": UI_TEXT_GREEN,
        "count_bonus": 0,
        "health_mult": 1.0,
        "speed_mult": 1.0,
        "bounty_bonus": 0,
        "flags": [],
    },
    {
        "name": "Swift",
        "color": (112, 220, 255),
        "count_bonus": 1,
        "health_mult": 0.85,
        "speed_mult": 1.34,
        "bounty_bonus": 1,
        "flags": [],
    },
    {
        "name": "Armored",
        "color": (255, 196, 90),
        "count_bonus": -1,
        "health_mult": 1.75,
        "speed_mult": 0.82,
        "bounty_bonus": 5,
        "flags": [],
    },
    {
        "name": "Swarm",
        "color": (142, 255, 121),
        "count_bonus": 5,
        "health_mult": 0.62,
        "speed_mult": 1.08,
        "bounty_bonus": 0,
        "flags": [],
    },
    {
        "name": "Air",
        "color": (132, 220, 255),
        "count_bonus": 0,
        "health_mult": 0.95,
        "speed_mult": 1.18,
        "bounty_bonus": 3,
        "flags": ["air"],
    },
    {
        "name": "Immune",
        "color": (255, 235, 120),
        "count_bonus": -1,
        "health_mult": 1.25,
        "speed_mult": 0.95,
        "bounty_bonus": 4,
        "flags": ["immune"],
    },
    {
        "name": "Invisible",
        "color": (214, 175, 255),
        "count_bonus": 0,
        "health_mult": 1.05,
        "speed_mult": 1.04,
        "bounty_bonus": 6,
        "flags": ["invisible"],
    },
    {
        "name": "Hero",
        "color": (255, 155, 72),
        "count_bonus": -3,
        "health_mult": 2.65,
        "speed_mult": 0.82,
        "bounty_bonus": 12,
        "flags": ["hero"],
    },
    {
        "name": "Boss",
        "color": (255, 94, 94),
        "count_bonus": -4,
        "health_mult": 4.2,
        "speed_mult": 0.72,
        "bounty_bonus": 20,
        "flags": ["boss", "immune"],
    },
]

# Game states
MENU = 0
PLAYING = 1
GAME_OVER = 2
VICTORY = 3

# Difficulty settings
DIFFICULTIES = {
    "easy": {"health_mult": 0.7, "enemy_health_mult": 0.8, "enemy_speed_mult": 0.85, "gold_mult": 1.5, "name": "Easy"},
    "normal": {"health_mult": 1.0, "enemy_health_mult": 1.0, "enemy_speed_mult": 1.0, "gold_mult": 1.0, "name": "Normal"},
    "hard": {"health_mult": 1.3, "enemy_health_mult": 1.4, "enemy_speed_mult": 1.15, "gold_mult": 0.8, "name": "Hard"},
}
DEFAULT_DIFFICULTY = "normal"

# Combo system
COMBO_TIMEOUT = 90
COMBO_GOLD_BONUS_BASE = 5
COMBO_GOLD_BONUS_SCALE = 3


class Particle:
    """Particle for visual effects - green/yellow sparks."""
    
    def __init__(self, x, y, color, size=3, speed=2, lifetime=30):
        self.x = x
        self.y = y
        self.color = color
        self.size = size
        self.angle = random.uniform(0, 360)
        self.speed = speed * random.uniform(0.5, 1.5)
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
        arcade.draw_circle_filled(self.x, self.y, size, rgba(self.color, int(220 * alpha)))


class ExplosionEffect:
    """Explosion visual effect - green circle style."""
    
    def __init__(self, x, y, radius=40, color=None):
        self.x = x
        self.y = y
        self.radius = radius
        self.max_radius = radius
        self.lifetime = 25
        self.active = True
        self.color = color or EXPLOSION_COLORS[0]
        self.particles = []
        
        # Create particles
        for _ in range(12):
            p = Particle(x, y, random.choice(EXPLOSION_COLORS), 
                        size=random.uniform(2, 5),
                        speed=random.uniform(1, 4),
                        lifetime=random.randint(15, 30))
            self.particles.append(p)
            
    def update(self):
        self.lifetime -= 1
        if self.lifetime <= 0:
            self.active = False
        for p in self.particles:
            p.update()
            
    def draw(self):
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


class Enemy:
    """Enemy that moves along a path - green circle style."""
    
    def __init__(self, path_points, scale=1.0, wave=1, trait=None):
        self.path_points = path_points
        self.current_point = 0
        self.trait = trait or WAVE_TRAITS[0]
        self.flags = set(self.trait.get("flags", []))
        self.is_air = "air" in self.flags
        self.is_immune = "immune" in self.flags
        self.is_invisible = "invisible" in self.flags
        self.is_boss = "boss" in self.flags
        self.is_hero = "hero" in self.flags
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
        self.glow_phase = random.uniform(0, 360)
        self.slow_timer = 0
        self.slow_factor = 1.0
        self.poison_timer = 0
        self.poison_damage = 0
        self.poison_tick = 0
        self.revealed_timer = 0
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

        if self.current_point >= len(self.path_points):
            return
            
        target_x, target_y = self.path_points[self.current_point]
        dx = target_x - self.x
        dy = target_y - self.y
        distance = math.sqrt(dx*dx + dy*dy)
        
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

    def take_damage(self, amount, flash=True):
        self.health -= amount
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


class Tower:
    """Tower with concentric rotating circles - Warcraft 3 style."""
    
    def __init__(self, grid_x, grid_y, tower_type="basic"):
        self.grid_x = grid_x
        self.grid_y = grid_y
        self.center_x = grid_x * TILE_SIZE + TILE_SIZE // 2
        self.center_y = grid_y * TILE_SIZE + TILE_SIZE // 2
        self.tower_type = tower_type
        self.angle = 0
        self.cooldown_timer = 0
        self.hit_flash = 0
        self.rotation = 0
        self.pulse_phase = random.uniform(0, 360)
        self.level = 1
        data = TOWER_DATA[tower_type]
        self.name = data["name"]
        self.range = data["range"]
        self.damage = data["damage"]
        self.cooldown = data["cooldown"]
        self.cost = data["cost"]
        self.total_spent = self.cost
        self.color = data["color"]
        self.accent_color = data["accent"]
        self.splash_radius = data.get("splash_radius", 0)
        self.slow = data.get("slow", 1.0)
        self.slow_duration = data.get("slow_duration", 0)
        self.poison_damage = data.get("poison_damage", 0)
        self.poison_duration = data.get("poison_duration", 0)
        self.detect = data.get("detect", False)

    def upgrade_cost(self):
        if self.level >= 4:
            return None
        return int(self.cost * (0.65 + self.level * 0.58))

    def sell_value(self):
        return max(1, int(self.total_spent * 0.6))

    def upgrade(self):
        cost = self.upgrade_cost()
        if cost is None:
            return None
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
            
    def update(self, enemies, bullets, explosions=None):
        if self.cooldown_timer > 0:
            self.cooldown_timer -= 1
            return
            
        # Find closest enemy in range
        closest_enemy = None
        closest_distance = self.range
        
        for enemy in enemies:
            if self.detect:
                distance = math.sqrt(
                    (enemy.center_x - self.center_x) ** 2 +
                    (enemy.center_y - self.center_y) ** 2
                )
                if distance <= self.range:
                    enemy.reveal(10 + self.level * 5)
            if not enemy.is_targetable_by(self.tower_type):
                continue
            distance = math.sqrt(
                (enemy.center_x - self.center_x) ** 2 +
                (enemy.center_y - self.center_y) ** 2
            )
            if distance < closest_distance:
                closest_distance = distance
                closest_enemy = enemy
                
        if closest_enemy:
            self.angle = math.degrees(math.atan2(
                closest_enemy.center_y - self.center_y,
                closest_enemy.center_x - self.center_x
            ))

            if self.detect and self.cooldown_timer <= 0:
                closest_enemy.reveal(30 + self.level * 15)
            
            if self.tower_type == "splash":
                bullet = SplashBullet(self.center_x, self.center_y, closest_enemy, 
                                     self.damage, self.splash_radius, enemies,
                                     explosions)
            else:
                speed = 15 if self.tower_type == "sniper" else 10
                bullet = Bullet(self.center_x, self.center_y, closest_enemy, 
                              self.damage, speed, self.tower_type, self)
            bullets.append(bullet)
            self.cooldown_timer = self.cooldown
            self.play_sound(f"shoot_{self.tower_type}")
            
    def draw(self, selected=False):
        self.rotation += 1
        self.pulse_phase += 2

        arcade.draw_ellipse_filled(self.center_x + 4, self.center_y - 24, 50, 15,
                                  SHADOW_COLOR)
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
                                    rgba(UI_TEXT, 160),
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
                                         TILE_SIZE - 6, TILE_SIZE - 6,
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


class Bullet:
    """Bullet fired from a tower - glowing green circle."""
    
    def __init__(self, x, y, target, damage=25, speed=8, bullet_type="basic",
                 source_tower=None):
        self.x = x
        self.y = y
        self.speed = speed
        self.damage = damage
        self.target = target
        self.bullet_type = bullet_type
        self.source_tower = source_tower
        self.active = True
        self.trail = []
        
    def update(self):
        if not self.target or not self.target.active:
            self.active = False
            return
            
        dx = self.target.center_x - self.x
        dy = self.target.center_y - self.y
        distance = math.sqrt(dx*dx + dy*dy)
        
        # Add to trail
        self.trail.append((self.x, self.y))
        if len(self.trail) > 6:
            self.trail.pop(0)
            
        if distance < self.speed:
            self.active = False
            self.target.take_damage(self.damage)
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
                 explosions_list=None):
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
        
    def update(self):
        if self.exploded:
            self.active = False
            return
            
        if not self.target or not self.target.active:
            self.active = False
            return
            
        dx = self.target.center_x - self.x
        dy = self.target.center_y - self.y
        distance = math.sqrt(dx*dx + dy*dy)
        
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
        explosion = ExplosionEffect(self.x, self.y, self.splash_radius, SPLASH_EXPLOSION)
        if self.explosions_list is not None:
            self.explosions_list.append(explosion)
        
        # Damage enemies in radius
        enemies = self.enemies_list if self.enemies_list else []
        for enemy in enemies:
            if enemy.is_air:
                continue
            distance = math.sqrt(
                (enemy.center_x - self.x) ** 2 +
                (enemy.center_y - self.y) ** 2
            )
            if distance <= self.splash_radius:
                enemy.take_damage(self.damage)
                
    def draw(self):
        # Draw trail
        for i, (tx, ty) in enumerate(self.trail):
            alpha = i / len(self.trail)
            size = 7 * alpha
            arcade.draw_circle_filled(tx, ty, size, rgba(SPLASH_COLOR, int(160 * alpha)))
            
        # Draw bullet
        arcade.draw_circle_filled(self.x, self.y, 12, rgba(SPLASH_COLOR, 80))
        arcade.draw_circle_filled(self.x, self.y, 7, SPLASH_COLOR)
        arcade.draw_circle_filled(self.x, self.y, 5, arcade.color.WHITE)


class Game(arcade.Window):
    """Main game window - Warcraft 3 green circle TD style."""
    
    def __init__(self):
        try:
            super().__init__(SCREEN_WIDTH, SCREEN_HEIGHT, SCREEN_TITLE)
        except Exception as e:
            print(f"Error creating window: {e}")
            import sys
            sys.exit(1)
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
        self.max_wave = 20
        self.current_wave_trait = WAVE_TRAITS[0]
        self.next_wave_trait = WAVE_TRAITS[0]
        self.build_phase = False
        self.build_timer = 0
        self.build_phase_duration = 360
        self.income = 20
        self.income_timer = 0
        self.leaks = 0
        self.screen_shake = 0
        self.wave_announcement = ""
        self.announcement_timer = 0
        self.tower_selection_timer = 0

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

        self.path_points = self.make_green_circle_path()
        self.terrain_marks = []
        self.path_stones = []
        self.build_pads = []
        rng = random.Random(42)
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
        
        arcade.set_background_color(BG_COLOR)

    @staticmethod
    def _key_matches(key, *names):
        return any(key == getattr(arcade.key, name, None) for name in names)

    def make_green_circle_path(self):
        center_x = SCREEN_WIDTH // 2
        center_y = SCREEN_HEIGHT // 2 - 10
        radius = 285
        points = [(0, center_y)]
        for step in range(49):
            t = step / 48
            angle = math.radians(180 - 540 * t)
            wobble = math.sin(t * math.tau * 3) * 12
            current_radius = radius + wobble
            points.append((
                center_x + math.cos(angle) * current_radius,
                center_y + math.sin(angle) * current_radius,
            ))
        points.append((SCREEN_WIDTH, center_y))
        return points

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
        return TOWER_DATA[tower_type or self.selected_tower]["cost"]

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
        self.current_wave_trait = WAVE_TRAITS[0]
        self.next_wave_trait = self.get_wave_trait(self.wave)
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
        
    def start_wave(self):
        self.current_wave_trait = self.get_wave_trait(self.wave)
        base_count = 4 + self.wave * 2 + self.current_wave_trait["count_bonus"]
        self.enemies_to_spawn = max(1, base_count)
        self.spawn_timer = 0
        self.build_phase = False
        self.build_timer = 0
        self.next_wave_trait = self.get_wave_trait(min(self.wave + 1, self.max_wave))
        self.wave_announcement = f"Wave {self.wave}: {self.current_wave_trait['name']} [{diff['name']}]"
        self.announcement_timer = 120
        self.set_status(f"{self.current_wave_trait['name']} wave incoming", 110)
        self.play_sound("wave_start")

    def begin_build_phase(self):
        self.build_phase = True
        self.build_timer = self.build_phase_duration
        self.next_wave_trait = self.get_wave_trait(self.wave)
        self.income = min(160, self.income + 4)
        self.score += self.income
        self.wave_announcement = "Build Phase"
        self.announcement_timer = 90
        self.set_status(f"Income +{self.income} gold. Press N to send wave early.", 150)
        self.play_sound("build_phase")

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
        by_name = {trait["name"]: trait for trait in WAVE_TRAITS}
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
        
    def on_draw(self):
        self.clear()
        
        # Update game logic
        self.update(1/60)
        
        self.draw_background()
        
        # Draw path
        self.draw_path()
        
        # Draw game objects
        for tower in self.towers:
            tower.draw(selected=self.selected_grid == (tower.grid_x, tower.grid_y))
        for enemy in self.enemies:
            enemy.draw()
        for bullet in self.bullets:
            bullet.draw()
        for explosion in self.explosions:
            explosion.draw()

        if self.game_state == PLAYING:
            self.draw_placement_preview()
            
        # Draw UI
        if self.game_state == PLAYING:
            self.draw_ui()
        
        # Draw wave announcement
        if self.announcement_timer > 0:
            self.draw_wave_announcement()
            
        # Draw state-specific overlays
        if self.game_state == MENU:
            self.draw_menu()
        elif self.game_state == PLAYING and self.paused:
            self.draw_pause_overlay()
        elif self.game_state == GAME_OVER:
            self.draw_game_over()
        elif self.game_state == VICTORY:
            self.draw_victory()
            
    def draw_background(self):
        arcade.draw_rectangle_filled(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2,
                                    SCREEN_WIDTH, SCREEN_HEIGHT, BG_COLOR)
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
            
    def draw_path(self):
        if len(self.path_points) >= 2:
            arcade.draw_line_strip(point_list=self.path_points,
                                  color=SHADOW_COLOR,
                                  line_width=PATH_BORDER_WIDTH + 24)
            arcade.draw_line_strip(point_list=self.path_points, 
                                  color=PATH_BORDER_COLOR,
                                  line_width=PATH_BORDER_WIDTH + 14)
            arcade.draw_line_strip(point_list=self.path_points, 
                                  color=PATH_COLOR,
                                  line_width=PATH_BORDER_WIDTH + 2)
            arcade.draw_line_strip(point_list=self.path_points,
                                  color=(92, 52, 28),
                                  line_width=PATH_BORDER_WIDTH - 7)
            arcade.draw_line_strip(point_list=self.path_points,
                                  color=PATH_HIGHLIGHT,
                                  line_width=4)
            arcade.draw_line_strip(point_list=self.path_points,
                                  color=rgba((255, 219, 118), 95),
                                  line_width=1)
            for x, y, width, height, tilt in self.path_stones:
                arcade.draw_ellipse_filled(x, y, width, height,
                                          rgba((232, 178, 92), 120), tilt)
                arcade.draw_ellipse_outline(x, y, width, height,
                                           rgba(PATH_SHADOW, 90), 1, tilt)

            start_x, start_y = self.path_points[0]
            end_x, end_y = self.path_points[-1]
            for x, y, label, color in [
                (start_x + 20, start_y, "SPAWN", (78, 255, 126)),
                (end_x - 30, end_y, "BASE", (255, 196, 67)),
            ]:
                arcade.draw_circle_filled(x, y, 31, rgba(color, 55))
                arcade.draw_circle_outline(x, y, 30, rgba(color, 185), 3)
                arcade.draw_circle_outline(x, y, 20, rgba(arcade.color.WHITE, 100), 1)
                arcade.draw_text(label, x, y - 5, rgba(color, 230), 9,
                                anchor_x="center")

    def draw_placement_preview(self):
        grid_x, grid_y = self.get_grid(self.mouse_x, self.mouse_y)
        if not self.is_valid_grid(grid_x, grid_y):
            return

        center_x, center_y = self.tower_center_for_grid(grid_x, grid_y)
        existing = self.get_tower_at_grid(grid_x, grid_y)
        valid, _ = self.can_build_at(grid_x, grid_y)
        preview_color = VALID_BUILD_COLOR if valid else INVALID_BUILD_COLOR

        if existing:
            arcade.draw_circle_outline(center_x, center_y, existing.range,
                                      SELECTED_COLOR, 2)
            arcade.draw_rectangle_outline(center_x, center_y,
                                         TILE_SIZE - 6, TILE_SIZE - 6,
                                         SELECTED_COLOR, 2)
            return

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
        tower_types = [
            (str(index + 1), tower_type, TOWER_DATA[tower_type])
            for index, tower_type in enumerate(TOWER_ORDER)
        ]
        
        for i, (key, tower_type, data) in enumerate(tower_types):
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
            arcade.draw_text(f"{key}", x + 10, button_y + 5, UI_TEXT, 10)
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
            arcade.draw_text(f"Sell value {selected.sell_value()}g", 430, panel_y + 8,
                            UI_TEXT, 11)
        else:
            selected_data = TOWER_DATA[self.selected_tower]
            preview = (
                f"Next: {self.next_wave_trait['name']}"
                if self.build_phase else
                f"Active: {self.current_wave_trait['name']}"
            )
            arcade.draw_text(
                f"Build {selected_data['name']} - {selected_data['cost']}g   {preview}",
                430,
                panel_y + 28,
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
                        SHADOW_COLOR, 52, anchor_x="center")
        arcade.draw_text("GREEN CIRCLE TD", SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 100,
                        UI_TEXT, 52, anchor_x="center")
        # Subtitle
        arcade.draw_text("Warcraft 3 Style Tower Defense", SCREEN_WIDTH // 2 + 2,
                        SCREEN_HEIGHT // 2 + 48,
                        SHADOW_COLOR, 24, anchor_x="center")
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
        
    def is_on_path(self, x, y):
        """Check if a point is on the path."""
        # Check distance to each path segment
        for i in range(len(self.path_points) - 1):
            p1 = self.path_points[i]
            p2 = self.path_points[i + 1]
            
            # Check if point is within PATH_BORDER_WIDTH of the segment
            dx = p2[0] - p1[0]
            dy = p2[1] - p1[1]
            length = math.sqrt(dx*dx + dy*dy)
            
            if length == 0:
                continue
                
            # Project point onto line segment
            t = max(0, min(1, ((x - p1[0]) * dx + (y - p1[1]) * dy) / (length * length)))
            proj_x = p1[0] + t * dx
            proj_y = p1[1] + t * dy
            
            dist = math.sqrt((x - proj_x)**2 + (y - proj_y)**2)
            if dist < PATH_BORDER_WIDTH // 2 + 10:
                return True
                
        return False
        
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
        elif self._key_matches(key, "U"):
            self.upgrade_selected_tower()
        elif self._key_matches(key, "S"):
            self.sell_selected_tower()
        elif self._key_matches(key, "N", "SPACE"):
            self.send_next_wave_early()
        elif self._key_matches(key, "T"):
            self.sound_enabled = not self.sound_enabled
            self.set_status("Sound ON" if self.sound_enabled else "Sound OFF", 60)
        elif self._key_matches(key, "F5"):
            self.save_game()
        elif self._key_matches(key, "F9"):
            self.load_game()

    def on_mouse_motion(self, x, y, dx, dy):
        self.mouse_x = x
        self.mouse_y = y
            
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

        valid, reason = self.can_build_at(grid_x, grid_y)
        if not valid:
            self.set_status(reason, 90)
            self.play_sound("error")
            return

        tower = Tower(grid_x, grid_y, self.selected_tower)
        self.towers.append(tower)
        self.score -= tower.cost
        self.selected_grid = (grid_x, grid_y)
        self.set_status(f"Built {tower.name} tower", 90)
        self.play_sound("build")

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
        refund = tower.sell_value()
        self.score += refund
        self.towers.remove(tower)
        self.selected_grid = None
        self.set_status(f"Sold {tower.name} for {refund} gold", 100)
        self.play_sound("sell")

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
                
    def update(self, delta_time):
        if self.game_state != PLAYING:
            return

        if self.status_timer > 0:
            self.status_timer -= 1

        if self.paused:
            return

        if self.build_phase:
            self.build_timer -= 1
            self.income_timer += 1
            if self.income_timer >= 120:
                self.income_timer = 0
                trickle = max(1, self.income // 10)
                self.score += trickle
                self.set_status(f"Income tick +{trickle} gold", 45)
            if self.build_timer <= 0:
                self.start_wave()
            return
            
        # Spawn enemies
        if self.enemies_to_spawn > 0:
            self.spawn_timer += 1
            if self.spawn_timer >= 45:
                enemy = Enemy(self.path_points, wave=self.wave,
                              trait=self.current_wave_trait)
                self.enemies.append(enemy)
                self.enemies_to_spawn -= 1
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
            self.begin_build_phase()
            return
            
        # Update towers
        for tower in self.towers:
            tower.update(self.enemies, self.bullets, self.explosions)
            
        # Update bullets
        for bullet in self.bullets:
            bullet.update()
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
                    # Create small death effect
                    explosion = ExplosionEffect(enemy.center_x, enemy.center_y, 20, ENEMY_COLOR)
                    self.explosions.append(explosion)
                    
        self.enemies = [e for e in self.enemies if e.active]
        
        # Check enemies reaching end
        for enemy in self.enemies:
            if enemy.current_point >= len(self.path_points):
                leak_damage = 3 if enemy.is_boss else 2 if enemy.is_hero else 1
                self.health -= leak_damage
                self.leaks += leak_damage
                enemy.active = False
                self.screen_shake = 10
                self.set_status(f"Leak -{leak_damage} life", 70)
                self.play_sound("leak")
                
        self.enemies = [e for e in self.enemies if e.active]
        
        # Update explosions
        for explosion in self.explosions:
            explosion.update()
        self.explosions = [e for e in self.explosions if e.active]
        
        # Screen shake decay
        if self.screen_shake > 0:
            self.screen_shake -= 1

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


def main():
    game = Game()
    arcade.run()


if __name__ == "__main__":
    main()
