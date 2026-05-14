# Green Circle TD

Warcraft 3-inspired tower defense game built with Python and Arcade.

## Features

- 7 tower types: Basic, Sniper, Rapid, Splash, Frost, Poison, Detector
- 9 wave traits: Normal, Swift, Armored, Swarm, Air, Immune, Invisible, Hero, Boss
- 20 waves with increasing difficulty
- 4-level tower upgrade system
- Build phase / combat phase cycle
- Combo system for rapid kills
- Save/Load game support
- Difficulty settings (Easy, Normal, Hard)
- Warcraft 3 Green Circle aesthetic

## Controls

- **1-7**: Select tower type
- **Click**: Place selected tower / Select existing tower
- **Right-click**: Sell selected tower
- **U**: Upgrade selected tower
- **N / Space**: Send next wave early
- **P / Escape**: Pause game
- **F5**: Save game
- **F9**: Load game
- **T**: Toggle sound
- **M**: Cycle difficulty (on menu)
- **R**: Restart game

## Installation

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python game.py
```

## Distribution (macOS)

Build a `.app` bundle:

```bash
mkdir -p GreenCircleTD.app/Contents/MacOS
# Write Info.plist and launch script (see references/macos-app-bundle.md)
chmod +x GreenCircleTD.app/Contents/MacOS/launch
```

## Tech Stack

- Python 3.9+
- Arcade 3.0.2
- macOS (tested)
