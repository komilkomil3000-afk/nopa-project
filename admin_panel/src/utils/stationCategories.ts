// A station's class categories are free text defined in the admin panel and there can be any number of them.
// Nothing classifies a category by keywords in its title ("مهارت" / "رسانه"): a category is identified by its
// position (orderIndex, ties broken by creation time) and shown under its own title everywhere.

import prisma from '../config/db';

/** Prisma orderBy for categories: admin-panel order, creation time breaks ties (e.g. rows whose orderIndex was reset). */
export const CATEGORY_ORDER_BY = [{ orderIndex: 'asc' as const }, { createdAt: 'asc' as const }];

/** Progress track label of the category at [index]; the first two keep the historical 'skill' / 'media'. */
export function trackTypeFor(index: number): string {
  if (index <= 0) return 'skill';
  if (index === 1) return 'media';
  return `category_${index + 1}`;
}

/** Calendar event type of the category at [index] (older app builds only know these two). */
export function calendarTypeFor(index: number): 'skillClass' | 'mediaClass' {
  return index <= 0 ? 'skillClass' : 'mediaClass';
}

/** Sorts categories in place-independent fashion (returns a new array). */
export function orderCategories<T extends { orderIndex?: number | null; createdAt?: Date | string | null }>(cats: T[]): T[] {
  return cats
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const oa = Number(a.c.orderIndex) || 0;
      const ob = Number(b.c.orderIndex) || 0;
      if (oa !== ob) return oa - ob;
      const ta = a.c.createdAt ? new Date(a.c.createdAt).getTime() : 0;
      const tb = b.c.createdAt ? new Date(b.c.createdAt).getTime() : 0;
      return ta !== tb ? ta - tb : a.i - b.i;
    })
    .map(x => x.c);
}

/** Track type of a category, from its position among the station's categories. */
export async function trackTypeForCategory(db: any, categoryId: string | null | undefined, stationId: string | null | undefined): Promise<string> {
  if (!categoryId || !stationId) return 'skill';
  const client = db || prisma;
  const siblings = await client.classCategory.findMany({
    where: { stationId },
    select: { id: true },
    orderBy: CATEGORY_ORDER_BY,
  });
  const index = siblings.findIndex((c: any) => c.id === categoryId);
  return trackTypeFor(index < 0 ? 0 : index);
}
