"""Green Circle TD - Aura system for tower synergies."""
import math


def get_active_aura_towers(game):
    """Return list of all aura towers within range of any enemy.

    Args:
        game: Game instance.

    Returns:
        List of (tower, distance) tuples for all active aura towers.
    """
    active_auras = []
    for tower in game.towers:
        if not tower.aura:
            continue
        # Only consider non-hero towers
        if tower.tower_type in ("damage_aura", "speed_aura"):
            active_auras.append(tower)
    return active_auras


def compute_tower_modifiers(tower, all_towers):
    """Compute combined damage bonus and cooldown reduction from overlapping auras.

    Args:
        tower: The target tower being affected.
        all_towers: List of all towers in the game.

    Returns:
        Dict with keys: "damage_bonus", "cooldown_reduction"
    """
    damage_bonus = 0.0
    cooldown_reduction = 0.0

    for aura_tower in all_towers:
        if not aura_tower.aura:
            continue
        # Compute distance between towers
        dx = tower.center_x - aura_tower.center_x
        dy = tower.center_y - aura_tower.center_y
        distance = math.sqrt(dx*dx + dy*dy)

        # Check if tower is within aura radius
        if distance <= aura_tower.aura["radius"]:
            aura_type = aura_tower.aura["type"]
            aura_value = aura_tower.aura["value"]

            if aura_type == "damage_bonus":
                damage_bonus += aura_value
            elif aura_type == "cooldown_reduction":
                cooldown_reduction += aura_value

    # Cap damage bonus at 100% (1.0)
    damage_bonus = min(damage_bonus, 1.0)

    # Cap cooldown reduction at 75% (0.75)
    cooldown_reduction = min(cooldown_reduction, 0.75)

    return {
        "damage_bonus": damage_bonus,
        "cooldown_reduction": cooldown_reduction
    }
