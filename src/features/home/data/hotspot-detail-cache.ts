import type { HotspotDetail } from "./hotspots";

export type CachedHotspotDetailEntry = {
  hotspot: HotspotDetail;
  hotspotId: number | null;
  slug: string;
  updatedAt: number;
};

const hotspotsBySlug = new Map<string, CachedHotspotDetailEntry>();
const hotspotsByHotspotId = new Map<number, CachedHotspotDetailEntry>();

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase();
}

export function cacheHotspotDetail(entry: {
  hotspot: HotspotDetail;
  hotspotId?: number | null;
  slug: string;
}) {
  const normalizedSlug = normalizeSlug(entry.slug);
  const cachedEntry: CachedHotspotDetailEntry = {
    hotspot: entry.hotspot,
    hotspotId:
      typeof entry.hotspotId === "number" && Number.isInteger(entry.hotspotId)
        ? entry.hotspotId
        : null,
    slug: normalizedSlug,
    updatedAt: Date.now(),
  };

  hotspotsBySlug.set(normalizedSlug, cachedEntry);

  if (cachedEntry.hotspotId !== null) {
    hotspotsByHotspotId.set(cachedEntry.hotspotId, cachedEntry);
  }

  return cachedEntry;
}

export function getCachedHotspotDetail({
  hotspotId,
  slug,
}: {
  hotspotId?: number | null;
  slug?: string;
}) {
  if (typeof hotspotId === "number" && Number.isInteger(hotspotId)) {
    const entry = hotspotsByHotspotId.get(hotspotId);

    if (entry) {
      return entry;
    }
  }

  if (typeof slug === "string" && slug.trim()) {
    return hotspotsBySlug.get(normalizeSlug(slug)) ?? null;
  }

  return null;
}
