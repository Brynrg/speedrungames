#!/usr/bin/env python3
"""
Green Circle TD launcher.

Loads the arcade compatibility shim (`compat.py`) BEFORE importing the game
modules, then hands off to `game.main()`. Keep this file thin -- all the
fragile API-bridging lives in compat.py so updates to game source don't
require launcher changes.
"""
import os
import sys

# Make sure imports resolve relative to this file, even when launched by
# double-clicking a .command from elsewhere.
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
os.chdir(HERE)

# Compatibility shim MUST be imported before any module that calls arcade.
import compat  # noqa: F401  (side-effect import)

if __name__ == "__main__":
    try:
        from game import main
        main()
    except KeyboardInterrupt:
        pass
