"""Green Circle TD - Player profile and XP system (Phase 6).

Persistent XP unlocks stored in ~/.local/share/green-circle-td/profile.json.
"""
import json
import os


PROFILE_DIR = os.path.expanduser("~/.local/share/green-circle-td")
PROFILE_PATH = os.path.join(PROFILE_DIR, "profile.json")
SCORES_PATH = os.path.join(PROFILE_DIR, "scores.json")


def ensure_profile_dir():
    """Create the profile directory if it doesn't exist."""
    os.makedirs(PROFILE_DIR, exist_ok=True)


def load_profile():
    """Load player profile from disk.

    Returns:
        Dict with 'total_xp', 'unlocks', 'stats'.
    """
    ensure_profile_dir()
    if os.path.exists(PROFILE_PATH):
        with open(PROFILE_PATH, "r") as f:
            return json.load(f)
    return {
        "total_xp": 0,
        "unlocks": [],
        "stats": {"wins": 0, "best_endless_wave": 0, "total_kills": 0}
    }


def save_profile(profile):
    """Save player profile to disk."""
    ensure_profile_dir()
    with open(PROFILE_PATH, "w") as f:
        json.dump(profile, f, indent=2)


def load_scores():
    """Load daily scores from disk.

    Returns:
        Dict mapping date strings to best scores.
    """
    ensure_profile_dir()
    if os.path.exists(SCORES_PATH):
        with open(SCORES_PATH, "r") as f:
            return json.load(f)
    return {}


def save_scores(scores):
    """Save daily scores to disk."""
    ensure_profile_dir()
    with open(SCORES_PATH, "w") as f:
        json.dump(scores, f, indent=2)


def add_daily_score(date_str, score):
    """Add a daily score, keeping the best per day.

    Args:
        date_str: Date string key (e.g. '2025-01-15').
        score: Score to record.
    """
    scores = load_scores()
    if date_str not in scores or score > scores[date_str]:
        scores[date_str] = score
        save_scores(scores)


def get_daily_best(date_str):
    """Get the best score for a given day.

    Args:
        date_str: Date string key.

    Returns:
        Best score for the day, or None.
    """
    scores = load_scores()
    return scores.get(date_str)


# XP unlock tree
XP_UNLOCKS = [
    {"id": "starting_gold_5", "name": "Pocket Change", "desc": "+5% starting gold", "xp_cost": 100},
    {"id": "starting_life_1", "name": "Second Wind", "desc": "+1 starting life", "xp_cost": 250},
    {"id": "card_skip_free", "name": "Free Pass", "desc": "Card skip is free 3x per run", "xp_cost": 500},
    {"id": "daily_leaderboard", "name": "Competitor", "desc": "Unlock daily-seed leaderboard", "xp_cost": 1000},
    {"id": "all_damage_5", "name": "Hardened", "desc": "+5% all damage", "xp_cost": 3000},
]


def get_available_unlocks(profile):
    """Get XP unlocks available to purchase with current profile XP.

    Args:
        profile: Player profile dict.

    Returns:
        List of unlock dicts that can be purchased.
    """
    available = []
    for unlock in XP_UNLOCKS:
        if unlock["id"] not in profile.get("unlocks", []):
            if profile.get("total_xp", 0) >= unlock["xp_cost"]:
                available.append(unlock)
    return available


def purchase_unlock(profile, unlock_id):
    """Purchase an XP unlock.

    Args:
        profile: Player profile dict (modified in place).
        unlock_id: ID of the unlock to purchase.

    Returns:
        True if purchased, False if not available.
    """
    for unlock in XP_UNLOCKS:
        if unlock["id"] == unlock_id:
            if unlock["id"] in profile.get("unlocks", []):
                return False
            if profile.get("total_xp", 0) >= unlock["xp_cost"]:
                profile.setdefault("unlocks", []).append(unlock_id)
                save_profile(profile)
                return True
    return False


def add_xp(profile, amount):
    """Add XP to the player profile.

    Args:
        profile: Player profile dict (modified in place).
        amount: XP to add.
    """
    profile["total_xp"] = profile.get("total_xp", 0) + amount
    save_profile(profile)


def add_stats(profile, **kwargs):
    """Add to player stats.

    Args:
        profile: Player profile dict (modified in place).
        **kwargs: Stats to increment (e.g. wins=1, total_kills=5).
    """
    for key, value in kwargs.items():
        profile.setdefault("stats", {}).setdefault(key, 0)
        profile["stats"][key] += value
    save_profile(profile)
