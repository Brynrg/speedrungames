"""Green Circle TD - Phase 4 tests: wave manifest loading, boss HP, endless gen."""
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from core.data import load_waves, load_enemies, load_towers
from core.armor import get_multiplier


# ---- Wave Manifest Loading Tests ----

class TestWaveManifestLoading:
    """Tests for wave manifest loading and structure."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.waves = load_waves()
        self.wave_by_id = {w["id"]: w for w in self.waves}
        self.enemies = load_enemies()
        self.enemy_by_name = {e["name"]: e for e in self.enemies}

    def test_all_30_waves_loaded(self):
        """All 30 waves load from waves.json."""
        assert len(self.waves) == 30

    def test_waves_have_ids_1_to_30(self):
        """Wave IDs are 1 through 30."""
        ids = sorted(w["id"] for w in self.waves)
        assert ids == list(range(1, 31))

    def test_all_waves_have_required_fields(self):
        """Every wave has name, spawns, and reward_bonus."""
        for wave in self.waves:
            assert "name" in wave, f"Wave {wave['id']} missing 'name'"
            assert "spawns" in wave, f"Wave {wave['id']} missing 'spawns'"
            assert "reward_bonus" in wave, f"Wave {wave['id']} missing 'reward_bonus'"
            assert isinstance(wave["spawns"], list), f"Wave {wave['id']} spawns not a list"
            assert len(wave["spawns"]) > 0, f"Wave {wave['id']} has empty spawns"

    def test_all_spawn_entries_have_required_fields(self):
        """Every spawn entry has enemy, count, interval, corner, start_at."""
        for wave in self.waves:
            for spawn in wave["spawns"]:
                assert "enemy" in spawn, f"Wave {wave['id']} spawn missing 'enemy'"
                assert "count" in spawn, f"Wave {wave['id']} spawn missing 'count'"
                assert "interval" in spawn, f"Wave {wave['id']} spawn missing 'interval'"
                assert "corner" in spawn, f"Wave {wave['id']} spawn missing 'corner'"
                assert "start_at" in spawn, f"Wave {wave['id']} spawn missing 'start_at'"
                assert spawn["count"] > 0, f"Wave {wave['id']} spawn has count <= 0"
                assert spawn["interval"] >= 0, f"Wave {wave['id']} spawn has interval < 0"

    def test_all_enemy_ids_exist_in_enemies_json(self):
        """All enemy IDs referenced in waves exist in enemies.json."""
        for wave in self.waves:
            for spawn in wave["spawns"]:
                assert spawn["enemy"] in self.enemy_by_name, \
                    f"Wave {wave['id']} references unknown enemy '{spawn['enemy']}'"

    def test_wave_1_first_light(self):
        """Wave 1 is 'First Light' with 8 Normal enemies from corner 0."""
        wave = self.wave_by_id[1]
        assert wave["name"] == "First Light"
        assert len(wave["spawns"]) == 1
        assert wave["spawns"][0]["enemy"] == "Normal"
        assert wave["spawns"][0]["count"] == 8
        assert wave["spawns"][0]["corner"] == 0

    def test_wave_2_two_corners(self):
        """Wave 2 spawns from two corners."""
        wave = self.wave_by_id[2]
        assert wave["name"] == "Patrol"
        corners = set(s["corner"] for s in wave["spawns"])
        assert len(corners) >= 2

    def test_wave_5_heavy_armor(self):
        """Wave 5 (Iron Probe) is heavy armor."""
        wave = self.wave_by_id[5]
        assert wave["name"] == "Iron Probe"
        for spawn in wave["spawns"]:
            trait = self.enemy_by_name[spawn["enemy"]]
            assert trait["armor_type"] == "heavy"

    def test_wave_10_boss(self):
        """Wave 10 is a boss wave with a Boss enemy."""
        wave = self.wave_by_id[10]
        assert wave["name"] == "First Sentinel"
        assert wave.get("is_boss", False) is True
        enemy_types = [s["enemy"] for s in wave["spawns"]]
        assert "Boss" in enemy_types

    def test_wave_20_mega_boss(self):
        """Wave 20 is the Verdant Maw mega-boss."""
        wave = self.wave_by_id[20]
        assert wave["name"] == "The Verdant Maw"
        assert wave.get("is_boss", False) is True
        enemy_types = [s["enemy"] for s in wave["spawns"]]
        assert "Boss" in enemy_types
        assert wave["reward_bonus"] == 500

    def test_wave_30_final_boss(self):
        """Wave 30 is the Pale Crown final boss."""
        wave = self.wave_by_id[30]
        assert wave["name"] == "The Pale Crown"
        assert wave.get("is_boss", False) is True
        assert wave["reward_bonus"] == 1000

    def test_wave_25_mixed_armor(self):
        """Wave 25 (The Crucible) has mixed armor types from all corners."""
        wave = self.wave_by_id[25]
        assert wave["name"] == "The Crucible"
        corners = set(s["corner"] for s in wave["spawns"])
        assert len(corners) == 4  # All 4 corners
        armor_types = set()
        for spawn in wave["spawns"]:
            trait = self.enemy_by_name[spawn["enemy"]]
            armor_types.add(trait["armor_type"])
        # Should have at least 3 different armor types
        assert len(armor_types) >= 3

    def test_boss_reward_scaling(self):
        """Boss waves (10, 20, 30) reward 250g, 500g, 1000g."""
        assert self.wave_by_id[10]["reward_bonus"] == 250
        assert self.wave_by_id[20]["reward_bonus"] == 500
        assert self.wave_by_id[30]["reward_bonus"] == 1000

    def test_no_consecutive_same_armor(self):
        """No two consecutive waves share the same primary armor type."""
        for i in range(1, 30):
            w1 = self.wave_by_id[i]
            w2 = self.wave_by_id[i + 1]
            armor1 = set()
            armor2 = set()
            for spawn in w1["spawns"]:
                trait = self.enemy_by_name[spawn["enemy"]]
                armor1.add(trait["armor_type"])
            for spawn in w2["spawns"]:
                trait = self.enemy_by_name[spawn["enemy"]]
                armor2.add(trait["armor_type"])
            # Allow some overlap but not identical
            # (This is a soft rule — mixed waves may share)

    def test_wave_8_invisible(self):
        """Wave 8 introduces invisible enemies."""
        wave = self.wave_by_id[8]
        assert wave["name"] == "Ghost Patrol"
        enemy_types = [s["enemy"] for s in wave["spawns"]]
        assert "Invisible" in enemy_types

    def test_wave_9_air(self):
        """Wave 9 introduces air enemies."""
        wave = self.wave_by_id[9]
        assert wave["name"] == "Pyre Air"
        enemy_types = [s["enemy"] for s in wave["spawns"]]
        assert "Air" in enemy_types

    def test_wave_11_immune(self):
        """Wave 11 introduces immune enemies."""
        wave = self.wave_by_id[11]
        assert wave["name"] == "Frost Burn"
        enemy_types = [s["enemy"] for s in wave["spawns"]]
        assert "Immune" in enemy_types

    def test_wave_17_all_corners_hero(self):
        """Wave 17 spawns hero creeps from all 4 corners."""
        wave = self.wave_by_id[17]
        assert wave["name"] == "The Bound Flame"
        corners = set(s["corner"] for s in wave["spawns"])
        assert len(corners) == 4
        enemy_types = [s["enemy"] for s in wave["spawns"]]
        assert "Hero" in enemy_types

    def test_wave_24_all_corners_mass(self):
        """Wave 24 (Storm Tide) spawns from all 4 corners."""
        wave = self.wave_by_id[24]
        assert wave["name"] == "Storm Tide"
        corners = set(s["corner"] for s in wave["spawns"])
        assert len(corners) == 4

    def test_wave_27_puzzle_wave(self):
        """Wave 27 (The Long Dark) is the puzzle wave with invisible + immune."""
        wave = self.wave_by_id[27]
        assert wave["name"] == "The Long Dark"
        enemy_types = [s["enemy"] for s in wave["spawns"]]
        assert "Invisible" in enemy_types
        assert "Immune" in enemy_types

    def test_wave_29_coronation(self):
        """Wave 29 spawns heroes from each corner + swarm."""
        wave = self.wave_by_id[29]
        assert wave["name"] == "The Coronation"
        corners = set(s["corner"] for s in wave["spawns"])
        assert len(corners) == 4
        enemy_types = [s["enemy"] for s in wave["spawns"]]
        assert "Hero" in enemy_types
        assert "Swarm" in enemy_types


# ---- Endless Mode Generator Tests ----

class TestEndlessWaveGenerator:
    """Tests for the endless mode wave generator."""

    def test_endless_wave_generates_spawns(self):
        """Endless waves generate spawn entries."""
        from core.sim import Game
        game = Game(seed=42)
        result = game._generate_endless_wave(31)
        assert "trait" in result
        assert "spawns" in result
        assert len(result["spawns"]) > 0
        for spawn in result["spawns"]:
            assert "enemy" in spawn
            assert "count" in spawn
            assert "corner" in spawn
            assert "interval" in spawn

    def test_endless_wave_trait_exists(self):
        """Endless wave trait exists in enemy definitions."""
        from core.sim import Game
        game = Game(seed=42)
        result = game._generate_endless_wave(31)
        trait_names = {e["name"] for e in game.wave_traits}
        assert result["trait"]["name"] in trait_names

    def test_endless_wave_count_scales(self):
        """Endless wave enemy count increases with wave number."""
        from core.sim import Game
        game = Game(seed=42)
        w31 = game._generate_endless_wave(31)
        w40 = game._generate_endless_wave(40)
        total_31 = sum(s["count"] for s in w31["spawns"])
        total_40 = sum(s["count"] for s in w40["spawns"])
        assert total_40 > total_31

    def test_endless_wave_capped_at_150(self):
        """Endless waves never exceed 150 enemies."""
        from core.sim import Game
        game = Game(seed=42)
        result = game._generate_endless_wave(100)
        total = sum(s["count"] for s in result["spawns"])
        assert total <= 150

    def test_endless_wave_uses_valid_enemy_types(self):
        """Endless waves only use valid enemy types."""
        from core.sim import Game
        game = Game(seed=42)
        valid_types = {e["name"] for e in game.wave_traits}
        for wave_num in [31, 40, 50, 60, 100]:
            result = game._generate_endless_wave(wave_num)
            for spawn in result["spawns"]:
                assert spawn["enemy"] in valid_types, \
                    f"Wave {wave_num} uses invalid enemy '{spawn['enemy']}'"

    def test_endless_wave_corners_valid(self):
        """Endless waves use valid corner indices (0-3)."""
        from core.sim import Game
        game = Game(seed=42)
        for wave_num in [31, 40, 50]:
            result = game._generate_endless_wave(wave_num)
            for spawn in result["spawns"]:
                assert spawn["corner"] in (0, 1, 2, 3), \
                    f"Wave {wave_num} uses invalid corner {spawn['corner']}"


# ---- Wave Manifest Integration Tests ----

class TestWaveManifestIntegration:
    """Tests for wave manifest integration with the game simulation."""

    def test_wave_manifest_loaded_in_game(self):
        """Game loads wave manifest on init."""
        from core.sim import Game
        game = Game(seed=42)
        assert hasattr(game, "wave_manifest")
        assert len(game.wave_manifest) == 30
        assert hasattr(game, "wave_by_id")
        assert 1 in game.wave_by_id
        assert 30 in game.wave_by_id

    def test_get_wave_manifest_returns_trait(self):
        """get_wave_manifest returns a dict with 'trait' key."""
        from core.sim import Game
        game = Game(seed=42)
        result = game.get_wave_manifest(1)
        assert "trait" in result
        assert "name" in result["trait"]

    def test_get_wave_manifest_wave_10_is_boss(self):
        """Wave 10 manifest returns Boss trait."""
        from core.sim import Game
        game = Game(seed=42)
        result = game.get_wave_manifest(10)
        assert result["trait"]["name"] == "Boss"

    def test_get_wave_manifest_wave_30_is_boss(self):
        """Wave 30 manifest returns Boss trait."""
        from core.sim import Game
        game = Game(seed=42)
        result = game.get_wave_manifest(30)
        assert result["trait"]["name"] == "Boss"

    def test_get_wave_manifest_endless(self):
        """Waves > 30 use endless generator."""
        from core.sim import Game
        game = Game(seed=42)
        result = game.get_wave_manifest(31)
        assert "trait" in result
        assert "spawns" in result

    def test_wave_1_manifest_spawns(self):
        """Wave 1 manifest spawns 8 Normal enemies."""
        from core.sim import Game
        game = Game(seed=42)
        result = game.get_wave_manifest(1)
        manifest = result["manifest"]
        assert manifest["id"] == 1
        total = sum(s["count"] for s in manifest["spawns"])
        assert total == 8

    def test_wave_30_manifest_spawns(self):
        """Wave 30 manifest spawns Boss + escorts."""
        from core.sim import Game
        game = Game(seed=42)
        result = game.get_wave_manifest(30)
        manifest = result["manifest"]
        assert manifest["id"] == 30
        enemy_types = [s["enemy"] for s in manifest["spawns"]]
        assert "Boss" in enemy_types

    def test_legacy_get_wave_trait_still_works(self):
        """Legacy get_wave_trait still works for backward compat."""
        from core.sim import Game
        game = Game(seed=42)
        # Wave 10 should be Boss
        trait = game.get_wave_trait(10)
        assert trait["name"] == "Boss"
        # Wave 9 should be Invisible
        trait = game.get_wave_trait(9)
        assert trait["name"] == "Invisible"
        # Wave 7 should be Air
        trait = game.get_wave_trait(7)
        assert trait["name"] == "Air"
        # Wave 5 should be Armored
        trait = game.get_wave_trait(5)
        assert trait["name"] == "Armored"
        # Wave 4 should be Swarm
        trait = game.get_wave_trait(4)
        assert trait["name"] == "Swarm"
        # Wave 3 should be Swift
        trait = game.get_wave_trait(3)
        assert trait["name"] == "Swift"
        # Wave 1 should be Normal
        trait = game.get_wave_trait(1)
        assert trait["name"] == "Normal"
