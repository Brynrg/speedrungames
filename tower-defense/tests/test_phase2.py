"""Green Circle TD - Phase 2 tests: four-corner paths, aura system, sell curve."""
import os
import sys
import math

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from core.path import make_four_corner_paths, _spiral_path, make_green_circle_path
from core.aura import AuraTower, compute_tower_modifiers, get_active_aura_towers
from core.tower import Tower
from core.enemy import Enemy
from core.settings import TOWER_DATA


# ---- Four-Corner Path Tests ----

class TestFourCornerPaths:
    """Tests for the four-corner path system."""

    def test_returns_four_paths(self):
        paths, spawn_points, center = make_four_corner_paths(960, 720)
        assert len(paths) == 4
        assert len(spawn_points) == 4

    def test_paths_converge_at_center(self):
        paths, spawn_points, center = make_four_corner_paths(960, 720)
        cx, cy = 960 / 2, 720 / 2
        # Last point of each path should be at center
        for path in paths:
            last = path[-1]
            assert abs(last[0] - cx) < 5
            assert abs(last[1] - cy) < 5

    def test_spawn_points_at_corners(self):
        paths, spawn_points, center = make_four_corner_paths(960, 720)
        expected_corners = [(0, 0), (960, 0), (0, 720), (960, 720)]
        for i, (sx, sy) in enumerate(spawn_points):
            ex, ey = expected_corners[i]
            assert abs(sx - ex) < 5
            assert abs(sy - ey) < 5

    def test_center_point_correct(self):
        paths, spawn_points, center = make_four_corner_paths(960, 720)
        assert center == (480.0, 360.0)

    def test_paths_have_waypoints(self):
        paths, _, _ = make_four_corner_paths(960, 720)
        for path in paths:
            assert len(path) > 10  # Should have many waypoints
            assert len(path) == 49  # 48 samples + 1 start

    def test_spiral_path_monotonic_approach(self):
        """Each spiral path should approach the center monotonically."""
        path = _spiral_path(0, 0, 100, 100, turns=1.5, samples=48)
        # Distance to end should generally decrease
        end_x, end_y = 100, 100
        distances = [math.sqrt((p[0] - end_x)**2 + (p[1] - end_y)**2) for p in path]
        # First point should be furthest, last should be closest
        assert distances[0] > distances[-1]

    def test_green_circle_path_still_works(self):
        """Backward compatibility: original single path still generates."""
        path = make_green_circle_path(960, 720)
        assert len(path) > 10
        # Should start left and end right
        assert path[0][0] < path[-1][0]


# ---- Aura System Tests ----

class TestAuraTower:
    """Tests for the AuraTower class."""

    def test_aura_tower_creation(self):
        tower = Tower(5, 5, "damage_aura", tower_data=TOWER_DATA.get("damage_aura", {}))
        aura = AuraTower(tower)
        assert aura.aura_type == "damage_bonus"
        assert aura.radius == 160
        assert aura.value == 0.20

    def test_speed_aura_creation(self):
        tower = Tower(5, 5, "speed_aura", tower_data=TOWER_DATA.get("speed_aura", {}))
        aura = AuraTower(tower)
        assert aura.aura_type == "cooldown_reduction"
        assert aura.radius == 150
        assert aura.value == 0.15

    def test_aura_affects_nearby_tower(self):
        tower1 = Tower(5, 5, "damage_aura", tower_data=TOWER_DATA.get("damage_aura", {}))
        aura = AuraTower(tower1)
        # Tower(5,5) = center (320, 320), Tower(5,6) = center (320, 384) = 64px away
        tower2 = Tower(5, 6, "basic", tower_data=TOWER_DATA.get("basic", {}))
        assert aura.affects_tower(tower2)

    def test_aura_does_not_affect_far_tower(self):
        tower1 = Tower(5, 5, "damage_aura", tower_data=TOWER_DATA.get("damage_aura", {}))
        aura = AuraTower(tower1)
        tower2 = Tower(20, 20, "basic", tower_data=TOWER_DATA.get("basic", {}))
        # Distance between (320, 320) and (1280, 1280) is way more than 160
        assert not aura.affects_tower(tower2)

    def test_aura_boundary(self):
        """Tower exactly at aura radius boundary should be affected."""
        tower1 = Tower(5, 5, "damage_aura", tower_data=TOWER_DATA.get("damage_aura", {}))
        aura = AuraTower(tower1)
        # Place tower exactly at aura radius
        tower2 = Tower(5, 5, "basic", tower_data=TOWER_DATA.get("basic", {}))
        tower2.center_x = tower1.center_x + 160
        tower2.center_y = tower1.center_y
        assert aura.affects_tower(tower2)


class TestComputeTowerModifiers:
    """Tests for compute_tower_modifiers function."""

    def test_no_aura_no_modifiers(self):
        tower = Tower(5, 5, "basic", tower_data=TOWER_DATA.get("basic", {}))
        mods = compute_tower_modifiers(tower, [tower])
        assert mods["damage_bonus"] == 0.0
        assert mods["cooldown_reduction"] == 0.0

    def test_single_damage_aura(self):
        aura_tower = Tower(5, 5, "damage_aura", tower_data=TOWER_DATA.get("damage_aura", {}))
        target = Tower(5, 6, "basic", tower_data=TOWER_DATA.get("basic", {}))
        mods = compute_tower_modifiers(target, [aura_tower, target])
        assert mods["damage_bonus"] == pytest.approx(0.20)
        assert mods["cooldown_reduction"] == 0.0

    def test_single_speed_aura(self):
        aura_tower = Tower(5, 5, "speed_aura", tower_data=TOWER_DATA.get("speed_aura", {}))
        target = Tower(5, 6, "basic", tower_data=TOWER_DATA.get("basic", {}))
        mods = compute_tower_modifiers(target, [aura_tower, target])
        assert mods["damage_bonus"] == 0.0
        assert mods["cooldown_reduction"] == pytest.approx(0.15)

    def test_two_damage_auras_stack(self):
        aura1 = Tower(5, 5, "damage_aura", tower_data=TOWER_DATA.get("damage_aura", {}))
        aura2 = Tower(6, 5, "damage_aura", tower_data=TOWER_DATA.get("damage_aura", {}))
        target = Tower(5, 6, "basic", tower_data=TOWER_DATA.get("basic", {}))
        mods = compute_tower_modifiers(target, [aura1, aura2, target])
        # Two auras at 20% each = 40%
        assert mods["damage_bonus"] == pytest.approx(0.40)

    def test_damage_bonus_capped_at_100(self):
        """Multiple overlapping damage auras cap at +100%."""
        auras = []
        for i in range(10):
            a = Tower(i, 0, "damage_aura", tower_data=TOWER_DATA.get("damage_aura", {}))
            auras.append(a)
        target = Tower(5, 0, "basic", tower_data=TOWER_DATA.get("basic", {}))
        mods = compute_tower_modifiers(target, auras + [target])
        assert mods["damage_bonus"] == pytest.approx(1.0)  # Capped at 1.0

    def test_cooldown_reduction_capped_at_50(self):
        """Multiple cooldown auras cap at 50%."""
        auras = []
        for i in range(10):
            a = Tower(i, 0, "speed_aura", tower_data=TOWER_DATA.get("speed_aura", {}))
            auras.append(a)
        target = Tower(5, 0, "basic", tower_data=TOWER_DATA.get("basic", {}))
        mods = compute_tower_modifiers(target, auras + [target])
        assert mods["cooldown_reduction"] == pytest.approx(0.5)  # Capped at 0.5

    def test_aura_does_not_affect_self(self):
        """An aura tower should not affect itself."""
        aura_tower = Tower(5, 5, "damage_aura", tower_data=TOWER_DATA.get("damage_aura", {}))
        mods = compute_tower_modifiers(aura_tower, [aura_tower])
        assert mods["damage_bonus"] == 0.0

    def test_mixed_auras(self):
        """Damage and cooldown auras stack independently."""
        dmg_aura = Tower(5, 5, "damage_aura", tower_data=TOWER_DATA.get("damage_aura", {}))
        spd_aura = Tower(7, 5, "speed_aura", tower_data=TOWER_DATA.get("speed_aura", {}))
        target = Tower(6, 7, "basic", tower_data=TOWER_DATA.get("basic", {}))
        mods = compute_tower_modifiers(target, [dmg_aura, spd_aura, target])
        assert mods["damage_bonus"] == pytest.approx(0.20)
        assert mods["cooldown_reduction"] == pytest.approx(0.15)


class TestGetActiveAuraTowers:
    """Tests for get_active_aura_towers function."""

    def test_returns_only_aura_towers(self):
        towers = [
            Tower(5, 5, "basic", tower_data=TOWER_DATA.get("basic", {})),
            Tower(7, 7, "damage_aura", tower_data=TOWER_DATA.get("damage_aura", {})),
            Tower(9, 9, "sniper", tower_data=TOWER_DATA.get("sniper", {})),
            Tower(11, 11, "speed_aura", tower_data=TOWER_DATA.get("speed_aura", {})),
        ]
        aura_towers = get_active_aura_towers(towers)
        assert len(aura_towers) == 2
        assert all(isinstance(a, AuraTower) for a in aura_towers)


# ---- Sell Curve Tests ----

class TestSellCurve:
    """Tests for the wave-dependent sell value curve."""

    def test_sell_before_wave_5_full_refund(self):
        tower = Tower(5, 5, "basic", tower_data=TOWER_DATA.get("basic", {}))
        tower.total_spent = 100
        assert tower.sell_value(current_wave=1) == 100
        assert tower.sell_value(current_wave=4) == 100

    def test_sell_wave_5_to_14_seventy_five_percent(self):
        tower = Tower(5, 5, "basic", tower_data=TOWER_DATA.get("basic", {}))
        tower.total_spent = 100
        assert tower.sell_value(current_wave=5) == 75
        assert tower.sell_value(current_wave=10) == 75
        assert tower.sell_value(current_wave=14) == 75

    def test_sell_wave_15_plus_fifty_percent(self):
        tower = Tower(5, 5, "basic", tower_data=TOWER_DATA.get("basic", {}))
        tower.total_spent = 100
        assert tower.sell_value(current_wave=15) == 50
        assert tower.sell_value(current_wave=20) == 50
        assert tower.sell_value(current_wave=30) == 50

    def test_sell_includes_upgrades(self):
        tower = Tower(5, 5, "basic", tower_data=TOWER_DATA.get("basic", {}))
        tower.total_spent = 100
        tower.upgrade()  # Adds upgrade cost
        tower.upgrade()
        # Total spent should include upgrades
        assert tower.total_spent > 100
        refund = tower.sell_value(current_wave=1)
        assert refund == tower.total_spent  # Wave 1 = 100% refund

    def test_sell_legacy_none_wave(self):
        """Legacy call with current_wave=None uses flat 60%."""
        tower = Tower(5, 5, "basic", tower_data=TOWER_DATA.get("basic", {}))
        tower.total_spent = 100
        assert tower.sell_value(current_wave=None) == 60


# ---- Enemy Corner Integration Tests ----

class TestEnemyCornerIndex:
    """Tests for enemy corner_index support."""

    def test_enemy_default_corner_index(self):
        path = [(0, 0), (100, 0), (200, 0)]
        trait = {"name": "Normal", "color": (138, 255, 148), "count_bonus": 0,
                 "health_mult": 1.0, "speed_mult": 1.0, "bounty_bonus": 0,
                 "flags": [], "armor_type": "medium"}
        enemy = Enemy(path, wave=1, trait=trait)
        assert enemy.corner_index == 0

    def test_enemy_custom_corner_index(self):
        path = [(0, 0), (100, 0), (200, 0)]
        trait = {"name": "Normal", "color": (138, 255, 148), "count_bonus": 0,
                 "health_mult": 1.0, "speed_mult": 1.0, "bounty_bonus": 0,
                 "flags": [], "armor_type": "medium"}
        enemy = Enemy(path, wave=1, trait=trait, corner_index=3)
        assert enemy.corner_index == 3

    def test_enemy_uses_own_path(self):
        """Enemy should use its own path_points for movement, not a shared path."""
        path1 = [(0, 0), (50, 50), (100, 100)]
        path2 = [(960, 0), (900, 50), (800, 100)]
        trait = {"name": "Normal", "color": (138, 255, 148), "count_bonus": 0,
                 "health_mult": 1.0, "speed_mult": 1.0, "bounty_bonus": 0,
                 "flags": [], "armor_type": "medium"}
        enemy = Enemy(path1, wave=1, trait=trait, corner_index=0)
        assert enemy.path_points is path1
        assert enemy.path_points != path2


# ---- Tower Aura Rendering Tests ----

class TestTowerAuraRendering:
    """Tests for aura tower rendering in draw method."""

    def test_aura_tower_has_aura_attr(self):
        tower = Tower(5, 5, "damage_aura", tower_data=TOWER_DATA.get("damage_aura", {}))
        assert tower.aura is not None
        assert tower.aura["type"] == "damage_bonus"

    def test_non_aura_tower_no_aura(self):
        tower = Tower(5, 5, "basic", tower_data=TOWER_DATA.get("basic", {}))
        assert tower.aura is None

    def test_aura_tower_no_damage(self):
        tower = Tower(5, 5, "damage_aura", tower_data=TOWER_DATA.get("damage_aura", {}))
        assert tower.damage == 0
        assert tower.range == 0

    def test_aura_tower_has_range_zero(self):
        """Aura towers should have range=0 (they don't shoot)."""
        tower = Tower(5, 5, "speed_aura", tower_data=TOWER_DATA.get("speed_aura", {}))
        assert tower.range == 0
        assert tower.cooldown == 0
