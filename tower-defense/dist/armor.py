"""Green Circle TD - Damage/armor matrix system."""
import os
import json

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


def _load_armor_matrix():
    """Load the armor matrix from JSON."""
    filepath = os.path.join(DATA_DIR, "armor_matrix.json")
    with open(filepath, "r") as f:
        return json.load(f)


# Module-level cache
_armor_matrix = _load_armor_matrix()


def get_matrix():
    """Return the full armor matrix dict."""
    return _armor_matrix


def get_multiplier(damage_type, armor_type):
    """Get the damage multiplier for a damage type vs armor type.
    
    Returns the matrix value, floored at 1.0.
    """
    matrix = _armor_matrix["matrix"]
    mult = matrix.get(damage_type, {}).get(armor_type, 1.0)
    return max(1.0, mult)


def get_damage_types():
    """Return list of damage type names."""
    return _armor_matrix["damage_types"]


def get_armor_types():
    """Return list of armor type names."""
    return _armor_matrix["armor_types"]


def get_best_damage_types(armor_type, top_n=2):
    """Get the top N damage types that are most effective against an armor type."""
    matrix = _armor_matrix["matrix"]
    scores = []
    for dtype in _armor_matrix["damage_types"]:
        mult = matrix.get(dtype, {}).get(armor_type, 1.0)
        scores.append((dtype, mult))
    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[:top_n]


def get_worst_damage_types(armor_type, top_n=2):
    """Get the top N damage types that are least effective against an armor type."""
    matrix = _armor_matrix["matrix"]
    scores = []
    for dtype in _armor_matrix["damage_types"]:
        mult = matrix.get(dtype, {}).get(armor_type, 1.0)
        scores.append((dtype, mult))
    scores.sort(key=lambda x: x[1])
    return scores[:top_n]
