import type { Href } from 'expo-router';

import { getCachedHotspotDetail } from '@/features/home/data/hotspot-detail-cache';
import { getHotspotBySlug, getHotspotHref } from '@/features/home/data/hotspots';


const ROUTE_HOTSPOT_SLUG_MAP: Record<string, string> = {
  'ben-thanh': 'ben-thanh',
  'buu-dien': 'buu-dien-sai-gon',
  'nha-tho-duc-ba': 'nha-tho-duc-ba',
  'dinh-doc-lap': 'dinh-doc-lap',
  'bao-tang': 'bao-tang-my-thuat',
  'pho-di-bo': 'pho-di-bo-nguyen-hue',
  'thien-hau': 'thien-hau',
  'cho-lon': 'cho-lon',
};

export function resolveHotspotDetailSlug(routeHotspotId: string): string | undefined {
  const slug = ROUTE_HOTSPOT_SLUG_MAP[routeHotspotId] ?? routeHotspotId;
  return getHotspotBySlug(slug) ? slug : undefined;
}

function resolveKnownHotspotId(routeHotspotId: string, slug: string) {
  const parsedHotspotId = Number(routeHotspotId);

  if (Number.isInteger(parsedHotspotId) && parsedHotspotId > 0) {
    return parsedHotspotId;
  }

  return getCachedHotspotDetail({ slug })?.hotspotId ?? null;
}

export function getHotspotDetailHref(
  routeHotspotId: string,
  routeId?: number | string | null,
): Href | undefined {
  const slug = resolveHotspotDetailSlug(routeHotspotId);

  if (!slug) {
    return undefined;
  }

  return getHotspotHref(
    slug,
    resolveKnownHotspotId(routeHotspotId, slug),
    routeId,
  );
}

function normalizeRouteId(routeId?: number | string | null) {
  const parsedRouteId =
    typeof routeId === 'number' ? routeId : Number(routeId ?? NaN);

  return Number.isInteger(parsedRouteId) && parsedRouteId > 0
    ? parsedRouteId
    : null;
}

export function getHotspotStoriesHref(
  routeHotspotId: string,
  routeId?: number | string | null,
): Href | undefined {
  const slug = resolveHotspotDetailSlug(routeHotspotId);

  if (!slug) {
    return undefined;
  }

  const hotspotId = resolveKnownHotspotId(routeHotspotId, slug);
  const normalizedRouteId = normalizeRouteId(routeId);

  return hotspotId !== null
    ? ({
        params: {
          hotspotId: `${hotspotId}`,
          ...(normalizedRouteId !== null
            ? { routeId: `${normalizedRouteId}` }
            : {}),
          slug,
        },
        pathname: '/hotspot/[slug]/stories',
      } as Href)
    : (`/hotspot/${slug}/stories` as Href);
}
