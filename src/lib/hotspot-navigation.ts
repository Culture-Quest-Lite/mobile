import type { Href } from 'expo-router';

import { getHotspotBySlug } from '@/features/home/data/hotspots';


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

export function getHotspotDetailHref(routeHotspotId: string): Href | undefined {
  const slug = resolveHotspotDetailSlug(routeHotspotId);
  return slug ? (`/hotspot/${slug}` as Href) : undefined;
}

export function getHotspotStoriesHref(routeHotspotId: string): Href | undefined {
  const slug = resolveHotspotDetailSlug(routeHotspotId);
  return slug ? (`/hotspot/${slug}/stories` as Href) : undefined;
}
