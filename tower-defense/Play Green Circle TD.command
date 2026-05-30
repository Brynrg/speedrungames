#!/bin/bash
# Double-click launcher for Green Circle TD.
# Auto-bootstraps venv if missing, then runs the game.

set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

if [ ! -x "./venv/bin/python" ]; then
    echo "First run: creating venv and installing dependencies..."
    python3 -m venv venv
    ./venv/bin/pip install --upgrade pip
    ./venv/bin/pip install -r requirements.txt
fi

# Verify the arcade compat shim is healthy before launching.
./venv/bin/python compat.py

exec ./venv/bin/python launch_game.py
