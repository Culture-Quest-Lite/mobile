import type { HotspotReview } from "../api/get-hotspot-reviews";

const reviewEditCache = new Map<number, HotspotReview>();

export function cacheHotspotReviewForEdit(review: HotspotReview) {
  reviewEditCache.set(review.reviewId, {
    ...review,
    medias: review.medias.map((media) => ({ ...media })),
  });
}

export function getCachedHotspotReviewForEdit(reviewId: number) {
  return reviewEditCache.get(reviewId) ?? null;
}

export function clearCachedHotspotReviewForEdit(reviewId: number) {
  reviewEditCache.delete(reviewId);
}
