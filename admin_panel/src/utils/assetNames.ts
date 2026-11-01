import prisma from '../config/db';

// Built-in names; the AssetType table overrides them
export const DEFAULT_ASSET_NAMES: Record<string, string> = {
  zarik: 'زریک',
  nakh: 'کلاف',
  farsh: 'قالیچه',
  derafsh: 'درفش',
  derafsh_gold: 'درفش طلایی',
  derafsh_silver: 'درفش نقره‌ای',
  derafsh_bronze: 'درفش برنزی',
  derafsh_cloth: 'درفش پارچه‌ای',
};

let cache: { at: number; names: Record<string, string> } | null = null;

export function invalidateAssetNames() {
  cache = null;
}

export async function getAssetNames(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < 30_000) return cache.names;
  const names = { ...DEFAULT_ASSET_NAMES };
  try {
    const rows = await prisma.assetType.findMany();
    for (const r of rows) if (r.nameFa && r.nameFa.trim()) names[r.key] = r.nameFa.trim();
  } catch (e) {
    console.error('getAssetNames error (using defaults):', e);
  }
  cache = { at: Date.now(), names };
  return names;
}
