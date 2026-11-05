import prisma from '../config/db';

/**
 * The challenge taxonomy («فرهنگ اصطلاحات»), docs/specs/chat-access-matrix.md Part 1.
 * Three fixed categories, keyed by Challenge.category. The keys and who may create each are bound to the code;
 * admins edit only how they are named and explained. Stored as one JSON row in SystemSetting, merged over the defaults.
 */
export const TAXONOMY_KEYS = ['individual', 'intra_group', 'inter_group'] as const;
export type TaxonomyKey = typeof TAXONOMY_KEYS[number];

export interface TaxonomyEntry {
  key: TaxonomyKey;
  label: string;        // full name, e.g. «چالش شخصی»
  shortLabel: string;   // tags and tabs, e.g. «شخصی»
  definition: string;
  target: string;       // who receives it
  icon: string;         // Font Awesome name without the fa- prefix
  color: string;        // #RRGGBB
  // fixed by the code (shown, not editable)
  creatorRole: 'mentor' | 'admin';
  creator: string;
  rewards: string;
  conversation: string;
  replaces: string[];   // retired terms this category replaces
}

const SETTING_KEY = 'challenge_taxonomy';

export const DEFAULT_TAXONOMY: Record<TaxonomyKey, TaxonomyEntry> = {
  individual: {
    key: 'individual', label: 'چالش شخصی', shortLabel: 'شخصی',
    definition: 'چالشی که راهبر برای یک عضو یا چند عضو انتخاب‌شده از کاروان خود می‌سازد (نه همه‌ی کاروان).',
    target: 'یک عضو یا گروهی انتخاب‌شده از اعضای کاروان', icon: 'user', color: '#7C9CF5',
    creatorRole: 'mentor', creator: 'راهبر', rewards: 'زریک یا کلاف (راهبر تعیین می‌کند)',
    conversation: 'گفتگوی خصوصی جدا با هر عضو انتخاب‌شده', replaces: ['چالش فردی'],
  },
  intra_group: {
    key: 'intra_group', label: 'چالش گروهی', shortLabel: 'گروهی',
    definition: 'چالشی که راهبر برای همه‌ی اعضای کاروان خود می‌سازد.',
    target: 'همه‌ی اعضای کاروان راهبر', icon: 'users', color: '#DFB690',
    creatorRole: 'mentor', creator: 'راهبر', rewards: 'زریک یا کلاف (راهبر تعیین می‌کند)',
    conversation: '«گروه چالش‌ها»ی همان کاروان', replaces: ['چالش درون‌گروهی'],
  },
  inter_group: {
    key: 'inter_group', label: 'چالش فراگروهی', shortLabel: 'فراگروهی',
    definition: 'چالشی که مدیر برای همه‌ی کاروان‌ها با هم می‌سازد؛ کاروان‌ها اثرشان را می‌فرستند و مدیر رتبه‌بندی می‌کند.',
    target: 'همه‌ی کاروان‌ها', icon: 'globe', color: '#CD8449',
    creatorRole: 'admin', creator: 'مدیر', rewards: 'درفش برای کاروان؛ زریک و کلاف برای اعضا به نسبت مشارکت',
    conversation: '«میدان آثار» و «گروه چالش‌ها»ی هر کاروان', replaces: ['چالش میان‌گروهی', 'چالش برون‌گروهی', 'چالش عمومی'],
  },
};

const EDITABLE = ['label', 'shortLabel', 'definition', 'target', 'icon', 'color'] as const;
type Editable = typeof EDITABLE[number];
const LIMITS: Record<Editable, number> = { label: 40, shortLabel: 20, definition: 400, target: 120, icon: 40, color: 7 };

let cache: { at: number; value: Record<TaxonomyKey, TaxonomyEntry> } | null = null;

/** The current taxonomy: the admin's edits over the defaults. Never throws. */
export async function getTaxonomy(): Promise<Record<TaxonomyKey, TaxonomyEntry>> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const value = structuredClone(DEFAULT_TAXONOMY);
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    const saved = row ? JSON.parse(row.value) : {};
    for (const key of TAXONOMY_KEYS) {
      for (const field of EDITABLE) {
        const v = saved?.[key]?.[field];
        if (typeof v === 'string' && v.trim()) (value[key] as any)[field] = v.trim();
      }
    }
  } catch (e) {
    console.error('getTaxonomy error (using defaults):', e);
  }
  cache = { at: Date.now(), value };
  return value;
}

/** Short label of a category for tags, falling back to the default. */
export async function categoryLabel(category: string, short = true): Promise<string> {
  const t = await getTaxonomy();
  const entry = t[category as TaxonomyKey] ?? t.intra_group;
  return short ? entry.shortLabel : entry.label;
}

/** Validates and saves the editable fields. Body: { individual: {label, ...}, intra_group: {...}, inter_group: {...} }. */
export async function saveTaxonomy(raw: any): Promise<{ error: string } | { value: Record<TaxonomyKey, TaxonomyEntry> }> {
  if (!raw || typeof raw !== 'object') return { error: 'اطلاعات ارسال نشده است' };
  const out: Record<string, Record<string, string>> = {};
  const labels = new Set<string>();
  for (const key of TAXONOMY_KEYS) {
    out[key] = {};
    for (const field of EDITABLE) {
      const v = String(raw?.[key]?.[field] ?? DEFAULT_TAXONOMY[key][field]).trim();
      if (!v) return { error: `«${DEFAULT_TAXONOMY[key].label}»: مقدار خالی مجاز نیست` };
      if (v.length > LIMITS[field]) return { error: `«${DEFAULT_TAXONOMY[key].label}»: متن بیش از حد طولانی است` };
      out[key][field] = v;
    }
    if (!/^#[0-9a-f]{6}$/i.test(out[key].color)) return { error: 'رنگ باید به شکل #RRGGBB باشد' };
    if (!/^[a-z0-9-]+$/.test(out[key].icon)) return { error: 'نام آیکون معتبر نیست' };
    for (const l of [out[key].label, out[key].shortLabel]) {
      if (labels.has(l)) return { error: `نام «${l}» برای دو دسته تکرار شده است` };
    }
    labels.add(out[key].label);
    labels.add(out[key].shortLabel);
  }
  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(out) },
    create: { key: SETTING_KEY, value: JSON.stringify(out) },
  });
  cache = null;
  return { value: await getTaxonomy() };
}
