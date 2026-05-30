"""Green Circle TD - Phase 3 (hero, synergies, branching upgrades, status effects)
and Phase 5 (damage numbers, hit-stop, death FX) tests.
"""
import unittest
import math
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.hero import Hero
from core.status import StatusEffect, StatusManager
from core.tower import Tower
from core.enemy import Enemy
from core.fx import DamageNumber, DeathEffect, HitStop, EffectManager
from core.rng import Rng


class TestHero(unittest.TestCase):
    """Tests for the Hero unit (Phase 3a)."""

    def setUp(self):
        self.rng = Rng(42)
        self.hero_data = {
            "name": "Verdant Hero",
            "hp_base": 200,
            "hp_per_level": 40,
            "damage_base": 18,
            "damage_per_level": 4,
            "attack_speed": 30,
            "move_speed": 3.0,
            "block_radius": 24,
            "xp_per_kill": 10,
            "xp_per_assist": 3,
            "xp_to_level": [50, 120, 220, 360],
        }

    def test_hero_spawn_at_center(self):
        hero = Hero(480, 360, self.hero_data, self.rng)
        self.assertEqual(hero.x, 480)
        self.assertEqual(hero.y, 360)
        self.assertTrue(hero.alive)
        self.assertEqual(hero.level, 1)

    def test_hero_move_to(self):
        hero = Hero(480, 360, self.hero_data, self.rng)
        hero.move_to(500, 400)
        self.assertEqual(hero.target_x, 500)
        self.assertEqual(hero.target_y, 400)

    def test_hero_take_damage(self):
        hero = Hero(480, 360, self.hero_data, self.rng)
        hero.take_damage(50)
        self.assertEqual(hero.hp, 150)
        self.assertTrue(hero.alive)

    def test_hero_death(self):
        hero = Hero(480, 360, self.hero_data, self.rng)
        hero.take_damage(200)
        self.assertFalse(hero.alive)

    def test_hero_respawn(self):
        hero = Hero(480, 360, self.hero_data, self.rng)
        hero.take_damage(200)
        self.assertFalse(hero.alive)
        hero.respawn()
        self.assertTrue(hero.alive)
        self.assertEqual(hero.hp, hero.current_hp)

    def test_hero_level_up(self):
        hero = Hero(480, 360, self.hero_data, self.rng)
        leveled = hero.add_xp(50)
        self.assertTrue(leveled)
        self.assertEqual(hero.level, 2)
        self.assertEqual(hero.current_hp, 240)
        # current_damage = int(18 * 1.15 + 4 * 1) = 24
        self.assertEqual(hero.current_damage, 24)

    def test_hero_max_level(self):
        hero = Hero(480, 360, self.hero_data, self.rng)
        # Level 1 → 2
        hero.add_xp(50)
        # Level 2 → 3
        hero.add_xp(120)
        # Level 3 → 4
        hero.add_xp(220)
        # Level 4 → 5
        hero.add_xp(360)
        self.assertEqual(hero.level, 5)
        self.assertEqual(hero.current_hp, 360)
        # current_damage at level 5 = int(18 * 1.60 + 4 * 4) = int(28.8 + 16) = 44
        self.assertEqual(hero.current_damage, 44)

    def test_hero_body_block(self):
        hero = Hero(480, 360, self.hero_data, self.rng)
        path = [(0, 360), (100, 360), (200, 360)]
        enemy = Enemy(path, wave=1, trait={"name": "Normal", "color": (0, 210, 116),
                                            "count_bonus": 0, "health_mult": 1.0,
                                            "speed_mult": 1.0, "bounty_bonus": 0,
                                            "flags": [], "armor_type": "medium"},
                      rng=self.rng)
        # Place enemy close to hero
        enemy.x = 490
        enemy.y = 360
        enemy.center_x = 490
        enemy.center_y = 360
        hero.update([enemy], dt=1)
        # Enemy should be pushed away
        self.assertNotEqual(enemy.x, 490)

    def test_hero_does_not_block_air(self):
        hero = Hero(480, 360, self.hero_data, self.rng)
        path = [(0, 360), (100, 360), (200, 360)]
        trait = {"name": "Normal", "color": (0, 210, 116), "count_bonus": 0,
                 "health_mult": 1.0, "speed_mult": 1.0, "bounty_bonus": 0,
                 "flags": ["air"], "armor_type": "medium"}
        enemy = Enemy(path, wave=1, trait=trait, rng=self.rng)
        enemy.x = 490
        enemy.y = 360
        enemy.center_x = 490
        enemy.center_y = 360
        hero.update([enemy], dt=1)
        # Air enemies should NOT be blocked
        self.assertEqual(enemy.x, 490)

    def test_hero_does_not_block_boss(self):
        hero = Hero(480, 360, self.hero_data, self.rng)
        path = [(0, 360), (100, 360), (200, 360)]
        trait = {"name": "Boss", "color": (0, 210, 116), "count_bonus": 0,
                 "health_mult": 1.0, "speed_mult": 1.0, "bounty_bonus": 0,
                 "flags": ["boss"], "armor_type": "medium"}
        enemy = Enemy(path, wave=1, trait=trait, rng=self.rng)
        enemy.x = 490
        enemy.y = 360
        enemy.center_x = 490
        enemy.center_y = 360
        hero.update([enemy], dt=1)
        # Boss enemies should NOT be blocked
        self.assertEqual(enemy.x, 490)

    def test_hero_attack(self):
        hero = Hero(480, 360, self.hero_data, self.rng)
        path = [(480, 300), (480, 200)]
        trait = {"name": "Normal", "color": (0, 210, 116), "count_bonus": 0,
                 "health_mult": 1.0, "speed_mult": 1.0, "bounty_bonus": 0,
                 "flags": [], "armor_type": "medium"}
        enemy = Enemy(path, wave=1, trait=trait, rng=self.rng)
        enemy.x = 480
        enemy.y = 350
        enemy.center_x = 480
        enemy.center_y = 350
        enemy.health = 50
        hero.update([enemy], dt=1)
        # Hero should have attacked
        self.assertLess(enemy.health, 50)
        self.assertGreaterEqual(hero.attack_timer, 0)


class TestStatusEffects(unittest.TestCase):
    """Tests for status effects system (Phase 3d)."""

    def test_status_effect_update(self):
        effect = StatusEffect("poison", 20, tick_interval=5, tick_damage=5)
        for _ in range(19):
            effect.update()
        self.assertTrue(effect.active)
        effect.update()
        self.assertFalse(effect.active)

    def test_status_effect_tick_damage(self):
        effect = StatusEffect("poison", 20, tick_interval=5, tick_damage=5)
        for _ in range(4):
            effect.update()
        dmg = effect.update()  # Should tick at 5
        self.assertEqual(dmg, 5)

    def test_status_effect_refresh(self):
        effect = StatusEffect("poison", 10, tick_interval=5, tick_damage=5)
        effect.update()
        effect.refresh(20)
        self.assertEqual(effect.remaining, 20)

    def test_status_effect_extend(self):
        effect = StatusEffect("poison", 10, tick_interval=5, tick_damage=5)
        effect.update()
        effect.extend(15)
        self.assertEqual(effect.remaining, 15)

    def test_status_manager_add_poison(self):
        sm = StatusManager()
        sm.add_poison(5, 60)
        self.assertTrue(sm.is_poisoned())
        self.assertEqual(sm.get_poison_damage(), 5)

    def test_status_manager_poison_stacks(self):
        sm = StatusManager()
        sm.add_poison(5, 60)
        sm.add_poison(3, 40)
        self.assertEqual(sm.get_poison_damage(), 8)  # 5 + 3

    def test_status_manager_add_slow(self):
        sm = StatusManager()
        sm.add_slow(0.5, 60)
        self.assertTrue(sm.is_slowed())
        self.assertEqual(sm.get_total_slow_factor(), 0.5)

    def test_status_manager_slow_refresh(self):
        sm = StatusManager()
        sm.add_slow(0.5, 60)
        sm.add_slow(0.7, 30)
        # Should keep the stronger (lower) factor
        self.assertEqual(sm.get_total_slow_factor(), 0.5)

    def test_status_manager_add_burn(self):
        sm = StatusManager()
        sm.add_burn(4, 120)
        self.assertTrue(sm.is_burning())
        self.assertEqual(sm.get_burn_damage(), 4)

    def test_status_manager_burn_replaces(self):
        sm = StatusManager()
        sm.add_burn(4, 120)
        sm.add_burn(8, 60)
        # Should replace, not stack
        self.assertEqual(sm.get_burn_damage(), 8)
        self.assertEqual(len([e for e in sm.effects if e.name == "burn"]), 1)

    def test_status_manager_add_armor_shred(self):
        sm = StatusManager()
        sm.add_armor_shred(0.2, 180)
        self.assertTrue(sm.has_armor_shred())
        self.assertEqual(sm.get_total_armor_shred(), 0.2)

    def test_status_manager_armor_shred_stacks(self):
        sm = StatusManager()
        sm.add_armor_shred(0.2, 180)
        sm.add_armor_shred(0.15, 120)
        self.assertEqual(sm.get_total_armor_shred(), 0.35)

    def test_status_manager_update_all(self):
        sm = StatusManager()
        sm.add_poison(5, 60)
        sm.add_burn(3, 60)
        # Advance past all durations (poison: 60 frames, burn: 60 frames)
        for _ in range(65):
            sm.update_all()
        # Effects should have expired and been removed
        self.assertFalse(sm.is_poisoned())
        self.assertFalse(sm.is_burning())

    def test_status_manager_get_active_names(self):
        sm = StatusManager()
        sm.add_poison(5, 60)
        sm.add_slow(0.5, 60)
        names = sm.get_active_effect_names()
        self.assertIn("poison", names)
        self.assertIn("slow", names)


class TestBranchingUpgrades(unittest.TestCase):
    """Tests for branching upgrade system (Phase 3c)."""

    def test_tower_upgrade_to_l3_returns_branch_options(self):
        tower = Tower(5, 5, "sniper", rng=Rng(42))
        result1 = tower.upgrade()  # L1→L2, returns cost
        self.assertIsNotNone(result1)
        self.assertEqual(tower.level, 2)
        result2 = tower.upgrade()  # L2→L3, returns cost
        self.assertIsNotNone(result2)
        self.assertEqual(tower.level, 3)
        result3 = tower.upgrade()  # L3→branch options, returns dict
        self.assertIsInstance(result3, dict)
        self.assertEqual(result3["type"], "branch")
        self.assertIn("branches", result3)

    def test_tower_apply_branch(self):
        tower = Tower(5, 5, "sniper", rng=Rng(42))
        tower.upgrade()
        tower.upgrade()
        result = tower.apply_branch("sniper_truesight")
        self.assertTrue(result)
        self.assertEqual(tower.level, 4)
        self.assertEqual(tower.branch_id, "sniper_truesight")
        self.assertEqual(tower.branch_name, "Truesight Bolt")
        self.assertEqual(tower.damage_type, "pierce")
        self.assertTrue(tower._true_sight)

    def test_tower_apply_branch_applies_damage_mult(self):
        tower = Tower(5, 5, "basic", rng=Rng(42))
        tower.upgrade()
        tower.upgrade()
        tower.apply_branch("basic_heavy")
        # basic_heavy has damage_mult: 2.5
        self.assertGreater(tower.damage, tower.data["damage"])

    def test_tower_apply_branch_applies_crit(self):
        tower = Tower(5, 5, "rapid", rng=Rng(42))
        tower.upgrade()
        tower.upgrade()
        tower.apply_branch("rapid_crit")
        self.assertEqual(tower._crit_chance, 0.10)
        self.assertEqual(tower._crit_mult, 3.0)

    def test_tower_apply_branch_applies_burn(self):
        tower = Tower(5, 5, "rapid", rng=Rng(42))
        tower.upgrade()
        tower.upgrade()
        tower.apply_branch("rapid_burn")
        self.assertEqual(tower._burn_dot, 4)
        self.assertEqual(tower._burn_duration, 120)

    def test_tower_apply_branch_applies_splash_bigger(self):
        tower = Tower(5, 5, "splash", rng=Rng(42))
        tower.upgrade()
        tower.upgrade()
        tower.apply_branch("splash_bigger")
        self.assertGreater(tower.splash_radius, 0)

    def test_tower_apply_branch_applies_frost_freeze(self):
        tower = Tower(5, 5, "frost", rng=Rng(42))
        tower.upgrade()
        tower.upgrade()
        tower.apply_branch("frost_freeze")
        self.assertEqual(tower._freeze_chance, 0.05)
        self.assertEqual(tower.slow, 0.30)

    def test_tower_apply_branch_applies_poison_plague(self):
        tower = Tower(5, 5, "poison", rng=Rng(42))
        tower.upgrade()
        tower.upgrade()
        tower.apply_branch("poison_plague")
        self.assertTrue(tower._poison_spread_on_death)
        self.assertEqual(tower._poison_dmg_mult, 1.5)

    def test_tower_apply_branch_applies_detector_pulse(self):
        tower = Tower(5, 5, "detector", rng=Rng(42))
        tower.upgrade()
        tower.upgrade()
        tower.apply_branch("detector_pulse")
        self.assertTrue(tower._global_reveal)
        self.assertEqual(tower._reveal_radius, 999)

    def test_tower_cannot_apply_branch_twice(self):
        tower = Tower(5, 5, "sniper", rng=Rng(42))
        tower.upgrade()
        tower.upgrade()
        result1 = tower.apply_branch("sniper_truesight")
        self.assertTrue(result1)
        result2 = tower.apply_branch("sniper_arcane")
        self.assertFalse(result2)

    def test_tower_get_branch_info(self):
        tower = Tower(5, 5, "sniper", rng=Rng(42))
        self.assertIsNone(tower.get_branch_info())
        tower.upgrade()
        tower.upgrade()
        tower.apply_branch("sniper_arcane")
        info = tower.get_branch_info()
        self.assertEqual(info["id"], "sniper_arcane")
        self.assertEqual(info["name"], "Arcane Lance")
        # damage_type is at top level for non-normal types
        self.assertEqual(info["damage_type"], "magic")

    def test_tower_upgrade_cost_none_at_l4(self):
        tower = Tower(5, 5, "basic", rng=Rng(42))
        tower.upgrade()
        tower.upgrade()
        tower.apply_branch("basic_volley")
        self.assertIsNone(tower.upgrade_cost())


class TestTowerSynergies(unittest.TestCase):
    """Tests for tower synergy system (Phase 3b)."""

    def test_frosted_pierce_bonus_detection(self):
        tower = Tower(5, 5, "sniper", rng=Rng(42))
        path = [(0, 0), (100, 0)]
        trait = {"name": "Normal", "color": (0, 210, 116), "count_bonus": 0,
                 "health_mult": 1.0, "speed_mult": 1.0, "bounty_bonus": 0,
                 "flags": [], "armor_type": "medium"}
        enemy = Enemy(path, wave=1, trait=trait, rng=Rng(42))
        enemy.status_manager.add_slow(0.5, 60)
        triggered = tower.on_hit(enemy, 50)
        self.assertIn("frosted_pierce_bonus", triggered)

    def test_frosted_pierce_only_sniper_rapid(self):
        tower = Tower(5, 5, "basic", rng=Rng(42))
        path = [(0, 0), (100, 0)]
        trait = {"name": "Normal", "color": (0, 210, 116), "count_bonus": 0,
                 "health_mult": 1.0, "speed_mult": 1.0, "bounty_bonus": 0,
                 "flags": [], "armor_type": "medium"}
        enemy = Enemy(path, wave=1, trait=trait, rng=Rng(42))
        enemy.status_manager.add_slow(0.5, 60)
        triggered = tower.on_hit(enemy, 50)
        self.assertNotIn("frosted_pierce_bonus", triggered)

    def test_frost_shatter_detection(self):
        tower = Tower(5, 5, "frost", rng=Rng(42))
        tower.damage_type = "magic"
        path = [(0, 0), (100, 0)]
        trait = {"name": "Normal", "color": (0, 210, 116), "count_bonus": 0,
                 "health_mult": 1.0, "speed_mult": 1.0, "bounty_bonus": 0,
                 "flags": [], "armor_type": "medium"}
        enemy = Enemy(path, wave=1, trait=trait, rng=Rng(42))
        # Set health to 0 (already dead) so frost shatter triggers
        enemy.health = 0
        enemy.max_health = 10
        enemy.status_manager.add_slow(0.5, 60)
        triggered = tower.on_hit(enemy, 100)  # Overkill > 1.5x HP
        self.assertIn("frost_shatter", triggered)

    def test_poison_spread_detection(self):
        tower = Tower(5, 5, "splash", rng=Rng(42))
        tower._poison_spread_on_death = True
        path = [(0, 0), (100, 0)]
        trait = {"name": "Normal", "color": (0, 210, 116), "count_bonus": 0,
                 "health_mult": 1.0, "speed_mult": 1.0, "bounty_bonus": 0,
                 "flags": [], "armor_type": "medium"}
        enemy = Enemy(path, wave=1, trait=trait, rng=Rng(42))
        enemy.health = 0
        enemy.active = False
        enemy.status_manager.add_poison(5, 60)
        triggered = tower.on_hit(enemy, 10)
        self.assertIn("poison_spread", triggered)

    def test_synergies_tracked(self):
        tower = Tower(5, 5, "sniper", rng=Rng(42))
        path = [(0, 0), (100, 0)]
        trait = {"name": "Normal", "color": (0, 210, 116), "count_bonus": 0,
                 "health_mult": 1.0, "speed_mult": 1.0, "bounty_bonus": 0,
                 "flags": [], "armor_type": "medium"}
        enemy = Enemy(path, wave=1, trait=trait, rng=Rng(42))
        enemy.status_manager.add_slow(0.5, 60)
        tower.on_hit(enemy, 50)
        triggered = tower.get_synergies_triggered()
        self.assertIn("frosted_pierce_bonus", triggered)


class TestDamageNumbers(unittest.TestCase):
    """Tests for damage number visual effects (Phase 5a)."""

    def test_damage_number_creation(self):
        dn = DamageNumber(100, 200, 25)
        self.assertEqual(dn.damage, 25)
        self.assertTrue(dn.active)
        self.assertEqual(dn.text, "25")

    def test_damage_number_crit(self):
        dn = DamageNumber(100, 200, 50, is_crit=True)
        self.assertTrue(dn.is_crit)
        self.assertEqual(dn.size, 16)
        self.assertIn("CRIT", dn.text)

    def test_damage_number_block(self):
        dn = DamageNumber(100, 200, 5, is_block=True)
        self.assertTrue(dn.is_block)
        self.assertEqual(dn.text, "-5")
        self.assertEqual(dn.size, 10)

    def test_damage_number_effective(self):
        dn = DamageNumber(100, 200, 100, is_effective=True)
        self.assertTrue(dn.is_effective)
        self.assertEqual(dn.size, 13)

    def test_damage_number_fade(self):
        dn = DamageNumber(100, 200, 25)
        for _ in range(44):
            dn.update()
        self.assertTrue(dn.active)
        self.assertGreater(dn.alpha, 0)
        dn.update()
        self.assertFalse(dn.active)

    def test_damage_number_movement(self):
        dn = DamageNumber(100, 200, 25)
        dn.update()
        self.assertNotEqual(dn.y, 200)  # Should move up
        self.assertNotEqual(dn.x, 100)  # Should move sideways


class TestDeathEffects(unittest.TestCase):
    """Tests for type-specific death animations (Phase 5d)."""

    def test_normal_death_particles(self):
        de = DeathEffect(100, 200, "normal", rng=Rng(42))
        self.assertEqual(len(de.particles), 12)
        self.assertEqual(de.max_life, 30)

    def test_armored_death_shatter(self):
        de = DeathEffect(100, 200, "armored", rng=Rng(42))
        self.assertEqual(len(de.particles), 6)
        # All particles should be angular
        for p in de.particles:
            self.assertTrue(p.get("angular", False))

    def test_air_death_spiral(self):
        de = DeathEffect(100, 200, "air", rng=Rng(42))
        self.assertEqual(len(de.particles), 20)

    def test_boss_death_shockwave(self):
        de = DeathEffect(100, 200, "boss", rng=Rng(42))
        self.assertEqual(len(de.particles), 30)
        self.assertEqual(de.ring_max, 80)
        self.assertEqual(de.max_life, 40)

    def test_invisible_death(self):
        de = DeathEffect(100, 200, "invisible", rng=Rng(42))
        self.assertGreater(len(de.particles), 0)

    def test_death_effect_update(self):
        de = DeathEffect(100, 200, "normal", rng=Rng(42))
        for _ in range(29):
            de.update()
        self.assertTrue(de.active)
        de.update()
        self.assertFalse(de.active)

    def test_boss_shockwave_expands(self):
        de = DeathEffect(100, 200, "boss", rng=Rng(42))
        initial_ring = de.ring_radius
        de.update()
        self.assertGreaterEqual(de.ring_radius, initial_ring)


class TestHitStop(unittest.TestCase):
    """Tests for hit-stop system (Phase 5b)."""

    def test_hit_stop_trigger(self):
        hs = HitStop()
        hs.trigger(10)
        self.assertTrue(hs.active)
        self.assertEqual(hs.frames_remaining, 10)

    def test_hit_stop_update(self):
        hs = HitStop()
        hs.trigger(5)
        for _ in range(4):
            hs.update()
        self.assertTrue(hs.active)
        hs.update()
        self.assertFalse(hs.active)

    def test_hit_stop_max(self):
        hs = HitStop()
        hs.trigger(5)
        hs.trigger(10)
        self.assertEqual(hs.frames_remaining, 10)


class TestEffectManager(unittest.TestCase):
    """Tests for the EffectManager (Phase 5)."""

    def test_effect_manager_add_damage_number(self):
        em = EffectManager(rng=Rng(42))
        em.add_damage_number(100, 200, 25)
        self.assertEqual(len(em.damage_numbers), 1)

    def test_effect_manager_add_death_effect(self):
        em = EffectManager(rng=Rng(42))
        em.add_death_effect(100, 200, "normal")
        self.assertEqual(len(em.death_effects), 1)

    def test_effect_manager_trigger_hit_stop(self):
        em = EffectManager(rng=Rng(42))
        em.trigger_hit_stop(10)
        self.assertTrue(em.hit_stop.active)

    def test_effect_manager_update(self):
        em = EffectManager(rng=Rng(42))
        em.add_damage_number(100, 200, 25)
        em.add_death_effect(100, 200, "normal")
        em.trigger_hit_stop(5)
        em.update()
        self.assertEqual(len(em.damage_numbers), 1)
        self.assertEqual(len(em.death_effects), 1)

    def test_effect_manager_clear(self):
        em = EffectManager(rng=Rng(42))
        em.add_damage_number(100, 200, 25)
        em.add_death_effect(100, 200, "normal")
        em.clear()
        self.assertEqual(len(em.damage_numbers), 0)
        self.assertEqual(len(em.death_effects), 0)

    def test_damage_number_throttle(self):
        em = EffectManager(rng=Rng(42))
        em._current_frame = 0
        em.add_damage_number(100, 200, 25)
        em.add_damage_number(100, 200, 15)  # Same position, within 8 frames
        self.assertEqual(len(em.damage_numbers), 1)
        self.assertEqual(em.damage_numbers[0].damage, 40)  # Aggregated


if __name__ == "__main__":
    unittest.main()
