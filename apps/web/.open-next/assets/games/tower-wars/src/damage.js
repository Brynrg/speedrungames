export const DAMAGE_LABELS = {
  piercing: "Piercing",
  magic: "Magic",
  siege: "Siege",
  spell: "Spell",
};

export const ARMOR_LABELS = {
  unarmored: "Unarmored",
  light: "Light",
  medium: "Medium",
  heavy: "Heavy",
  fortified: "Fortified",
};

export const DAMAGE_TABLE = {
  piercing: { unarmored: 1, light: 1.5, medium: 1, heavy: 0.75, fortified: 0.35 },
  magic: { unarmored: 1.25, light: 1, medium: 0.75, heavy: 1.25, fortified: 0.35 },
  siege: { unarmored: 1, light: 0.75, medium: 0.75, heavy: 1, fortified: 1.5 },
  spell: { unarmored: 1.1, light: 1.1, medium: 1.1, heavy: 1.1, fortified: 1.1 },
};
