"""Green Circle TD - Undo system (Phase 7).

Allows undoing the last tower placement within a 15-second window.
"""
import time


class UndoManager:
    """Manages undoable tower placements."""

    def __init__(self, undo_window_seconds=15):
        self.undo_window = undo_window_seconds  # seconds
        self.pending_undo = None  # None or dict with placement info
        self.undo_timestamp = 0  # time.time() when placement happened

    def record_placement(self, tower, grid_x, grid_y, cost):
        """Record a tower placement for potential undo.

        Args:
            tower: The Tower object that was placed.
            grid_x: Grid X coordinate.
            grid_y: Grid Y coordinate.
            cost: Gold cost of the tower.
        """
        self.pending_undo = {
            "tower": tower,
            "grid_x": grid_x,
            "grid_y": grid_y,
            "cost": cost,
        }
        self.undo_timestamp = time.time()

    def can_undo(self):
        """Check if an undo is available (within window and no kills made)."""
        if self.pending_undo is None:
            return False
        elapsed = time.time() - self.undo_timestamp
        if elapsed > self.undo_window:
            self.pending_undo = None
            return False
        return True

    def get_undo_info(self):
        """Get info about the pending undo.

        Returns:
            Dict with tower, grid_x, grid_y, cost, or None.
        """
        if not self.can_undo():
            return None
        return self.pending_undo

    def execute_undo(self, game_state):
        """Execute the undo: remove tower and refund gold.

        Args:
            game_state: Game object with score, towers, etc.

        Returns:
            True if undo was executed, False otherwise.
        """
        info = self.get_undo_info()
        if info is None:
            return False

        tower = info["tower"]
        # Remove tower from game
        if tower in game_state.towers:
            game_state.towers.remove(tower)
        game_state.score += info["cost"]
        self.pending_undo = None
        return True

    def invalidate(self):
        """Invalidate the pending undo (e.g., after a kill)."""
        self.pending_undo = None

    def clear(self):
        """Clear all undo state."""
        self.pending_undo = None
        self.undo_timestamp = 0
