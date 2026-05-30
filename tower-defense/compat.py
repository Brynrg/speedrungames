"""
Arcade 2.x -> 3.x compatibility shim for Green Circle TD.

The game source uses several Arcade 2.x APIs that were renamed or had their
signatures changed in Arcade 3.x. Importing this module patches the `arcade`
namespace so the legacy calls keep working.

This module is the single source of truth for "things that broke when arcade
moved to 3.x". If a future update of the game source uses another deprecated
call, add a shim here -- never patch arcade calls inline in game code.

USAGE: import this BEFORE any module that calls arcade draw functions. The
launcher (`launch_game.py`) imports it first.
"""
from __future__ import annotations

import builtins
import sys
import warnings

# ---------------------------------------------------------------------------
# 1. Configure pyglet before arcade pulls it in.
# ---------------------------------------------------------------------------
import pyglet
pyglet.options["search_local_libs"] = True
# Prefer working audio backends; fall back to silent so a missing OpenAL never
# blocks startup.
pyglet.options["audio"] = ("openal", "pulse", "directsound", "silent")

# ---------------------------------------------------------------------------
# 2. Import arcade and check version compatibility.
# ---------------------------------------------------------------------------
import arcade

_MIN_ARCADE = (3, 0, 0)
_MAX_TESTED = (3, 0, 99)  # bump deliberately when you re-test against newer arcade

def _parse_version(v: str) -> tuple[int, ...]:
    out: list[int] = []
    for part in v.split("."):
        digits = "".join(c for c in part if c.isdigit())
        out.append(int(digits) if digits else 0)
    return tuple(out)

_ver = _parse_version(getattr(arcade, "__version__", "0"))
if _ver < _MIN_ARCADE:
    raise RuntimeError(
        f"Arcade {arcade.__version__} is too old. Need >= {'.'.join(map(str, _MIN_ARCADE))}. "
        f"Run: ./venv/bin/pip install -r requirements.txt"
    )
if _ver[:2] > _MAX_TESTED[:2]:
    warnings.warn(
        f"Arcade {arcade.__version__} is newer than the last tested version "
        f"({'.'.join(map(str, _MAX_TESTED))}). The compatibility shim may need updating.",
        stacklevel=2,
    )

# ---------------------------------------------------------------------------
# 3. Rect type aliases (LBWH / XYWH) -- expose on arcade namespace AND inject
#    into builtins so bare `LBWH(...)` calls keep working even if a regenerated
#    sim.py drops the explicit import.
# ---------------------------------------------------------------------------
try:
    from arcade.types.rect import LBWH, XYWH, LRBT
except ImportError:
    # Older path
    from arcade.types import LBWH, XYWH, LRBT  # type: ignore

for _name, _cls in (("LBWH", LBWH), ("XYWH", XYWH), ("LRBT", LRBT)):
    if not hasattr(arcade, _name):
        setattr(arcade, _name, _cls)
    # builtins injection -- ugly but resilient against regenerated source files
    setattr(builtins, _name, _cls)

# ---------------------------------------------------------------------------
# 4. Drawing API shims: restore the Arcade 2.x signatures that the game uses.
# ---------------------------------------------------------------------------
_native_draw_rect_filled = arcade.draw_rect_filled
_native_draw_rect_outline = arcade.draw_rect_outline

def _draw_rectangle_filled(center_x, center_y, width, height, color, tilt_angle=0):
    """Arcade 2.x signature -> 3.x draw_rect_filled(rect, color)."""
    _native_draw_rect_filled(XYWH(center_x, center_y, width, height), color, tilt_angle)

def _draw_rectangle_outline(center_x, center_y, width, height, color, border_width=1, tilt_angle=0):
    """Arcade 2.x signature -> 3.x draw_rect_outline(rect, color, border_width)."""
    _native_draw_rect_outline(XYWH(center_x, center_y, width, height), color, border_width, tilt_angle)

arcade.draw_rectangle_filled = _draw_rectangle_filled
arcade.draw_rectangle_outline = _draw_rectangle_outline

# ---------------------------------------------------------------------------
# 5. Sound shim -- arcade.SoundIO no longer exists. The game source guards every
#    call with try/except, but make the attribute exist so static checkers and
#    any future un-guarded reference doesn't AttributeError.
# ---------------------------------------------------------------------------
if not hasattr(arcade, "SoundIO"):
    class _NoOpSound:
        """Placeholder for the removed arcade.SoundIO. Silently no-ops."""
        def __init__(self, *a, **kw): pass
        def set_buffer(self, *a, **kw): pass
        def play(self, *a, **kw): return None
        def stop(self, *a, **kw): pass
    arcade.SoundIO = _NoOpSound  # type: ignore

# ---------------------------------------------------------------------------
# 6. Suppress the noisy "No GL context" traceback printed during window close.
#    This is harmless teardown noise from pyglet on macOS but looks alarming.
# ---------------------------------------------------------------------------
try:
    from pyglet.gl.lib import GLException
    _orig_excepthook = sys.excepthook
    def _quiet_excepthook(exc_type, exc, tb):
        if exc_type is GLException and "No GL context" in str(exc):
            return
        _orig_excepthook(exc_type, exc, tb)
    sys.excepthook = _quiet_excepthook
except Exception:
    pass  # not worth crashing the game over the log cleanup

# Also silence the chatty draw_text PerformanceWarning -- it fires once per
# frame and isn't actionable for a casual local build.
warnings.filterwarnings("ignore", message=".*draw_text is an extremely slow function.*")

# ---------------------------------------------------------------------------
# 7. Sanity self-test (runs only when this module is executed directly).
# ---------------------------------------------------------------------------
def selftest() -> None:
    """Verify the shim covers everything the game source needs. Exit non-zero on failure."""
    required = [
        ("draw_rectangle_filled", callable),
        ("draw_rectangle_outline", callable),
        ("draw_rect_filled", callable),
        ("LBWH", None),
        ("XYWH", None),
        ("SoundIO", None),
        ("Window", None),
        ("run", callable),
    ]
    missing: list[str] = []
    for name, check in required:
        if not hasattr(arcade, name):
            missing.append(name)
        elif check and not check(getattr(arcade, name)):
            missing.append(f"{name} (not callable)")
    if missing:
        print(f"FAIL: arcade is missing: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)
    print(f"OK: arcade {arcade.__version__} compatibility shim active.")

if __name__ == "__main__":
    selftest()
