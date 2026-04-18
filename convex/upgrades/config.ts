export const DEFAULT_COST_MULTIPLIER = 1.5;

export const UPGRADES = [
  { key: "click", name: "Stronger Click", emoji: "💪", baseCost: 5, cps: 0, clickPower: 1, costMultiplier: 1.5 },
  { key: "cursor", name: "Cursor", emoji: "👆", baseCost: 10, cps: 1, clickPower: 0, costMultiplier: 1.5 },
  { key: "grandma", name: "Grandma", emoji: "👵", baseCost: 100, cps: 12, clickPower: 0, costMultiplier: 1.5 },
  { key: "farm", name: "Farm", emoji: "🌾", baseCost: 1000, cps: 140, clickPower: 0, costMultiplier: 1.5 },
  { key: "mine", name: "Mine", emoji: "⛏️", baseCost: 10000, cps: 1600, clickPower: 0, costMultiplier: 1.5 },
  { key: "gstack", name: "Gstack", emoji: "🧠", baseCost: 1000000000, cps: 0, clickPower: 0, costMultiplier: 1.5 },
] as const;

export type UpgradeKey = (typeof UPGRADES)[number]["key"];
export type UpgradeConfig = (typeof UPGRADES)[number];

export const UPGRADE_KEYS: readonly UpgradeKey[] = UPGRADES.map((u) => u.key);

export function costAt(
  baseCost: number,
  owned: number,
  multiplier: number = DEFAULT_COST_MULTIPLIER,
): number {
  return Math.floor(baseCost * multiplier ** owned);
}

export function totalCps(
  ownedByKey: Partial<Record<UpgradeKey, number>>,
): number {
  return UPGRADES.reduce(
    (sum, u) => sum + u.cps * (ownedByKey[u.key] ?? 0),
    0,
  );
}

export function totalClickPower(
  ownedByKey: Partial<Record<UpgradeKey, number>>,
): number {
  return (
    1 +
    UPGRADES.reduce(
      (sum, u) => sum + u.clickPower * (ownedByKey[u.key] ?? 0),
      0,
    )
  );
}

export function getUpgrade(key: string): UpgradeConfig | undefined {
  return UPGRADES.find((u) => u.key === key);
}
