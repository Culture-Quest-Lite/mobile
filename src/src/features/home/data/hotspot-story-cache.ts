import type { HotspotThemeStory } from "./hotspot-theme-stories";

export type CachedHotspotStoriesEntry = {
  hotspotId: number | null;
  slug: string;
  stories: HotspotThemeStory[];
  updatedAt: number;
};

const storiesBySlug = new Map<string, CachedHotspotStoriesEntry>();
const storiesByHotspotId = new Map<number, CachedHotspotStoriesEntry>();

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase();
}

export function cacheHotspotStories(entry: {
  hotspotId?: number | null;
  slug: string;
  stories: HotspotThemeStory[];
}) {
  const normalizedSlug = normalizeSlug(entry.slug);
  const cachedEntry: CachedHotspotStoriesEntry = {
    hotspotId:
      typeof entry.hotspotId === "number" && Number.isInteger(entry.hotspotId)
        ? entry.hotspotId
        : null,
    slug: normalizedSlug,
    stories: [...entry.stories],
    updatedAt: Date.now(),
  };

  storiesBySlug.set(normalizedSlug, cachedEntry);

  if (cachedEntry.hotspotId !== null) {
    storiesByHotspotId.set(cachedEntry.hotspotId, cachedEntry);
  }

  return cachedEntry;
}

export function getCachedHotspotStories({
  hotspotId,
  slug,
}: {
  hotspotId?: number | null;
  slug?: string;
}) {
  if (typeof hotspotId === "number" && Number.isInteger(hotspotId)) {
    const entry = storiesByHotspotId.get(hotspotId);

    if (entry) {
      return entry;
    }
  }

  if (typeof slug === "string" && slug.trim()) {
    return storiesBySlug.get(normalizeSlug(slug)) ?? null;
  }

  return null;
}
