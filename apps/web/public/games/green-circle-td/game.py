"""
Green Circle TD - Entry point
Warcraft 3 Green Circle TD Style Tower Defense

Backward-compatible: re-exports classes and constants for existing tests.
"""
import sys
import os
import argparse

# Add project root to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.settings import (
    TOWER_DATA, WAVE_TRAITS, DIFFICULTIES, DEFAULT_DIFFICULTY,
    COMBO_TIMEOUT, MAX_WAVE, SCREEN_WIDTH, SCREEN_HEIGHT, SCREEN_TITLE,
)
from core.tower import Tower
from core.enemy import Enemy
from core.sim import Game


def main():
    parser = argparse.ArgumentParser(description="Green Circle TD")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for deterministic runs")
    parser.add_argument("--daily", action="store_true", help="Use daily seed")
    args = parser.parse_args()

    game = Game(seed=args.seed)
    import arcade
    arcade.run()


if __name__ == "__main__":
    main()
