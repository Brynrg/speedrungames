"""Green Circle TD - Data loading utilities."""
import json
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


def load_json(filename):
    """Load a JSON file from the data directory."""
    filepath = os.path.join(DATA_DIR, filename)
    with open(filepath, "r") as f:
        return json.load(f)


def load_towers():
    """Load tower data from JSON."""
    return load_json("towers.json")


def load_enemies():
    """Load enemy wave traits from JSON."""
    return load_json("enemies.json")


def load_waves():
    """Load wave definitions from JSON."""
    return load_json("waves.json")


def load_hero():
    """Load hero configuration from JSON."""
    return load_json("hero.json")


def load_upgrades():
    """Load branching upgrade definitions from JSON."""
    return load_json("upgrades.json")


def load_cards():
    """Load card definitions from JSON."""
    return load_json("cards.json")
