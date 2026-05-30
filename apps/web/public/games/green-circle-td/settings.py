"""Green Circle TD - Settings and constants."""
import os
import arcade

# Screen settings
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
SPLASH_COLOR = (180, 92, 255)
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

# Minimap
MINIMAP_X = SCREEN_WIDTH - 160
MINIMAP_Y = SCREEN_HEIGHT - 160
MINIMAP_SIZE = 140

# Max waves
MAX_WAVE = 30

# Multi-speed settings
SPEEDS = {"1x": 1, "2x": 2, "3x": 3}
DEFAULT_SPEED = "1x"

# Reduced motion
REDUCED_MOTION = False


def rgba(color, alpha):
    """Convert color to RGBA with clamped alpha."""
    return (color[0], color[1], color[2], max(0, min(255, int(alpha))))


# Backward compatibility: load data from JSON at import time
def _load_tower_data():
    """Load tower data from JSON for backward compatibility."""
    import json
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
    filepath = os.path.join(data_dir, "towers.json")
    with open(filepath, "r") as f:
        raw = json.load(f)
    # Convert list colors to tuples for backward compatibility
    result = {}
    for k, v in raw.items():
        entry = dict(v)
        if "color" in entry:
            entry["color"] = tuple(entry["color"])
        if "accent" in entry:
            entry["accent"] = tuple(entry["accent"])
        result[k] = entry
    return result


def _load_wave_traits():
    """Load wave traits from JSON for backward compatibility."""
    import json
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
    filepath = os.path.join(data_dir, "enemies.json")
    with open(filepath, "r") as f:
        raw = json.load(f)
    # Convert list colors to tuples for backward compatibility
    result = []
    for entry in raw:
        e = dict(entry)
        if "color" in e:
            e["color"] = tuple(e["color"])
        result.append(e)
    return result


TOWER_DATA = _load_tower_data()
WAVE_TRAITS = _load_wave_traits()

# Branching upgrade definitions (Phase 3c)
def _load_upgrade_branches():
    """Load upgrade branch definitions from JSON."""
    import json
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
    filepath = os.path.join(data_dir, "upgrades.json")
    with open(filepath, "r") as f:
        return json.load(f)

UPGRADE_BRANCHES = _load_upgrade_branches()

DIFFICULTIES = {
    "easy": {"health_mult": 0.7, "enemy_health_mult": 0.8, "enemy_speed_mult": 0.85, "gold_mult": 1.5, "name": "Easy"},
    "normal": {"health_mult": 1.0, "enemy_health_mult": 1.0, "enemy_speed_mult": 1.0, "gold_mult": 1.0, "name": "Normal"},
    "hard": {"health_mult": 1.3, "enemy_health_mult": 1.4, "enemy_speed_mult": 1.15, "gold_mult": 0.8, "name": "Hard"},
}
DEFAULT_DIFFICULTY = "normal"
COMBO_TIMEOUT = 90
MAX_WAVE = 30
