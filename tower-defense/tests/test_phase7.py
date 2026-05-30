"""Green Circle TD - Phase 7 tests: undo, autosave, color-blind palette."""
import os
import sys
import time
import json
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from core.undo import UndoManager
from core.autosave import (
    save_autosave, load_autosave, has_autosave,
    delete_autosave, get_autosave_info,
)
from core.palette import (
    get_enemy_color, get_tower_color, get_enemy_symbol,
    ALL_PALETTES, ENEMY_SYMBOLS, PALETTE_BASE,
    PALETTE_DEUTERANOPIA, PALETTE_HIGH_CONTRAST,
)


# ---- Undo System Tests ----

class TestUndoManager:
    """Tests for the undo system."""

    def test_no_undo_initially(self):
        """No undo available before any placement."""
        manager = UndoManager(undo_window_seconds=15)
        assert manager.can_undo() is False
        assert manager.get_undo_info() is None

    def test_record_placement(self):
        """Recording a placement enables undo."""
        manager = UndoManager(undo_window_seconds=15)
        mock_tower = type('MockTower', (), {
            'grid_x': 5, 'grid_y': 5, 'total_spent': 100
        })()
        manager.record_placement(mock_tower, 5, 5, 100)
        assert manager.can_undo() is True
        info = manager.get_undo_info()
        assert info is not None
        assert info["grid_x"] == 5
        assert info["grid_y"] == 5
        assert info["cost"] == 100

    def test_undo_window_expiry(self):
        """Undo expires after the window."""
        manager = UndoManager(undo_window_seconds=0.1)  # 100ms window
        mock_tower = type('MockTower', (), {
            'grid_x': 5, 'grid_y': 5, 'total_spent': 100
        })()
        manager.record_placement(mock_tower, 5, 5, 100)
        assert manager.can_undo() is True
        time.sleep(0.15)
        assert manager.can_undo() is False

    def test_execute_undo(self):
        """Executing undo removes tower and refunds gold."""
        manager = UndoManager(undo_window_seconds=15)
        mock_tower = type('MockTower', (), {
            'grid_x': 5, 'grid_y': 5, 'total_spent': 100
        })()
        manager.record_placement(mock_tower, 5, 5, 100)

        # Mock game state
        mock_game = type('MockGame', (), {
            'towers': [mock_tower],
            'score': 500,
        })()

        result = manager.execute_undo(mock_game)
        assert result is True
        assert mock_tower not in mock_game.towers
        assert mock_game.score == 600  # 500 + 100 refund

    def test_execute_undo_invalid(self):
        """Executing undo when none available returns False."""
        manager = UndoManager(undo_window_seconds=15)
        mock_game = type('MockGame', (), {
            'towers': [],
            'score': 500,
        })()
        result = manager.execute_undo(mock_game)
        assert result is False

    def test_invalidate(self):
        """Invalidating clears the pending undo."""
        manager = UndoManager(undo_window_seconds=15)
        mock_tower = type('MockTower', (), {
            'grid_x': 5, 'grid_y': 5, 'total_spent': 100
        })()
        manager.record_placement(mock_tower, 5, 5, 100)
        manager.invalidate()
        assert manager.can_undo() is False

    def test_clear(self):
        """Clear resets all state."""
        manager = UndoManager(undo_window_seconds=15)
        mock_tower = type('MockTower', (), {
            'grid_x': 5, 'grid_y': 5, 'total_spent': 100
        })()
        manager.record_placement(mock_tower, 5, 5, 100)
        manager.clear()
        assert manager.can_undo() is False

    def test_multiple_placements(self):
        """Only the last placement is undoable."""
        manager = UndoManager(undo_window_seconds=15)
        t1 = type('MockTower', (), {'grid_x': 1, 'grid_y': 1, 'total_spent': 100})()
        t2 = type('MockTower', (), {'grid_x': 2, 'grid_y': 2, 'total_spent': 200})()
        manager.record_placement(t1, 1, 1, 100)
        manager.record_placement(t2, 2, 2, 200)
        info = manager.get_undo_info()
        assert info["grid_x"] == 2
        assert info["cost"] == 200


# ---- Autosave Tests ----

class TestAutosave:
    """Tests for the autosave system."""

    @pytest.fixture(autouse=True)
    def setup(self, tmp_path):
        """Use temp directory for save files."""
        import core.autosave as autosave_mod
        self.orig_save_dir = autosave_mod.SAVE_DIR
        autosave_mod.SAVE_DIR = str(tmp_path / "green-circle-td")
        yield
        autosave_mod.SAVE_DIR = self.orig_save_dir

    def test_no_autosave_initially(self):
        """No autosave exists initially."""
        assert has_autosave() is False
        assert load_autosave() is None

    def test_save_autosave(self):
        """Saving creates an autosave file."""
        mock_game = type('MockGame', (), {
            'health': 15,
            'score': 1200,
            'wave': 5,
            'income': 30,
            'difficulty': 'normal',
            'towers': [],
            'seed': 42,
        })()
        save_autosave(mock_game)
        assert has_autosave() is True

    def test_load_autosave(self):
        """Loading autosave returns saved data."""
        mock_game = type('MockGame', (), {
            'health': 15,
            'score': 1200,
            'wave': 5,
            'income': 30,
            'difficulty': 'normal',
            'towers': [],
            'seed': 42,
        })()
        save_autosave(mock_game)
        data = load_autosave()
        assert data is not None
        assert data["health"] == 15
        assert data["score"] == 1200
        assert data["wave"] == 5

    def test_autosave_info(self):
        """get_autosave_info returns summary data."""
        mock_game = type('MockGame', (), {
            'health': 15,
            'score': 1200,
            'wave': 5,
            'income': 30,
            'difficulty': 'hard',
            'towers': [],
            'seed': 42,
        })()
        save_autosave(mock_game)
        info = get_autosave_info()
        assert info is not None
        assert info["wave"] == 5
        assert info["score"] == 1200
        assert info["health"] == 15
        assert info["difficulty"] == "hard"

    def test_delete_autosave(self):
        """Deleting autosave removes the file."""
        mock_game = type('MockGame', (), {
            'health': 15,
            'score': 1200,
            'wave': 5,
            'income': 30,
            'difficulty': 'normal',
            'towers': [],
            'seed': 42,
        })()
        save_autosave(mock_game)
        assert has_autosave() is True
        delete_autosave()
        assert has_autosave() is False

    def test_autosave_persists_towers(self):
        """Autosave includes tower data."""
        mock_tower = type('MockTower', (), {
            'grid_x': 3, 'grid_y': 4, 'tower_type': 'sniper',
            'level': 2, 'branch_id': None, 'total_spent': 300,
        })()
        mock_game = type('MockGame', (), {
            'health': 20,
            'score': 800,
            'wave': 3,
            'income': 25,
            'difficulty': 'normal',
            'towers': [mock_tower],
            'seed': 99,
        })()
        save_autosave(mock_game)
        data = load_autosave()
        assert len(data["towers"]) == 1
        assert data["towers"][0]["tower_type"] == "sniper"
        assert data["towers"][0]["level"] == 2


# ---- Color-Blind Palette Tests ----

class TestColorBlindPalette:
    """Tests for the color-blind palette system."""

    def test_base_palette_exists(self):
        """Base palette has all enemy and tower entries."""
        assert "enemy_normal" in PALETTE_BASE
        assert "tower_basic" in PALETTE_BASE

    def test_all_palettes_loaded(self):
        """All palettes are available in ALL_PALETTES."""
        assert "none" in ALL_PALETTES
        assert "deuteranopia" in ALL_PALETTES
        assert "protanopia" in ALL_PALETTES
        assert "tritanopia" in ALL_PALETTES
        assert "high_contrast" in ALL_PALETTES

    def test_get_enemy_color(self):
        """get_enemy_color returns correct color for enemy type."""
        color = get_enemy_color("Normal", "none")
        assert color == PALETTE_BASE["enemy_normal"]

    def test_get_enemy_color_palette_switch(self):
        """get_enemy_color returns different colors for different palettes."""
        base_color = get_enemy_color("Armored", "none")
        deuteranopia_color = get_enemy_color("Armored", "deuteranopia")
        # Colors should differ between palettes
        assert base_color != deuteranopia_color

    def test_get_tower_color(self):
        """get_tower_color returns correct color for tower type."""
        color = get_tower_color("basic", "none")
        assert color == PALETTE_BASE["tower_basic"]

    def test_get_tower_color_palette_switch(self):
        """get_tower_color returns different colors for different palettes."""
        base_color = get_tower_color("sniper", "none")
        high_contrast_color = get_tower_color("sniper", "high_contrast")
        assert base_color != high_contrast_color

    def test_enemy_symbols(self):
        """All enemy types have symbols."""
        for enemy_name in ENEMY_SYMBOLS:
            symbol = get_enemy_symbol(enemy_name)
            assert symbol is not None
            assert len(symbol) > 0

    def test_symbol_for_normal(self):
        """Normal enemy has circle symbol."""
        assert get_enemy_symbol("Normal") == "●"

    def test_symbol_for_air(self):
        """Air enemy has triangle symbol."""
        assert get_enemy_symbol("Air") == "▲"

    def test_symbol_for_armored(self):
        """Armored enemy has diamond symbol."""
        assert get_enemy_symbol("Armored") == "◆"

    def test_symbol_for_boss(self):
        """Boss enemy has star symbol."""
        assert get_enemy_symbol("Boss") == "✪"

    def test_symbol_for_unknown(self):
        """Unknown enemy type returns default symbol."""
        assert get_enemy_symbol("Unknown") == "●"

    def test_high_contrast_is_different(self):
        """High contrast palette has distinct colors from base."""
        for key in PALETTE_BASE:
            if key in PALETTE_HIGH_CONTRAST:
                assert PALETTE_BASE[key] != PALETTE_HIGH_CONTRAST[key]

    def test_deuteranopia_palette_exists(self):
        """Deuteranopia palette has all required entries."""
        for key in PALETTE_BASE:
            assert key in PALETTE_DEUTERANOPIA
