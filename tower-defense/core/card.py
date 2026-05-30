"""Green Circle TD - Roguelite card draft system (Phase 6).

Cards are drawn every 3 waves. Player picks 1 of 3. Effects persist for the run.
"""
import json
import os
import random


def load_cards():
    """Load card definitions from data/cards.json."""
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    filepath = os.path.join(data_dir, "cards.json")
    with open(filepath, "r") as f:
        return json.load(f)


def draw_cards(cards_data, rng, count=3):
    """Draw 'count' unique cards from the weighted pool.

    Args:
        cards_data: Dict from load_cards() with 'buffs', 'unlocks', 'hazards'.
        rng: Rng instance for deterministic draws.
        count: Number of cards to draw (default 3).

    Returns:
        List of card dicts, one from each category (buffs, unlocks, hazards).
    """
    drawn = []
    for category in ["buffs", "unlocks", "hazards"]:
        pool = cards_data.get(category, [])
        if pool:
            weights = [c.get("weight", 1) for c in pool]
            total = sum(weights)
            # Weighted random selection using rng
            roll = rng.uniform(0, total)
            cumulative = 0
            chosen = pool[0]
            for card in pool:
                cumulative += card.get("weight", 1)
                if roll <= cumulative:
                    chosen = card
                    break
            drawn.append(dict(chosen))
    return drawn


class CardEffect:
    """Applies card effects to game state."""

    def __init__(self):
        self.active_effects = {}
        self.hazard_waves_remaining = 0
        self.enemy_hp_mult = 1.0
        self.enemy_speed_mult = 1.0
        self.gold_per_kill_bonus = 0
        self.damage_mult = 1.0
        self.range_mult = 1.0
        self.hero_hp_mult = 1.0
        self.hero_xp_mult = 1.0
        self.l5_unlock = False
        self.second_hero = False

    def apply_card(self, card):
        """Apply a card's effect to the game state.

        Args:
            card: Card dict with 'id' and 'effect' keys.
        """
        effect = card.get("effect", {})
        card_type = card.get("type", "buff")

        if card_type == "hazard":
            # Hazards have a waves_affected field
            waves = effect.get("waves_affected", 0)
            if waves > 0:
                self.hazard_waves_remaining = max(self.hazard_waves_remaining, waves)
            else:
                # Permanent hazards
                if "enemy_hp_mult" in effect:
                    self.enemy_hp_mult *= effect["enemy_hp_mult"]
                if "enemy_speed_mult" in effect:
                    self.enemy_speed_mult *= effect["enemy_speed_mult"]
        else:
            # Buffs and unlocks are permanent
            if "gold_per_kill" in effect:
                self.gold_per_kill_bonus += effect["gold_per_kill"]
            if "damage_mult" in effect:
                self.damage_mult *= effect["damage_mult"]
            if "range_mult" in effect:
                self.range_mult *= effect["range_mult"]
            if "hero_hp_mult" in effect:
                self.hero_hp_mult *= effect["hero_hp_mult"]
            if "hero_xp_mult" in effect:
                self.hero_xp_mult *= effect["hero_xp_mult"]
            if "aura_radius_mult" in effect:
                self.active_effects["aura_radius_mult"] = \
                    self.active_effects.get("aura_radius_mult", 1.0) * effect["aura_radius_mult"]
            if "crit_chance" in effect:
                self.active_effects["crit_chance"] = \
                    self.active_effects.get("crit_chance", 0.0) + effect["crit_chance"]
            if "l5_unlock" in effect:
                self.l5_unlock = True
            if "second_hero" in effect:
                self.second_hero = True

        self.active_effects[card["id"]] = card

    def tick_hazard(self):
        """Decrement hazard wave counter. Returns True if hazard expired."""
        if self.hazard_waves_remaining > 0:
            self.hazard_waves_remaining -= 1
            if self.hazard_waves_remaining <= 0:
                # Remove hazard effects
                self.enemy_hp_mult = 1.0
                self.enemy_speed_mult = 1.0
                return True
        return False

    def get_effective_damage_mult(self):
        """Get the total damage multiplier from all active effects."""
        return self.damage_mult

    def get_effective_range_mult(self):
        """Get the total range multiplier from all active effects."""
        return self.range_mult

    def get_gold_per_kill_bonus(self):
        """Get bonus gold per kill from active effects."""
        return self.gold_per_kill_bonus

    def get_effective_enemy_hp_mult(self):
        """Get the total enemy HP multiplier from active hazards."""
        return self.enemy_hp_mult

    def get_effective_enemy_speed_mult(self):
        """Get the total enemy speed multiplier from active hazards."""
        return self.enemy_speed_mult

    def get_effective_hero_hp_mult(self):
        """Get the total hero HP multiplier from active effects."""
        return self.hero_hp_mult

    def get_effective_hero_xp_mult(self):
        """Get the total hero XP multiplier from active effects."""
        return self.hero_xp_mult

    def has_l5_unlock(self):
        """Check if L5 tower upgrades are unlocked."""
        return self.l5_unlock

    def has_second_hero(self):
        """Check if a second hero is spawned."""
        return self.second_hero

    def get_active_card_ids(self):
        """Get list of active card IDs."""
        return list(self.active_effects.keys())

    def clear(self):
        """Clear all effects."""
        self.active_effects.clear()
        self.hazard_waves_remaining = 0
        self.enemy_hp_mult = 1.0
        self.enemy_speed_mult = 1.0
        self.gold_per_kill_bonus = 0
        self.damage_mult = 1.0
        self.range_mult = 1.0
        self.hero_hp_mult = 1.0
        self.hero_xp_mult = 1.0
        self.l5_unlock = False
        self.second_hero = False
