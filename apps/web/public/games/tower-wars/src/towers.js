import { playSfx } from "./audio.js";
import { chooseBranch } from "./build.js";
import { dealDamageToEnemy } from "./combat.js";
import { update } from "./loop.js";
import { TOWER_COLORS } from "./palette.js";
import { getEnemyProgress } from "./picking.js";
import { AreaEffect, Effect, Projectile } from "./projectiles.js";
import { areaEffects, buffZones, effects, enemies, game, getEnemyLane, projectiles } from "./state.js";
import { status } from "./status.js";

export const TOWER_DATA = {
  arrow: {
    name: "Arrow Tower",
    code: "AR",
    cost: 70,
    color: TOWER_COLORS.arrow.fill,
    core: TOWER_COLORS.arrow.shade,
    damageType: "piercing",
    canHitAir: true,
    damage: 16,
    range: 155,
    fireRate: 0.5,
    projectileSpeed: 500,
    projectileRadius: 4,
    branches: {
      a: {
        id: "ranger",
        name: "Ranger",
        description: "Long range marksman with Volley ability.",
        mods: { damageMul: 1.26, rangeAdd: 35, attackSpeedMul: 1.12 },
        ability: {
          id: "volley",
          name: "Volley",
          cooldown: 16,
          description: "Instantly hits up to 6 enemies in range.",
        },
      },
      b: {
        id: "captain",
        name: "Captain",
        description: "Aura support with Rally ability.",
        mods: { damageMul: 0.92, rangeAdd: 10, attackSpeedMul: 0.95 },
        aura: {
          name: "Command Aura",
          radius: 138,
          damageMul: 1.14,
          rateMul: 1.16,
        },
        ability: {
          id: "rally",
          name: "Rally",
          cooldown: 22,
          description: "Boost nearby towers for 6s.",
        },
      },
    },
  },
  frost: {
    name: "Frost Tower",
    code: "FR",
    cost: 95,
    color: TOWER_COLORS.frost.fill,
    core: TOWER_COLORS.frost.shade,
    damageType: "magic",
    canHitAir: true,
    damage: 10,
    range: 145,
    fireRate: 0.7,
    projectileSpeed: 400,
    projectileRadius: 5,
    slowFactor: 0.58,
    slowDuration: 1.5,
    branches: {
      a: {
        id: "glacier",
        name: "Glacier",
        description: "Heavier slow and Shatter wave.",
        mods: { damageMul: 1.2, rangeAdd: 15, attackSpeedMul: 0.94, slowFactorMul: 0.74, slowDurationMul: 1.25 },
        ability: {
          id: "shatter",
          name: "Shatter",
          cooldown: 18,
          description: "Magic blast around tower with strong slow.",
        },
      },
      b: {
        id: "storm",
        name: "Storm",
        description: "Blizzard caster with frost aura.",
        mods: { damageMul: 1.05, rangeAdd: 20, attackSpeedMul: 1.1 },
        aura: {
          name: "Winter Aura",
          radius: 124,
          damageMul: 1.08,
          rateMul: 1.14,
        },
        ability: {
          id: "blizzard",
          name: "Blizzard",
          cooldown: 20,
          description: "Create damaging slow field.",
        },
      },
    },
  },
  cannon: {
    name: "Cannon Tower",
    code: "CN",
    cost: 120,
    color: TOWER_COLORS.cannon.fill,
    core: TOWER_COLORS.cannon.shade,
    damageType: "siege",
    canHitAir: false,
    damage: 35,
    range: 166,
    fireRate: 1.2,
    projectileSpeed: 285,
    projectileRadius: 7,
    splashRadius: 58,
    branches: {
      a: {
        id: "demolisher",
        name: "Demolisher",
        description: "Siege specialist with Barrage.",
        mods: { damageMul: 1.32, rangeAdd: 12, splashMul: 1.3, attackSpeedMul: 0.9 },
        ability: {
          id: "barrage",
          name: "Barrage",
          cooldown: 24,
          description: "Huge area siege blast.",
        },
      },
      b: {
        id: "flak",
        name: "Flak",
        description: "Anti-air conversion with Skyfire.",
        mods: { damageMul: 0.86, rangeAdd: 25, canHitAir: true, attackSpeedMul: 1.15 },
        aura: {
          name: "Flak Screen",
          radius: 132,
          damageMul: 1,
          rateMul: 1.1,
          grantAir: true,
        },
        ability: {
          id: "skyfire",
          name: "Skyfire",
          cooldown: 19,
          description: "Hits all flying enemies in range.",
        },
      },
    },
  },
  arcane: {
    name: "Arcane Tower",
    code: "AC",
    cost: 145,
    color: TOWER_COLORS.arcane.fill,
    core: TOWER_COLORS.arcane.shade,
    damageType: "spell",
    canHitAir: true,
    damage: 24,
    range: 178,
    fireRate: 0.82,
    projectileSpeed: 455,
    projectileRadius: 5,
    branches: {
      a: {
        id: "astromancer",
        name: "Astromancer",
        description: "Burst specialist with Arcane Nova.",
        mods: { damageMul: 1.22, rangeAdd: 24, attackSpeedMul: 1.08 },
        ability: {
          id: "arcane_nova",
          name: "Arcane Nova",
          cooldown: 20,
          description: "Pulsing spell blast around the tower.",
        },
      },
      b: {
        id: "runelord",
        name: "Runelord",
        description: "Support caster with Time Lock.",
        mods: { damageMul: 0.95, rangeAdd: 16, attackSpeedMul: 0.98 },
        aura: {
          name: "Rune Aura",
          radius: 136,
          damageMul: 1.1,
          rateMul: 1.08,
        },
        ability: {
          id: "time_lock",
          name: "Time Lock",
          cooldown: 24,
          description: "Damages and slows all active enemies.",
        },
      },
    },
  },
  venom: {
    name: "Venom Tower",
    code: "VN",
    cost: 115,
    color: TOWER_COLORS.venom.fill,
    core: TOWER_COLORS.venom.shade,
    damageType: "magic",
    canHitAir: false,
    damage: 14,
    range: 150,
    fireRate: 0.58,
    projectileSpeed: 410,
    projectileRadius: 4,
    branches: {
      a: {
        id: "plaguebringer",
        name: "Plaguebringer",
        description: "Area poison specialist with Acid Rain.",
        mods: { damageMul: 1.18, rangeAdd: 10, attackSpeedMul: 1.05 },
        ability: {
          id: "acid_rain",
          name: "Acid Rain",
          cooldown: 18,
          description: "Creates a corrosive poison field.",
        },
      },
      b: {
        id: "serpent_watch",
        name: "Serpent Watch",
        description: "Long reach support with toxic aura.",
        mods: { damageMul: 1.02, rangeAdd: 28, attackSpeedMul: 0.92, canHitAir: true },
        aura: {
          name: "Toxic Aura",
          radius: 126,
          damageMul: 1.07,
          rateMul: 1.12,
        },
        ability: {
          id: "venom_spike",
          name: "Venom Spike",
          cooldown: 16,
          description: "Fires toxic spikes at multiple targets.",
        },
      },
    },
  },
  mortar: {
    name: "Fire Mortar",
    code: "MT",
    cost: 155,
    color: TOWER_COLORS.mortar.fill,
    core: TOWER_COLORS.mortar.shade,
    roleTags: ["AoE"],
    element: "Fire",
    damageType: "siege",
    canHitAir: false,
    damage: 26,
    range: 185,
    fireRate: 1.25,
    projectileSpeed: 360,
    projectileRadius: 5,
    splashRadius: 64,
    burnDps: 7,
    burnDuration: 2.8,
    branches: {
      a: {
        id: "shrapnel",
        name: "Shrapnel",
        description: "Wider splash with stronger burn.",
        mods: { damageMul: 1.06, splashAdd: 18, burnDpsAdd: 3, burnDurAdd: 0.8 },
      },
      b: {
        id: "incendiary",
        name: "Incendiary",
        description: "Leaves a burning patch on impact.",
        mods: { damageMul: 0.96, splashAdd: 6, burnDpsAdd: 2, burnDurAdd: 0.5, firePatch: true },
      },
    },
  },
  obelisk: {
    name: "Frost Obelisk",
    code: "OB",
    cost: 150,
    color: TOWER_COLORS.obelisk.fill,
    core: TOWER_COLORS.obelisk.shade,
    roleTags: ["Control"],
    element: "Frost",
    damageType: "magic",
    canHitAir: true,
    damage: 9,
    range: 175,
    fireRate: 0.66,
    projectileSpeed: 430,
    projectileRadius: 4,
    slowFactor: 0.62,
    slowDuration: 1.05,
    branches: {
      a: {
        id: "permafrost",
        name: "Permafrost",
        description: "Projects a chilling aura around the obelisk.",
        mods: { damageMul: 0.9 },
        auraSlow: { radius: 130, factor: 0.8, name: "Permafrost Aura" },
      },
      b: {
        id: "ice_lance",
        name: "Ice Lance",
        description: "Periodic freeze-window shots with heavy slow.",
        mods: { damageMul: 1.18, rangeAdd: 12 },
        freeze: { factor: 0.2, duration: 0.65, cooldown: 4.0 },
      },
    },
  },
};
export class Tower {
  constructor(type, x, y, owner = 0) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.owner = owner;

    const base = TOWER_DATA[type];
    this.level = 1;
    this.baseDamage = base.damage;
    this.baseRange = base.range;
    this.baseFireRate = base.fireRate;
    this.cooldown = Math.random() * this.baseFireRate;
    this.invested = base.cost;
    this.kills = 0;

    this.branch = null;
    this.abilityCooldown = 0;

    this.tempDamageMul = 1;
    this.tempRateMul = 1;
    this.tempBuffTimer = 0;

    this.auraDamageMul = 1;
    this.auraRateMul = 1;
    this.auraGrantAir = false;
    this._freezeCd = 0;
  }

  static fromSave(data) {
    const tower = new Tower(data.type, data.x, data.y, data.owner || 0);
    tower.level = data.level;
    tower.baseDamage = data.baseDamage;
    tower.baseRange = data.baseRange;
    tower.baseFireRate = data.baseFireRate;
    tower.cooldown = data.cooldown;
    tower.branch = data.branch;
    tower.abilityCooldown = data.abilityCooldown;
    tower.tempDamageMul = data.tempDamageMul;
    tower.tempRateMul = data.tempRateMul;
    tower.tempBuffTimer = data.tempBuffTimer;
    tower._freezeCd = data._freezeCd || 0;
    tower.invested = data.invested ?? TOWER_DATA[data.type].cost;
    tower.kills = data.kills ?? 0;
    return tower;
  }

  serialize() {
    return {
      type: this.type,
      x: this.x,
      y: this.y,
      owner: this.owner,
      level: this.level,
      baseDamage: this.baseDamage,
      baseRange: this.baseRange,
      baseFireRate: this.baseFireRate,
      cooldown: this.cooldown,
      branch: this.branch,
      abilityCooldown: this.abilityCooldown,
      tempDamageMul: this.tempDamageMul,
      tempRateMul: this.tempRateMul,
      tempBuffTimer: this.tempBuffTimer,
      _freezeCd: this._freezeCd,
      invested: this.invested,
      kills: this.kills,
    };
  }

  get sellValue() {
    return Math.floor(this.invested * 0.7);
  }

  get data() {
    return TOWER_DATA[this.type];
  }

  get branchData() {
    if (!this.branch) {
      return null;
    }
    return this.data.branches[this.branch] || null;
  }

  get branchCost() {
    return 130 + Math.max(0, this.level - 3) * 25;
  }

  get upgradeCost() {
    if (this.level >= 6) {
      return 0;
    }
    return Math.floor(this.data.cost * (0.72 + this.level * 0.58));
  }

  get damageType() {
    return this.data.damageType;
  }

  get canHitAir() {
    const branchHitAir = !!this.branchData?.mods?.canHitAir;
    return this.data.canHitAir || branchHitAir || this.auraGrantAir;
  }

  get slowFactor() {
    const base = this.data.slowFactor;
    if (!base) {
      return null;
    }
    const mul = this.branchData?.mods?.slowFactorMul || 1;
    return Math.max(0.2, base * mul);
  }

  get slowDuration() {
    const base = this.data.slowDuration;
    if (!base) {
      return 0;
    }
    const mul = this.branchData?.mods?.slowDurationMul || 1;
    return base * mul;
  }

  get splashRadius() {
    const base = this.data.splashRadius || 0;
    const mul = this.branchData?.mods?.splashMul || 1;
    const add = this.branchData?.mods?.splashAdd || 0;
    return base * mul + add;
  }

  get burnDps() {
    const base = this.data.burnDps || 0;
    const add = this.branchData?.mods?.burnDpsAdd || 0;
    return base + add;
  }

  get burnDuration() {
    const base = this.data.burnDuration || 0;
    const add = this.branchData?.mods?.burnDurAdd || 0;
    return base + add;
  }

  get effectiveDamage() {
    const branchMul = this.branchData?.mods?.damageMul || 1;
    return Math.round(this.baseDamage * branchMul * this.auraDamageMul * this.tempDamageMul);
  }

  get effectiveRange() {
    const branchAdd = this.branchData?.mods?.rangeAdd || 0;
    return this.baseRange + branchAdd;
  }

  get effectiveFireRate() {
    const branchMul = this.branchData?.mods?.attackSpeedMul || 1;
    const speedMul = this.auraRateMul * this.tempRateMul * branchMul;
    return Math.max(0.12, this.baseFireRate / speedMul);
  }

  get ability() {
    return this.branchData?.ability || null;
  }

  hasAura() {
    return !!(this.branchData?.aura || this.branchData?.auraSlow);
  }

  canChooseBranch() {
    return this.level >= 3 && !this.branch;
  }

  canUpgrade() {
    return this.level < 6;
  }

  canCastAbility() {
    return !!this.ability && this.abilityCooldown <= 0;
  }

  upgrade() {
    if (!this.canUpgrade()) {
      return false;
    }

    this.level += 1;
    this.baseDamage = Math.round(this.baseDamage * 1.34);
    this.baseRange += 8;
    this.baseFireRate = Math.max(0.16, this.baseFireRate * 0.93);
    return true;
  }

  chooseBranch(branchKey) {
    if (!this.canChooseBranch()) {
      return false;
    }
    if (!this.data.branches[branchKey]) {
      return false;
    }
    this.branch = branchKey;
    effects.push(new Effect(this.x, this.y, "text", { text: this.branchData.name, color: "#f8e59f" }));
    return true;
  }

  applyTempBuff(damageMul, rateMul, duration) {
    this.tempDamageMul = Math.max(this.tempDamageMul, damageMul);
    this.tempRateMul = Math.max(this.tempRateMul, rateMul);
    this.tempBuffTimer = Math.max(this.tempBuffTimer, duration);
  }

  canTarget(enemy) {
    if (enemy.flying && !this.canHitAir) {
      return false;
    }
    if (game.duelMode && getEnemyLane(enemy) !== this.owner) {
      return false;
    }

    const dx = enemy.x - this.x;
    const dy = enemy.y - this.y;
    return dx * dx + dy * dy <= this.effectiveRange * this.effectiveRange;
  }

  acquireTarget() {
    let best = null;
    let bestProgress = -1;

    for (const enemy of enemies) {
      if (!this.canTarget(enemy)) {
        continue;
      }
      const progress = getEnemyProgress(enemy);
      if (progress > bestProgress) {
        bestProgress = progress;
        best = enemy;
      }
    }

    return best;
  }

  fire(target) {
    let freezeOnHit = null;
    if (this.type === "obelisk") {
      const freeze = this.branchData?.freeze;
      if (freeze && this._freezeCd <= 0) {
        freezeOnHit = { factor: freeze.factor, duration: freeze.duration };
        this._freezeCd = freeze.cooldown;
      }
    }

    const projectile = new Projectile({
      x: this.x,
      y: this.y,
      target,
      sourceTower: this,
      speed: this.data.projectileSpeed,
      radius: this.data.projectileRadius,
      damage: this.effectiveDamage,
      damageType: this.damageType,
      splashRadius: this.splashRadius,
      canSlow: this.type === "frost" || this.type === "obelisk",
      slowFactor: this.slowFactor,
      slowDuration: this.slowDuration,
      burnDps: this.type === "mortar" ? this.burnDps : 0,
      burnDuration: this.type === "mortar" ? this.burnDuration : 0,
      spawnFirePatch: this.type === "mortar" && !!this.branchData?.mods?.firePatch,
      freezeOnHit,
    });
    projectiles.push(projectile);
    const aim = Math.atan2(target.y - this.y, target.x - this.x);
    effects.push(new Effect(this.x + Math.cos(aim) * 11, this.y - 6 + Math.sin(aim) * 11, "muzzle", { angle: aim }));
    playSfx("shoot");
  }

  castAbility() {
    const ability = this.ability;
    if (!ability || this.abilityCooldown > 0) {
      return false;
    }

    const range = this.effectiveRange;

    if (ability.id === "volley") {
      const targets = enemies
        .filter((enemy) => this.canTarget(enemy))
        .sort((a, b) => getEnemyProgress(b) - getEnemyProgress(a))
        .slice(0, 6);

      for (const enemy of targets) {
        const dmg = Math.round(this.effectiveDamage * 1.4);
        dealDamageToEnemy(enemy, dmg, "piercing", this, { allowZero: false });
      }
      effects.push(new Effect(this.x, this.y, "ring", { radius: range * 0.85, color: "rgba(248, 223, 135, 0.45)" }));
    }

    if (ability.id === "rally") {
      buffZones.push({
        x: this.x,
        y: this.y,
        owner: this.owner,
        radius: 145,
        damageMul: 1.22,
        rateMul: 1.35,
        timer: 6,
        name: "Rally",
      });
      effects.push(new Effect(this.x, this.y, "ring", { radius: 145, color: "rgba(244, 214, 130, 0.35)" }));
    }

    if (ability.id === "shatter") {
      const blastRadius = Math.round(range * 0.6);
      for (const enemy of enemies) {
        const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
        if (d <= blastRadius) {
          const falloff = 1 - d / (blastRadius + 1);
          const dmg = Math.round(this.effectiveDamage * (1.6 * Math.max(0.4, falloff)));
          dealDamageToEnemy(enemy, dmg, "magic", this, { allowZero: true });
          enemy.applySlow(0.42, 1.4);
        }
      }
      effects.push(new Effect(this.x, this.y, "ring", { radius: blastRadius, color: "rgba(128, 210, 255, 0.45)" }));
    }

    if (ability.id === "blizzard") {
      areaEffects.push(
        new AreaEffect({
          x: this.x,
          y: this.y,
          radius: Math.round(range * 0.7),
          duration: 4.2,
          interval: 0.36,
          damage: Math.round(this.effectiveDamage * 0.7),
          damageType: "magic",
          slowFactor: 0.52,
          slowDuration: 0.7,
          color: "rgba(136, 214, 255, 0.34)",
        })
      );
    }

    if (ability.id === "barrage") {
      let target = null;
      let farthest = -1;
      for (const enemy of enemies) {
        const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
        if (d > range || !this.canTarget(enemy)) {
          continue;
        }
        const progress = getEnemyProgress(enemy);
        if (progress > farthest) {
          farthest = progress;
          target = enemy;
        }
      }
      const center = target ? { x: target.x, y: target.y } : { x: this.x, y: this.y };
      const splash = Math.round(this.splashRadius * 1.8);
      for (const enemy of [...enemies]) {
        const d = Math.hypot(enemy.x - center.x, enemy.y - center.y);
        if (d <= splash) {
          const dmg = Math.round(this.effectiveDamage * (2 - d / (splash + 1)));
          dealDamageToEnemy(enemy, dmg, "siege", this, { allowZero: false });
        }
      }
      effects.push(new Effect(center.x, center.y, "explosion", { radius: splash }));
      game.shake = Math.max(game.shake, 6);
    }

    if (ability.id === "skyfire") {
      const hitRadius = range + 40;
      let hits = 0;
      for (const enemy of [...enemies]) {
        if (!enemy.flying) {
          continue;
        }
        if (Math.hypot(enemy.x - this.x, enemy.y - this.y) > hitRadius) {
          continue;
        }
        hits += 1;
        const dmg = Math.round(this.effectiveDamage * 1.7);
        dealDamageToEnemy(enemy, dmg, "piercing", this, { allowZero: false });
      }
      effects.push(new Effect(this.x, this.y, "ring", { radius: hitRadius, color: "rgba(193, 220, 255, 0.45)" }));
      if (hits === 0) {
        status("Skyfire cast, but no air targets in range.");
      }
    }

    if (ability.id === "arcane_nova") {
      const novaRadius = Math.round(range * 0.62);
      for (const enemy of [...enemies]) {
        const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
        if (d > novaRadius) {
          continue;
        }
        const falloff = 1 - d / (novaRadius + 1);
        const dmg = Math.round(this.effectiveDamage * (2.05 * Math.max(0.35, falloff)));
        dealDamageToEnemy(enemy, dmg, "spell", this, { allowZero: false });
      }
      effects.push(new Effect(this.x, this.y, "ring", { radius: novaRadius, color: "rgba(186, 160, 255, 0.44)" }));
    }

    if (ability.id === "time_lock") {
      let affected = 0;
      for (const enemy of [...enemies]) {
        const dmg = Math.round(this.effectiveDamage * 0.9);
        dealDamageToEnemy(enemy, dmg, "spell", this, { allowZero: true });
        enemy.applySlow(0.58, 2.6);
        affected += 1;
      }
      effects.push(new Effect(this.x, this.y, "ring", { radius: range * 0.96, color: "rgba(154, 186, 255, 0.42)" }));
      if (affected === 0) {
        status("Time Lock cast, but there were no targets.");
      }
    }

    if (ability.id === "acid_rain") {
      areaEffects.push(
        new AreaEffect({
          x: this.x,
          y: this.y,
          radius: Math.round(range * 0.76),
          duration: 5.1,
          interval: 0.38,
          damage: Math.round(this.effectiveDamage * 0.76),
          damageType: "magic",
          slowFactor: 0.82,
          slowDuration: 0.58,
          color: "rgba(133, 205, 112, 0.34)",
        })
      );
    }

    if (ability.id === "venom_spike") {
      const targets = enemies
        .filter((enemy) => this.canTarget(enemy))
        .sort((a, b) => getEnemyProgress(b) - getEnemyProgress(a))
        .slice(0, 5);
      for (const enemy of targets) {
        const dmg = Math.round(this.effectiveDamage * 1.35);
        dealDamageToEnemy(enemy, dmg, "magic", this, { allowZero: true });
        enemy.applySlow(0.68, 1.2);
      }
      effects.push(new Effect(this.x, this.y, "ring", { radius: range * 0.84, color: "rgba(174, 225, 118, 0.42)" }));
      if (targets.length === 0) {
        status("Venom Spike cast, but no targets were in range.");
      }
    }

    this.abilityCooldown = ability.cooldown;
    playSfx("ability");
    return true;
  }

  update(dt) {
    if (this.tempBuffTimer > 0) {
      this.tempBuffTimer -= dt;
      if (this.tempBuffTimer <= 0) {
        this.tempBuffTimer = 0;
        this.tempDamageMul = 1;
        this.tempRateMul = 1;
      }
    }

    if (this.abilityCooldown > 0) {
      this.abilityCooldown -= dt;
    }
    this._freezeCd = Math.max(0, this._freezeCd - dt);

    this.cooldown -= dt;
    if (this.cooldown > 0) {
      return;
    }

    const target = this.acquireTarget();
    if (!target) {
      this.cooldown = Math.min(this.cooldown, 0);
      return;
    }

    this.fire(target);
    this.cooldown = this.effectiveFireRate;
  }
}
