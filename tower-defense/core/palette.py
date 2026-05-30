"""Green Circle TD - Color-blind palette system (Phase 7).

Provides alternative color palettes for color-blind players.
"""

# Base palette (original)
PALETTE_BASE = {
    "enemy_normal": (138, 255, 148),
    "enemy_swift": (112, 220, 255),
    "enemy_armored": (255, 196, 90),
    "enemy_swarm": (142, 255, 121),
    "enemy_air": (132, 220, 255),
    "enemy_immune": (255, 235, 120),
    "enemy_invisible": (214, 175, 255),
    "enemy_hero": (255, 155, 72),
    "enemy_boss": (255, 94, 94),
    "tower_basic": (42, 178, 84),
    "tower_sniper": (64, 215, 255),
    "tower_rapid": (255, 146, 41),
    "tower_splash": (178, 92, 255),
    "tower_frost": (102, 185, 255),
    "tower_poison": (100, 224, 66),
    "tower_detector": (255, 214, 78),
}

# Deuteranopia (red-green weakness) palette
PALETTE_DEUTERANOPIA = {
    "enemy_normal": (138, 255, 148),
    "enemy_swift": (112, 220, 255),
    "enemy_armored": (255, 160, 60),
    "enemy_swarm": (142, 255, 121),
    "enemy_air": (132, 220, 255),
    "enemy_immune": (255, 200, 100),
    "enemy_invisible": (200, 160, 255),
    "enemy_hero": (255, 140, 60),
    "enemy_boss": (255, 80, 80),
    "tower_basic": (42, 178, 84),
    "tower_sniper": (64, 215, 255),
    "tower_rapid": (255, 130, 30),
    "tower_splash": (178, 92, 255),
    "tower_frost": (102, 185, 255),
    "tower_poison": (100, 224, 66),
    "tower_detector": (255, 200, 60),
}

# Protanopia (red weakness) palette
PALETTE_PROTANOPIA = {
    "enemy_normal": (138, 255, 148),
    "enemy_swift": (112, 220, 255),
    "enemy_armored": (255, 180, 80),
    "enemy_swarm": (142, 255, 121),
    "enemy_air": (132, 220, 255),
    "enemy_immune": (255, 220, 110),
    "enemy_invisible": (190, 150, 255),
    "enemy_hero": (255, 130, 50),
    "enemy_boss": (255, 70, 70),
    "tower_basic": (42, 178, 84),
    "tower_sniper": (64, 215, 255),
    "tower_rapid": (255, 120, 20),
    "tower_splash": (178, 92, 255),
    "tower_frost": (102, 185, 255),
    "tower_poison": (100, 224, 66),
    "tower_detector": (255, 190, 50),
}

# Tritanopia (blue-yellow weakness) palette
PALETTE_TRITANOPIA = {
    "enemy_normal": (138, 255, 148),
    "enemy_swift": (100, 200, 240),
    "enemy_armored": (255, 196, 90),
    "enemy_swarm": (142, 255, 121),
    "enemy_air": (120, 210, 245),
    "enemy_immune": (255, 235, 120),
    "enemy_invisible": (200, 170, 255),
    "enemy_hero": (255, 155, 72),
    "enemy_boss": (255, 94, 94),
    "tower_basic": (42, 178, 84),
    "tower_sniper": (55, 200, 240),
    "tower_rapid": (255, 146, 41),
    "tower_splash": (178, 92, 255),
    "tower_frost": (95, 175, 245),
    "tower_poison": (100, 224, 66),
    "tower_detector": (255, 214, 78),
}

# High contrast palette
PALETTE_HIGH_CONTRAST = {
    "enemy_normal": (0, 255, 0),
    "enemy_swift": (0, 200, 255),
    "enemy_armored": (255, 200, 0),
    "enemy_swarm": (50, 255, 50),
    "enemy_air": (100, 200, 255),
    "enemy_immune": (255, 255, 0),
    "enemy_invisible": (200, 100, 255),
    "enemy_hero": (255, 100, 0),
    "enemy_boss": (255, 0, 0),
    "tower_basic": (0, 200, 0),
    "tower_sniper": (0, 180, 255),
    "tower_rapid": (255, 120, 0),
    "tower_splash": (150, 50, 255),
    "tower_frost": (50, 150, 255),
    "tower_poison": (50, 200, 0),
    "tower_detector": (255, 200, 0),
}

# All palettes
ALL_PALETTES = {
    "none": PALETTE_BASE,
    "deuteranopia": PALETTE_DEUTERANOPIA,
    "protanopia": PALETTE_PROTANOPIA,
    "tritanopia": PALETTE_TRITANOPIA,
    "high_contrast": PALETTE_HIGH_CONTRAST,
}

# Enemy type to palette key mapping
ENEMY_PALETTE_KEYS = {
    "Normal": "enemy_normal",
    "Swift": "enemy_swift",
    "Armored": "enemy_armored",
    "Swarm": "enemy_swarm",
    "Air": "enemy_air",
    "Immune": "enemy_immune",
    "Invisible": "enemy_invisible",
    "Hero": "enemy_hero",
    "Boss": "enemy_boss",
}

# Tower type to palette key mapping
TOWER_PALETTE_KEYS = {
    "basic": "tower_basic",
    "sniper": "tower_sniper",
    "rapid": "tower_rapid",
    "splash": "tower_splash",
    "frost": "tower_frost",
    "poison": "tower_poison",
    "detector": "tower_detector",
    "damage_aura": "tower_basic",
    "speed_aura": "tower_basic",
}

# Enemy type symbols for color-blind accessibility
ENEMY_SYMBOLS = {
    "Normal": "●",
    "Swift": "⚡",
    "Armored": "◆",
    "Swarm": "✱",
    "Air": "▲",
    "Immune": "⊘",
    "Invisible": "✦",
    "Hero": "♔",
    "Boss": "✪",
}


def get_enemy_color(enemy_name, palette_name="none"):
    """Get the color for an enemy type using the specified palette.

    Args:
        enemy_name: Enemy trait name (e.g. 'Normal', 'Armored').
        palette_name: Palette name ('none', 'deuteranopia', etc.).

    Returns:
        RGB tuple for the enemy color.
    """
    palette = ALL_PALETTES.get(palette_name, PALETTE_BASE)
    key = ENEMY_PALETTE_KEYS.get(enemy_name, "enemy_normal")
    return palette.get(key, (138, 255, 148))


def get_tower_color(tower_type, palette_name="none"):
    """Get the color for a tower type using the specified palette.

    Args:
        tower_type: Tower type string (e.g. 'basic', 'sniper').
        palette_name: Palette name.

    Returns:
        RGB tuple for the tower color.
    """
    palette = ALL_PALETTES.get(palette_name, PALETTE_BASE)
    key = TOWER_PALETTE_KEYS.get(tower_type, "tower_basic")
    return palette.get(key, (42, 178, 84))


def get_enemy_symbol(enemy_name):
    """Get the symbol for an enemy type (always visible, regardless of palette).

    Args:
        enemy_name: Enemy trait name.

    Returns:
        Symbol string.
    """
    return ENEMY_SYMBOLS.get(enemy_name, "●")
