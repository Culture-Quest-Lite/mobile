function normalizeHotspotStatus(status: string) {
  return status.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function isPublishedHotspotStatus(status: string) {
  const normalizedStatus = normalizeHotspotStatus(status);

  return normalizedStatus === "publish" || normalizedStatus === "published";
}
