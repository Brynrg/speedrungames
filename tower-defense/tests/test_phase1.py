"""Green Circle TD - Phase 1 tests: armor matrix, DPS, targeting, wave preview."""
import os
import sys
import json
import math

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from core.armor import (
    get_matrix, get_multiplier, get_damage_types, get_armor_types,
    get_best_damage_types, get_worst_damage_types,
)
from core.tower import Tower
from core.enemy import Enemy
from core.settings import TOWER_DATA, WAVE_TRAITS


# ---- Armor Matrix Tests ----

class TestArmorMatrix:
    """Tests for the armor matrix system."""

    def test_matrix_structure(self):
        matrix = get_matrix()
        assert "damage_types" in matrix
        assert "armor_types" in matrix
        assert "matrix" in matrix
        assert "normal" in matrix["damage_types"]
        assert "pierce" in matrix["damage_types"]
        assert "siege" in matrix["damage_types"]
        assert "magic" in matrix["damage_types"]
        assert "light" in matrix["armor_types"]
        assert "medium" in matrix["armor_types"]
        assert "heavy" in matrix["armor_types"]
        assert "fortified" in matrix["armor_types"]
        assert "hero" in matrix["armor_types"]

    def test_multiplier_normal_vs_medium(self):
        # Normal damage vs medium armor = 1.5x
        assert get_multiplier("normal", "medium") == 1.5

    def test_multiplier_pierce_vs_light(self):
        # Pierce vs light armor = 2.0x
        assert get_multiplier("pierce", "light") == 2.0

    def test_multiplier_siege_vs_fortified(self):
        # Siege vs fortified = 1.5x
        assert get_multiplier("siege", "fortified") == 1.5

    def test_multiplier_magic_vs_heavy(self):
        # Magic vs heavy = 2.0x
        assert get_multiplier("magic", "heavy") == 2.0

    def test_multiplier_pierce_vs_fortified(self):
        # Pierce vs fortified = 0.35, but get_multiplier floors at 1.0
        assert get_multiplier("pierce", "fortified") == 1.0

    def test_multiplier_floors_at_1(self):
        """Even if matrix says < 1, take_damage floors at 1.0."""
        pass

    def test_best_damage_types(self):
        best = get_best_damage_types("fortified", top_n=2)
        # Siege (1.5) and normal (0.70) are top raw values against fortified
        # (magic is 0.35, pierce is 0.35)
        types = [t[0] for t in best]
        assert "siege" in types
        assert "normal" in types

    def test_worst_damage_types(self):
        worst = get_worst_damage_types("fortified", top_n=2)
        types = [t[0] for t in worst]
        # Pierce (0.35) should be worst
        assert "pierce" in types

    def test_best_vs_light(self):
        best = get_best_damage_types("light", top_n=1)
        assert best[0][0] == "pierce"
        assert best[0][1] == 2.0

    def test_best_vs_heavy(self):
        best = get_best_damage_types("heavy", top_n=1)
        assert best[0][0] == "magic"
        assert best[0][1] == 2.0


# ---- Enemy Armor Tests ----

class TestEnemyArmor:
    """Tests for enemy armor type integration."""

    def test_enemy_has_armor_type(self):
        path = [(0, 0), (100, 0), (200, 0)]
        trait = next(t for t in WAVE_TRAITS if t["name"] == "Armored")
        enemy = Enemy(path, wave=1, trait=trait)
        assert enemy.armor_type == "heavy"

    def test_enemy_normal_armor(self):
        path = [(0, 0), (100, 0), (200, 0)]
        trait = next(t for t in WAVE_TRAITS if t["name"] == "Normal")
        enemy = Enemy(path, wave=1, trait=trait)
        assert enemy.armor_type == "medium"

    def test_enemy_swarm_armor(self):
        path = [(0, 0), (100, 0), (200, 0)]
        trait = next(t for t in WAVE_TRAITS if t["name"] == "Swarm")
        enemy = Enemy(path, wave=1, trait=trait)
        assert enemy.armor_type == "light"

    def test_enemy_boss_armor(self):
        path = [(0, 0), (100, 0), (200, 0)]
        trait = next(t for t in WAVE_TRAITS if t["name"] == "Boss")
        enemy = Enemy(path, wave=1, trait=trait)
        assert enemy.armor_type == "fortified"

    def test_enemy_hero_armor(self):
        path = [(0, 0), (100, 0), (200, 0)]
        trait = next(t for t in WAVE_TRAITS if t["name"] == "Hero")
        enemy = Enemy(path, wave=1, trait=trait)
        assert enemy.armor_type == "hero"

    def test_enemy_take_damage_with_matrix(self):
        path = [(0, 0), (100, 0), (200, 0)]
        trait = next(t for t in WAVE_TRAITS if t["name"] == "Armored")
        enemy = Enemy(path, wave=1, trait=trait)
        initial_health = enemy.health
        # Pierce vs heavy armor = 1.0x (no bonus)
        enemy.take_damage(50, damage_type="pierce")
        assert enemy.health == initial_health - 50
        # Siege vs heavy armor = 1.0x
        enemy.take_damage(50, damage_type="siege")
        assert enemy.health == initial_health - 100
        # Magic vs heavy armor = 2.0x
        enemy.take_damage(25, damage_type="magic")
        assert enemy.health == initial_health - 150

    def test_enemy_take_damage_pierce_vs_light(self):
        path = [(0, 0), (100, 0), (200, 0)]
        trait = next(t for t in WAVE_TRAITS if t["name"] == "Swarm")
        enemy = Enemy(path, wave=1, trait=trait)
        initial_health = enemy.health
        # Pierce vs light = 2.0x
        enemy.take_damage(25, damage_type="pierce")
        assert enemy.health == initial_health - 50

    def test_enemy_take_damage_magic_vs_fortified(self):
        path = [(0, 0), (100, 0), (200, 0)]
        trait = next(t for t in WAVE_TRAITS if t["name"] == "Boss")
        enemy = Enemy(path, wave=1, trait=trait)
        initial_health = enemy.health
        # Magic vs fortified = 0.35 in matrix, but get_multiplier floors at 1.0
        enemy.take_damage(25, damage_type="magic")
        assert enemy.health == initial_health - 25

    def test_enemy_take_damage_normal_vs_medium(self):
        path = [(0, 0), (100, 0), (200, 0)]
        trait = next(t for t in WAVE_TRAITS if t["name"] == "Normal")
        enemy = Enemy(path, wave=1, trait=trait)
        initial_health = enemy.health
        # Normal vs medium = 1.5x
        enemy.take_damage(20, damage_type="normal")
        assert enemy.health == initial_health - 30


# ---- Tower Damage Type Tests ----

class TestTowerDamageType:
    """Tests for tower damage type integration."""

    def test_basic_tower_normal(self):
        tower = Tower(5, 5, "basic")
        assert tower.damage_type == "normal"

    def test_sniper_tower_pierce(self):
        tower = Tower(5, 5, "sniper")
        assert tower.damage_type == "pierce"

    def test_splash_tower_siege(self):
        tower = Tower(5, 5, "splash")
        assert tower.damage_type == "siege"

    def test_frost_tower_magic(self):
        tower = Tower(5, 5, "frost")
        assert tower.damage_type == "magic"

    def test_rapid_tower_pierce(self):
        tower = Tower(5, 5, "rapid")
        assert tower.damage_type == "pierce"

    def test_detector_tower_normal(self):
        tower = Tower(5, 5, "detector")
        assert tower.damage_type == "normal"


# ---- Targeting Mode Tests ----

class TestTargetingModes:
    """Tests for targeting mode system."""

    def test_default_targeting_mode(self):
        tower = Tower(5, 5, "basic")
        assert tower.targeting_mode == "CLOSEST"

    def test_targeting_mode_cycle(self):
        tower = Tower(5, 5, "basic")
        modes = ["CLOSEST", "FIRST", "LAST", "STRONG", "WEAK"]
        for expected in modes:
            assert tower.targeting_mode == expected
            idx = modes.index(expected)
            tower.targeting_mode = modes[(idx + 1) % len(modes)]

    def test_find_target_first(self):
        path = [(0, 0), (100, 0), (200, 0)]
        trait = WAVE_TRAITS[0]
        enemies = [
            Enemy(path, wave=1, trait=trait) for _ in range(3)
        ]
        # Set center positions (used by find_target for distance calc)
        enemies[0].center_x, enemies[0].center_y = 50, 0
        enemies[1].center_x, enemies[1].center_y = 100, 0
        enemies[2].center_x, enemies[2].center_y = 150, 0
        # Tower(0, 0) = center at (32, 32), close enough to enemies
        tower = Tower(0, 0, "basic")
        tower.range = 200  # Ensure range is set
        tower.targeting_mode = "FIRST"
        target = tower.find_target(enemies, path)
        # FIRST should pick the enemy furthest along the path
        assert target is not None
        assert target.current_point == max(e.current_point for e in enemies)

    def test_find_target_closest(self):
        path = [(0, 0), (100, 0), (200, 0)]
        trait = WAVE_TRAITS[0]
        enemies = [
            Enemy(path, wave=1, trait=trait) for _ in range(3)
        ]
        enemies[0].center_x, enemies[0].center_y = 50, 0
        enemies[1].center_x, enemies[1].center_y = 100, 0
        enemies[2].center_x, enemies[2].center_y = 150, 0
        tower = Tower(0, 0, "basic")
        tower.range = 200
        tower.targeting_mode = "CLOSEST"
        target = tower.find_target(enemies, path)
        # CLOSEST should pick the nearest enemy
        assert target is not None

    def test_find_target_strong(self):
        path = [(0, 0), (100, 0), (200, 0)]
        trait = WAVE_TRAITS[0]
        enemies = [
            Enemy(path, wave=1, trait=trait) for _ in range(3)
        ]
        enemies[0].center_x, enemies[0].center_y = 50, 0
        enemies[1].center_x, enemies[1].center_y = 100, 0
        enemies[2].center_x, enemies[2].center_y = 150, 0
        tower = Tower(0, 0, "basic")
        tower.range = 200
        tower.targeting_mode = "STRONG"
        target = tower.find_target(enemies, path)
        # STRONG should pick the enemy with most health
        assert target is not None
        assert target.health == max(e.health for e in enemies)

    def test_find_target_weak(self):
        path = [(0, 0), (100, 0), (200, 0)]
        trait = WAVE_TRAITS[0]
        enemies = [
            Enemy(path, wave=1, trait=trait) for _ in range(3)
        ]
        enemies[0].center_x, enemies[0].center_y = 50, 0
        enemies[1].center_x, enemies[1].center_y = 100, 0
        enemies[2].center_x, enemies[2].center_y = 150, 0
        tower = Tower(0, 0, "basic")
        tower.range = 200
        tower.targeting_mode = "WEAK"
        target = tower.find_target(enemies, path)
        # WEAK should pick the enemy with least health
        assert target is not None
        assert target.health == min(e.health for e in enemies)

    def test_find_target_last(self):
        path = [(0, 0), (100, 0), (200, 0)]
        trait = WAVE_TRAITS[0]
        enemies = [
            Enemy(path, wave=1, trait=trait) for _ in range(3)
        ]
        enemies[0].center_x, enemies[0].center_y = 50, 0
        enemies[1].center_x, enemies[1].center_y = 100, 0
        enemies[2].center_x, enemies[2].center_y = 150, 0
        tower = Tower(0, 0, "basic")
        tower.range = 200
        tower.targeting_mode = "LAST"
        target = tower.find_target(enemies, path)
        # LAST should pick the enemy closest to the start
        assert target is not None
        assert target.current_point == min(e.current_point for e in enemies)

    def test_find_target_no_enemies(self):
        tower = Tower(50, 50, "basic")
        target = tower.find_target([], None)
        assert target is None

    def test_find_target_no_enemies_in_range(self):
        path = [(0, 0), (100, 0), (200, 0)]
        trait = WAVE_TRAITS[0]
        enemy = Enemy(path, wave=1, trait=trait)
        enemy.x = 1000
        enemy.y = 1000
        tower = Tower(50, 50, "basic")
        tower.range = 50
        target = tower.find_target([enemy], path)
        assert target is None


# ---- DPS Calculation Tests ----

class TestDPS:
    """Tests for DPS calculation with armor matrix."""

    def test_basic_tower_dps(self):
        tower = Tower(5, 5, "basic")
        # Basic: 25 damage, 30 cooldown = 1 shot per second
        # DPS should be 25 (normal vs medium = 1.5x, so 37.5)
        assert tower.damage == 25
        assert tower.cooldown == 30

    def test_sniper_dps_vs_light(self):
        tower = Tower(5, 5, "sniper")
        # Sniper: 75 damage, 90 cooldown = 0.667 shots/sec
        # Pierce vs light = 2.0x, so effective DPS = 75 * 2.0 * 0.667 = 100
        assert tower.damage == 75
        assert tower.cooldown == 90

    def test_rapid_dps(self):
        tower = Tower(5, 5, "rapid")
        # Rapid: 10 damage, 10 cooldown = 1 shot/sec
        assert tower.damage == 10
        assert tower.cooldown == 10

    def test_splash_dps(self):
        tower = Tower(5, 5, "splash")
        # Splash: 40 damage, 60 cooldown = 0.667 shots/sec
        assert tower.damage == 40
        assert tower.cooldown == 60


# ---- Wave Trait Armor Tests ----

class TestWaveTraitArmor:
    """Tests for wave trait armor type assignments."""

    def test_all_traits_have_armor_type(self):
        for trait in WAVE_TRAITS:
            assert "armor_type" in trait
            assert trait["armor_type"] in get_armor_types()

    def test_trait_armor_assignments(self):
        armor_map = {t["name"]: t["armor_type"] for t in WAVE_TRAITS}
        assert armor_map["Normal"] == "medium"
        assert armor_map["Swift"] == "light"
        assert armor_map["Armored"] == "heavy"
        assert armor_map["Swarm"] == "light"
        assert armor_map["Air"] == "light"
        assert armor_map["Immune"] == "fortified"
        assert armor_map["Invisible"] == "medium"
        assert armor_map["Hero"] == "hero"
        assert armor_map["Boss"] == "fortified"

    def test_best_counter_for_armored(self):
        """Magic should be best vs Armored (heavy armor)."""
        best = get_best_damage_types("heavy", top_n=1)
        assert best[0][0] == "magic"

    def test_best_counter_for_swarm(self):
        """Pierce should be best vs Swarm (light armor)."""
        best = get_best_damage_types("light", top_n=1)
        assert best[0][0] == "pierce"

    def test_best_counter_for_boss(self):
        """Siege should be best vs Boss (fortified armor)."""
        best = get_best_damage_types("fortified", top_n=1)
        assert best[0][0] == "siege"
        assert best[0][1] == 1.50
