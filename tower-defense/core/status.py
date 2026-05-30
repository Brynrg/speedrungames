"""Green Circle TD - Status effects system.

Supports stacked DoTs (poison), refreshable debuffs (slow), and
replacing effects (burn). Each status has its own timer and tick logic.
"""


class StatusEffect:
    """Represents a single status effect instance on an enemy."""

    def __init__(self, name, duration, tick_interval=20, tick_damage=0,
                 tick_type="normal", slow_factor=1.0, armor_shred=0.0,
                 burn_dot=0, burn_duration=0):
        self.name = name
        self.duration = duration
        self.remaining = duration
        self.tick_interval = tick_interval
        self.tick_damage = tick_damage
        self.tick_type = tick_type
        self.slow_factor = slow_factor
        self.armor_shred = armor_shred
        self.burn_dot = burn_dot
        self.burn_duration = burn_duration
        self.tick_counter = 0
        self.active = True

    def update(self):
        """Update status effect timer and apply tick damage."""
        if not self.active:
            return

        self.remaining -= 1
        if self.remaining <= 0:
            self.active = False
            return

        self.tick_counter += 1
        if self.tick_counter >= self.tick_interval:
            self.tick_counter = 0
            if self.tick_damage > 0:
                return self.tick_damage
            if self.burn_dot > 0:
                return self.burn_dot
        return 0

    def refresh(self, duration):
        """Refresh duration (for replacing effects like burn)."""
        self.remaining = max(self.remaining, duration)

    def extend(self, duration):
        """Extend duration (for stacking effects like poison)."""
        self.remaining = max(self.remaining, duration)


class StatusManager:
    """Manages status effects on an enemy."""

    def __init__(self):
        self.effects = []

    def add_poison(self, damage, duration):
        """Add a poison stack (stacks accumulate)."""
        # Add new stack
        effect = StatusEffect(
            "poison", duration, tick_interval=20,
            tick_damage=damage, tick_type="magic"
        )
        self.effects.append(effect)

    def add_slow(self, factor, duration):
        """Add/refresh a slow effect (refreshes, takes stronger)."""
        for effect in self.effects:
            if effect.name == "slow":
                if factor < effect.slow_factor:
                    effect.slow_factor = factor
                effect.extend(duration)
                return
        # New slow
        self.effects.append(StatusEffect(
            "slow", duration, slow_factor=factor
        ))

    def add_burn(self, dot, duration):
        """Add a burn effect (replaces existing burn)."""
        # Remove existing burn
        self.effects = [e for e in self.effects if e.name != "burn"]
        self.effects.append(StatusEffect(
            "burn", duration, tick_interval=15,
            tick_damage=dot, tick_type="magic"
        ))

    def add_armor_shred(self, amount, duration):
        """Add armor shred (stacks)."""
        for effect in self.effects:
            if effect.name == "armor_shred":
                effect.armor_shred = min(0.8, effect.armor_shred + amount)
                effect.extend(duration)
                return
        self.effects.append(StatusEffect(
            "armor_shred", duration, armor_shred=amount
        ))

    def get_total_slow_factor(self):
        """Get the combined slow factor from all slow effects."""
        min_factor = 1.0
        for effect in self.effects:
            if effect.name == "slow" and effect.active:
                min_factor = min(min_factor, effect.slow_factor)
        return min_factor

    def get_total_armor_shred(self):
        """Get the combined armor shred from all effects."""
        total = 0.0
        for effect in self.effects:
            if effect.name == "armor_shred" and effect.active:
                total += effect.armor_shred
        return min(0.8, total)

    def get_poison_damage(self):
        """Get total poison tick damage from all active stacks."""
        total = 0
        for effect in self.effects:
            if effect.name == "poison" and effect.active:
                total += effect.tick_damage
        return total

    def get_burn_damage(self):
        """Get burn tick damage."""
        for effect in self.effects:
            if effect.name == "burn" and effect.active:
                return effect.tick_damage
        return 0

    def update_all(self):
        """Update all effects, return total damage ticks to apply."""
        total_damage = 0
        for effect in self.effects:
            dmg = effect.update()
            if dmg is not None and dmg > 0:
                total_damage += dmg
        # Remove inactive effects
        self.effects = [e for e in self.effects if e.active]
        return total_damage

    def is_slowed(self):
        """Check if enemy is currently slowed."""
        return self.get_total_slow_factor() < 1.0

    def is_poisoned(self):
        """Check if enemy has active poison."""
        return any(e.name == "poison" and e.active for e in self.effects)

    def is_burning(self):
        """Check if enemy has active burn."""
        return any(e.name == "burn" and e.active for e in self.effects)

    def has_armor_shred(self):
        """Check if enemy has active armor shred."""
        return self.get_total_armor_shred() > 0

    def get_active_effect_names(self):
        """Get list of active effect names for rendering."""
        return [e.name for e in self.effects if e.active]
