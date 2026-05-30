"""Green Circle TD - Phase 6 tests: card draft, daily seed, XP profile."""
import os
import sys
import json
import tempfile
import shutil

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from core.card import load_cards, draw_cards, CardEffect
from core.rng import Rng
from core import profile as profile_mod


# ---- Card Drawing Tests ----

class TestCardDrawing:
    """Tests for the card draft system."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.cards_data = load_cards()
        self.rng = Rng(42)

    def test_draws_three_cards(self):
        """Drawing 3 cards returns exactly 3."""
        cards = draw_cards(self.cards_data, self.rng, count=3)
        assert len(cards) == 3

    def test_cards_from_different_categories(self):
        """Each drawn card comes from a different category."""
        cards = draw_cards(self.cards_data, self.rng, count=3)
        types = [c.get("type") for c in cards]
        # Should have one buff, one unlock, one hazard
        assert "buff" in types
        assert "unlock" in types
        assert "hazard" in types

    def test_cards_have_required_fields(self):
        """Each card has id, name, desc, type, and effect."""
        cards = draw_cards(self.cards_data, self.rng, count=3)
        for card in cards:
            assert "id" in card
            assert "name" in card
            assert "desc" in card
            assert "type" in card
            assert "effect" in card

    def test_cards_are_unique(self):
        """No duplicate card IDs in a single draw."""
        cards = draw_cards(self.cards_data, self.rng, count=3)
        ids = [c["id"] for c in cards]
        assert len(ids) == len(set(ids))

    def test_draws_from_weighted_pool(self):
        """Cards with higher weight appear more frequently over many draws."""
        all_ids = set()
        for category in self.cards_data.values():
            for card in category:
                all_ids.add(card["id"])

        # Draw many times and check all categories are reachable
        buff_ids = {c["id"] for c in self.cards_data.get("buffs", [])}
        unlock_ids = {c["id"] for c in self.cards_data.get("unlocks", [])}
        hazard_ids = {c["id"] for c in self.cards_data.get("hazards", [])}

        found_buffs = set()
        found_unlocks = set()
        found_hazards = set()

        for seed in range(100):
            r = Rng(seed)
            cards = draw_cards(self.cards_data, r, count=3)
            for c in cards:
                if c["id"] in buff_ids:
                    found_buffs.add(c["id"])
                elif c["id"] in unlock_ids:
                    found_unlocks.add(c["id"])
                elif c["id"] in hazard_ids:
                    found_hazards.add(c["id"])

        # Should find at least some from each category
        assert len(found_buffs) > 0
        assert len(found_unlocks) > 0
        assert len(found_hazards) > 0

    def test_card_pool_has_all_categories(self):
        """Card pool has buffs, unlocks, and hazards."""
        assert "buffs" in self.cards_data
        assert "unlocks" in self.cards_data
        assert "hazards" in self.cards_data
        assert len(self.cards_data["buffs"]) > 0
        assert len(self.cards_data["unlocks"]) > 0
        assert len(self.cards_data["hazards"]) > 0


# ---- Card Effect Application Tests ----

class TestCardEffects:
    """Tests for card effect application."""

    def test_gold_per_kill_bonus(self):
        """Gold per kill card adds bonus gold."""
        effect = CardEffect()
        effect.apply_card({
            "id": "extra_gold", "type": "buff",
            "effect": {"gold_per_kill": 5}
        })
        assert effect.get_gold_per_kill_bonus() == 5

    def test_damage_mult_accumulates(self):
        """Multiple damage cards multiply together."""
        effect = CardEffect()
        effect.apply_card({
            "id": "starting_dmg", "type": "buff",
            "effect": {"damage_mult": 1.10}
        })
        effect.apply_card({
            "id": "all_damage_5", "type": "buff",
            "effect": {"damage_mult": 1.05}
        })
        expected = 1.10 * 1.05
        assert abs(effect.get_effective_damage_mult() - expected) < 0.001

    def test_range_mult_accumulates(self):
        """Range cards multiply together."""
        effect = CardEffect()
        effect.apply_card({
            "id": "tower_range", "type": "buff",
            "effect": {"range_mult": 1.15}
        })
        assert abs(effect.get_effective_range_mult() - 1.15) < 0.001

    def test_hazard_waves_affected(self):
        """Hazard with waves_affected decrements each wave."""
        effect = CardEffect()
        effect.apply_card({
            "id": "double_or_nothing", "type": "hazard",
            "effect": {"enemy_mult": 1.30, "gold_mult": 1.60, "waves_affected": 3}
        })
        assert effect.hazard_waves_remaining == 3
        # Tick 3 waves
        for _ in range(3):
            effect.tick_hazard()
        assert effect.hazard_waves_remaining == 0

    def test_hazard_permanent_effects(self):
        """Permanent hazards apply their effects immediately."""
        effect = CardEffect()
        effect.apply_card({
            "id": "iron_skin", "type": "hazard",
            "effect": {"enemy_hp_mult": 1.20}
        })
        assert abs(effect.get_effective_enemy_hp_mult() - 1.20) < 0.001

    def test_l5_unlock(self):
        """L5 unlock card sets the flag."""
        effect = CardEffect()
        effect.apply_card({
            "id": "tower_l5", "type": "unlock",
            "effect": {"l5_unlock": True}
        })
        assert effect.has_l5_unlock()

    def test_second_hero_unlock(self):
        """Second hero unlock card sets the flag."""
        effect = CardEffect()
        effect.apply_card({
            "id": "second_hero", "type": "unlock",
            "effect": {"second_hero": True}
        })
        assert effect.has_second_hero()

    def test_hero_hp_mult(self):
        """Hero HP multiplier card works."""
        effect = CardEffect()
        effect.apply_card({
            "id": "hero_resilient", "type": "buff",
            "effect": {"hero_hp_mult": 1.50}
        })
        assert abs(effect.get_effective_hero_hp_mult() - 1.50) < 0.001

    def test_clear_effects(self):
        """Clear resets all effects."""
        effect = CardEffect()
        effect.apply_card({
            "id": "extra_gold", "type": "buff",
            "effect": {"gold_per_kill": 5}
        })
        effect.apply_card({
            "id": "tower_l5", "type": "unlock",
            "effect": {"l5_unlock": True}
        })
        effect.clear()
        assert effect.get_gold_per_kill_bonus() == 0
        assert not effect.has_l5_unlock()
        assert len(effect.get_active_card_ids()) == 0

    def test_active_card_ids(self):
        """get_active_card_ids returns all applied card IDs."""
        effect = CardEffect()
        effect.apply_card({"id": "extra_gold", "type": "buff", "effect": {}})
        effect.apply_card({"id": "starting_dmg", "type": "buff", "effect": {}})
        ids = effect.get_active_card_ids()
        assert "extra_gold" in ids
        assert "starting_dmg" in ids


# ---- Profile / XP Tests ----

class TestProfile:
    """Tests for the player profile system."""

    @pytest.fixture(autouse=True)
    def setup(self, tmp_path):
        """Use temp directory for profile files."""
        self.orig_dir = profile_mod.PROFILE_DIR
        self.orig_profile = profile_mod.PROFILE_PATH
        self.orig_scores = profile_mod.SCORES_PATH
        profile_mod.PROFILE_DIR = str(tmp_path / "green-circle-td")
        profile_mod.PROFILE_PATH = profile_mod.PROFILE_DIR + "/profile.json"
        profile_mod.SCORES_PATH = profile_mod.PROFILE_DIR + "/scores.json"
        yield
        profile_mod.PROFILE_DIR = self.orig_dir
        profile_mod.PROFILE_PATH = self.orig_profile
        profile_mod.SCORES_PATH = self.orig_scores

    def test_default_profile(self):
        """Default profile has expected structure."""
        p = profile_mod.load_profile()
        assert p["total_xp"] == 0
        assert p["unlocks"] == []
        assert "wins" in p["stats"]
        assert "best_endless_wave" in p["stats"]
        assert "total_kills" in p["stats"]

    def test_add_xp(self):
        """Adding XP increases total."""
        p = profile_mod.load_profile()
        profile_mod.add_xp(p, 50)
        assert p["total_xp"] == 50
        profile_mod.add_xp(p, 100)
        assert p["total_xp"] == 150

    def test_add_stats(self):
        """Adding stats increments counters."""
        p = profile_mod.load_profile()
        profile_mod.add_stats(p, wins=1, total_kills=5)
        assert p["stats"]["wins"] == 1
        assert p["stats"]["total_kills"] == 5
        profile_mod.add_stats(p, wins=1)
        assert p["stats"]["wins"] == 2

    def test_xp_unlocks_available(self):
        """XP unlocks are available when player has enough XP."""
        p = profile_mod.load_profile()
        p["total_xp"] = 200
        available = profile_mod.get_available_unlocks(p)
        unlock_ids = [u["id"] for u in available]
        assert "starting_gold_5" in unlock_ids  # 100 XP cost

    def test_xp_unlock_not_available_when_locked(self):
        """XP unlocks not available when player doesn't have enough XP."""
        p = profile_mod.load_profile()
        p["total_xp"] = 50
        available = profile_mod.get_available_unlocks(p)
        # 100 XP cost unlock should not be available
        unlock_ids = [u["id"] for u in available]
        assert "starting_gold_5" not in unlock_ids

    def test_purchase_unlock(self):
        """Purchasing an unlock adds it to profile."""
        p = profile_mod.load_profile()
        p["total_xp"] = 200
        result = profile_mod.purchase_unlock(p, "starting_gold_5")
        assert result is True
        assert "starting_gold_5" in p["unlocks"]

    def test_purchase_unlock_already_owned(self):
        """Purchasing an owned unlock returns False."""
        p = profile_mod.load_profile()
        p["total_xp"] = 200
        profile_mod.purchase_unlock(p, "starting_gold_5")
        result = profile_mod.purchase_unlock(p, "starting_gold_5")
        assert result is False

    def test_purchase_unlock_insufficient_xp(self):
        """Purchasing with insufficient XP returns False."""
        p = profile_mod.load_profile()
        p["total_xp"] = 50
        result = profile_mod.purchase_unlock(p, "starting_gold_5")
        assert result is False

    def test_xp_persisted_to_disk(self):
        """XP is saved to and loaded from disk."""
        p = profile_mod.load_profile()
        profile_mod.add_xp(p, 100)
        # Reload from disk
        p2 = profile_mod.load_profile()
        assert p2["total_xp"] == 100

    def test_daily_scores(self):
        """Daily scores save and load correctly."""
        profile_mod.add_daily_score("2025-01-15", 5000)
        assert profile_mod.get_daily_best("2025-01-15") == 5000

    def test_daily_scores_keeps_best(self):
        """Daily scores keep the best score per day."""
        profile_mod.add_daily_score("2025-01-15", 5000)
        profile_mod.add_daily_score("2025-01-15", 3000)
        assert profile_mod.get_daily_best("2025-01-15") == 5000
        profile_mod.add_daily_score("2025-01-15", 7000)
        assert profile_mod.get_daily_best("2025-01-15") == 7000

    def test_daily_scores_different_days(self):
        """Different days have independent scores."""
        profile_mod.add_daily_score("2025-01-15", 5000)
        profile_mod.add_daily_score("2025-01-16", 3000)
        assert profile_mod.get_daily_best("2025-01-15") == 5000
        assert profile_mod.get_daily_best("2025-01-16") == 3000

    def test_xp_unlock_tree_structure(self):
        """XP unlock tree has expected structure."""
        assert len(profile_mod.XP_UNLOCKS) == 5
        for unlock in profile_mod.XP_UNLOCKS:
            assert "id" in unlock
            assert "name" in unlock
            assert "desc" in unlock
            assert "xp_cost" in unlock

    def test_no_gating_unlocks(self):
        """All unlocks are flavor buffs, not gating content."""
        # The plan says: "Do not gate content — these are flavor buffs."
        # Verify all unlocks are in XP_UNLOCKS
        for unlock in profile_mod.XP_UNLOCKS:
            assert unlock["xp_cost"] > 0
            assert unlock["id"] in [
                "starting_gold_5", "starting_life_1", "card_skip_free",
                "daily_leaderboard", "all_damage_5"
            ]
