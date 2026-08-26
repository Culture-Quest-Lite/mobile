import type { HotspotThemeStory } from "./hotspot-theme-stories";

export type CachedHotspotStoriesEntry = {
  hotspotId: number | null;
  routeId: number | null;
  slug: string;
  stories: HotspotThemeStory[];
  updatedAt: number;
};

const storiesBySlugAndRoute = new Map<string, CachedHotspotStoriesEntry>();
const storiesByHotspotIdAndRoute = new Map<string, CachedHotspotStoriesEntry>();

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase();
}

function normalizeRouteId(routeId?: number | null) {
  return typeof routeId === "number" && Number.isInteger(routeId) && routeId > 0
    ? routeId
    : null;
}

function buildSlugLookupKey(slug: string, routeId?: number | null) {
  return `${normalizeSlug(slug)}::route:${normalizeRouteId(routeId) ?? "global"}`;
}

function buildHotspotLookupKey(hotspotId: number, routeId?: number | null) {
  return `${hotspotId}::route:${normalizeRouteId(routeId) ?? "global"}`;
}

export function cacheHotspotStories(entry: {
  hotspotId?: number | null;
  routeId?: number | null;
  slug: string;
  stories: HotspotThemeStory[];
}) {
  const normalizedSlug = normalizeSlug(entry.slug);
  const cachedEntry: CachedHotspotStoriesEntry = {
    hotspotId:
      typeof entry.hotspotId === "number" && Number.isInteger(entry.hotspotId)
        ? entry.hotspotId
        : null,
    routeId: normalizeRouteId(entry.routeId),
    slug: normalizedSlug,
    stories: [...entry.stories],
    updatedAt: Date.now(),
  };

  storiesBySlugAndRoute.set(
    buildSlugLookupKey(normalizedSlug, cachedEntry.routeId),
    cachedEntry,
  );

  if (cachedEntry.hotspotId !== null) {
    storiesByHotspotIdAndRoute.set(
      buildHotspotLookupKey(cachedEntry.hotspotId, cachedEntry.routeId),
      cachedEntry,
    );
  }

  return cachedEntry;
}

export function getCachedHotspotStories({
  hotspotId,
  routeId,
  slug,
}: {
  hotspotId?: number | null;
  routeId?: number | null;
  slug?: string;
}) {
  if (typeof hotspotId === "number" && Number.isInteger(hotspotId)) {
    const entry = storiesByHotspotIdAndRoute.get(
      buildHotspotLookupKey(hotspotId, routeId),
    );

    if (entry) {
      return entry;
    }
  }

  if (typeof slug === "string" && slug.trim()) {
    return (
      storiesBySlugAndRoute.get(buildSlugLookupKey(slug, routeId)) ?? null
    );
  }

  return null;
}
