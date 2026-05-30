"""Green Circle TD - Autosave system (Phase 7).

Saves game state at end of each wave clear. Main menu offers 'Continue Run'.
"""
import json
import os


SAVE_DIR = os.path.expanduser("~/.local/share/green-circle-td")


def _autosave_path():
    """Compute the autosave file path from the current SAVE_DIR."""
    return os.path.join(SAVE_DIR, "autosave.json")


def ensure_save_dir():
    """Create the save directory if it doesn't exist."""
    os.makedirs(SAVE_DIR, exist_ok=True)


def save_autosave(game_state):
    """Save current game state to autosave file.

    Args:
        game_state: Game object with all state attributes.
    """
    ensure_save_dir()
    save_data = {
        "health": game_state.health,
        "score": game_state.score,
        "wave": game_state.wave,
        "income": game_state.income,
        "difficulty": game_state.difficulty,
        "towers": [],
        "seed": game_state.seed,
    }

    # Save tower positions and types
    for tower in game_state.towers:
        save_data["towers"].append({
            "grid_x": tower.grid_x,
            "grid_y": tower.grid_y,
            "tower_type": tower.tower_type,
            "level": tower.level,
            "branch_id": tower.branch_id,
            "total_spent": tower.total_spent,
        })

    with open(_autosave_path(), "w") as f:
        json.dump(save_data, f, indent=2)


def load_autosave():
    """Load autosave data from disk.

    Returns:
        Dict with saved state, or None if no autosave exists.
    """
    ensure_save_dir()
    if not os.path.exists(_autosave_path()):
        return None
    try:
        with open(_autosave_path(), "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return None


def has_autosave():
    """Check if an autosave exists."""
    return load_autosave() is not None


def delete_autosave():
    """Delete the autosave file."""
    ensure_save_dir()
    if os.path.exists(_autosave_path()):
        os.remove(_autosave_path())


def get_autosave_info():
    """Get summary info about the autosave.

    Returns:
        Dict with 'wave', 'score', 'health', 'difficulty', or None.
    """
    data = load_autosave()
    if data is None:
        return None
    return {
        "wave": data.get("wave", 0),
        "score": data.get("score", 0),
        "health": data.get("health", 0),
        "difficulty": data.get("difficulty", "normal"),
    }
