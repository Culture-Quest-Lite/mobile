import type {
  CreatedPostMedia,
  CreatedPostResponse,
  CreatedPostTag,
} from "@/features/home/api/create-post";

import type { ProfilePost, ProfilePostMedia, ProfilePostTag } from "../types";

function mapCreatedPostTagToProfilePostTag(tag: CreatedPostTag): ProfilePostTag {
  return {
    id: tag.tagId,
    name: tag.tagName,
  };
}

function mapCreatedPostMediaToProfilePostMedia(
  media: CreatedPostMedia,
): ProfilePostMedia {
  return {
    id: media.mediaId,
    type: media.mediaType,
    mimeType: media.mimeType,
    url: media.fileUrl,
    fileName: media.fileName,
    fileSize: media.fileSize,
    displayOrder: media.displayOrder,
    createdAt: media.createdAt,
    updatedAt: media.updatedAt,
  };
}

function sortProfilePostMediaItems(
  left: ProfilePostMedia,
  right: ProfilePostMedia,
) {
  const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left.id - right.id;
}

export function mapCreatedPostToProfilePost(
  createdPost: CreatedPostResponse,
): ProfilePost {
  const medias = createdPost.medias
    .map(mapCreatedPostMediaToProfilePostMedia)
    .sort(sortProfilePostMediaItems);
  const firstImage =
    medias.find((media) => media.type.trim().toUpperCase() === "IMAGE") ??
    medias[0] ??
    null;

  return {
    commentCount: createdPost.commentCount,
    id: `${createdPost.postId}`,
    userId: `${createdPost.userId}`,
    username: createdPost.username,
    displayName: createdPost.displayName,
    text: createdPost.content,
    image: firstImage?.url ?? null,
    visibility: createdPost.visibility,
    status: createdPost.status,
    reason: createdPost.reason,
    isTaggedHotspot: createdPost.isTaggedHotspot,
    isTaggedRoute: createdPost.isTaggedRoute,
    hotspotIds: [...createdPost.hotspotIds],
    routeIds: [...createdPost.routeIds],
    tags: createdPost.tags.map(mapCreatedPostTagToProfilePostTag),
    medias,
    createdAt: createdPost.createdAt,
    isLiked: createdPost.isLiked,
    likeCount: createdPost.likeCount,
    pointRemaining: createdPost.pointRemaining,
    replyCount: 0,
    shareCount: createdPost.shareCount,
    sharedPost: null,
  };
}
