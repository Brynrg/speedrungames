"""Unit tests for Green Circle TD game logic."""
import math
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from game import (
    Tower, Enemy, TOWER_DATA, WAVE_TRAITS,
    COMBO_TIMEOUT, DIFFICULTIES,
)


class TestTower:
    """Tests for Tower class."""

    def test_tower_creation(self):
        tower = Tower(5, 5, "basic")
        assert tower.grid_x == 5
        assert tower.grid_y == 5
        assert tower.tower_type == "basic"
        assert tower.level == 1
        assert tower.damage == TOWER_DATA["basic"]["damage"]
        assert tower.range == TOWER_DATA["basic"]["range"]

    def test_tower_upgrade(self):
        tower = Tower(5, 5, "basic")
        cost = tower.upgrade()
        assert cost is not None
        assert tower.level == 2
        assert tower.damage > TOWER_DATA["basic"]["damage"]
        assert tower.range > TOWER_DATA["basic"]["range"]
        assert tower.cooldown < TOWER_DATA["basic"]["cooldown"]

    def test_tower_max_level(self):
        tower = Tower(5, 5, "basic")
        tower.upgrade()
        tower.upgrade()
        tower.upgrade()
        assert tower.level == 4
        assert tower.upgrade_cost() is None

    def test_tower_upgrade_cost(self):
        tower = Tower(5, 5, "basic")
        cost_l1 = tower.upgrade_cost()
        assert cost_l1 is not None
        assert cost_l1 > 0
        tower.upgrade()
        cost_l2 = tower.upgrade_cost()
        assert cost_l2 is not None
        assert cost_l2 > cost_l1

    def test_tower_sell_value(self):
        tower = Tower(5, 5, "basic")
        sell_value = tower.sell_value()
        assert sell_value > 0
        assert sell_value < tower.cost

    def test_tower_splash_upgrade(self):
        tower = Tower(5, 5, "splash")
        original_radius = tower.splash_radius
        tower.upgrade()
        assert tower.splash_radius > original_radius

    def test_tower_frost_upgrade(self):
        tower = Tower(5, 5, "frost")
        original_slow = tower.slow
        tower.upgrade()
        assert tower.slow < original_slow

    def test_tower_detector_upgrade(self):
        tower = Tower(5, 5, "detector")
        original_range = tower.range
        tower.upgrade()
        assert tower.range > original_range


class TestEnemy:
    """Tests for Enemy class."""

    def test_enemy_creation(self):
        path = [(0, 0), (100, 0), (200, 0)]
        enemy = Enemy(path, wave=1, trait=WAVE_TRAITS[0])
        assert enemy.health > 0
        assert enemy.max_health == enemy.health
        assert enemy.active
        assert enemy.current_point == 0

    def test_enemy_damage(self):
        path = [(0, 0), (100, 0), (200, 0)]
        enemy = Enemy(path, wave=1, trait=WAVE_TRAITS[0])
        enemy.take_damage(enemy.health + 1)
        assert not enemy.active
        assert enemy.health == 0

    def test_enemy_slow(self):
        path = [(0, 0), (100, 0), (200, 0)]
        enemy = Enemy(path, wave=1, trait=WAVE_TRAITS[0])
        enemy.apply_slow(0.5, 30)
        assert enemy.slow_timer > 0
        assert enemy.slow_factor == 0.5

    def test_enemy_immune_slow(self):
        path = [(0, 0), (100, 0), (200, 0)]
        immune_trait = next(t for t in WAVE_TRAITS if t["name"] == "Immune")
        enemy = Enemy(path, wave=1, trait=immune_trait)
        enemy.apply_slow(0.5, 30)
        assert enemy.slow_timer == 0
        assert enemy.slow_factor == 1.0

    def test_enemy_invisible(self):
        path = [(0, 0), (100, 0), (200, 0)]
        invisible_trait = next(t for t in WAVE_TRAITS if t["name"] == "Invisible")
        enemy = Enemy(path, wave=1, trait=invisible_trait)
        assert enemy.is_invisible
        assert not enemy.is_targetable_by("basic")
        assert enemy.is_targetable_by("detector")

    def test_enemy_air(self):
        path = [(0, 0), (100, 0), (200, 0)]
        air_trait = next(t for t in WAVE_TRAITS if t["name"] == "Air")
        enemy = Enemy(path, wave=1, trait=air_trait)
        assert enemy.is_air
        assert not enemy.is_targetable_by("basic")
        assert enemy.is_targetable_by("sniper")

    def test_enemy_path_following(self):
        path = [(0, 0), (100, 0), (200, 0)]
        enemy = Enemy(path, wave=1, trait=WAVE_TRAITS[0])
        for _ in range(100):
            enemy.update()
        assert enemy.current_point >= len(path)


class TestWaveTraits:
    """Tests for wave trait system."""

    def test_trait_health_scaling(self):
        trait = WAVE_TRAITS[2]
        assert trait["health_mult"] > 1.0

    def test_trait_speed_scaling(self):
        trait = WAVE_TRAITS[1]
        assert trait["speed_mult"] > 1.0

    def test_trait_flags(self):
        air_trait = next(t for t in WAVE_TRAITS if t["name"] == "Air")
        assert "air" in air_trait["flags"]


class TestDifficulty:
    """Tests for difficulty system."""

    def test_difficulty_health(self):
        assert DIFFICULTIES["easy"]["health_mult"] < 1.0
        assert DIFFICULTIES["normal"]["health_mult"] == 1.0
        assert DIFFICULTIES["hard"]["health_mult"] > 1.0

    def test_difficulty_gold(self):
        assert DIFFICULTIES["easy"]["gold_mult"] > 1.0
        assert DIFFICULTIES["hard"]["gold_mult"] < 1.0


class TestCombo:
    """Tests for combo system."""

    def test_combo_timeout_value(self):
        assert COMBO_TIMEOUT > 0
        assert COMBO_TIMEOUT == 90


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
