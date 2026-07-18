import { getCachedHotspotDetail } from "../data/hotspot-detail-cache";

function readFirstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveHotspotIdParam(value?: string | string[]) {
  const parsedValue = Number(readFirstValue(value));

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

export function resolveRouteIdParam(value?: string | string[]) {
  const parsedValue = Number(readFirstValue(value));

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

export function resolveApiHotspotIdFromSlug(slug?: string | string[]) {
  const resolvedSlug = readFirstValue(slug)?.trim().toLowerCase() ?? "";
  const matchedHotspotId = resolvedSlug.match(/^api-hotspot-(\d+)$/);

  if (!matchedHotspotId) {
    return null;
  }

  const parsedValue = Number(matchedHotspotId[1]);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

export function resolveSelectedHotspotId({
  hotspotId,
  slug,
}: {
  hotspotId?: string | string[];
  slug?: string | string[];
}) {
  const hotspotIdFromParam = resolveHotspotIdParam(hotspotId);

  if (hotspotIdFromParam !== null) {
    return hotspotIdFromParam;
  }

  const hotspotIdFromSlug = resolveApiHotspotIdFromSlug(slug);

  if (hotspotIdFromSlug !== null) {
    return hotspotIdFromSlug;
  }

  return getCachedHotspotDetail({
    slug: readFirstValue(slug),
  })?.hotspotId ?? null;
}
