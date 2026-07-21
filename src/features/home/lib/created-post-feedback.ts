import type { CreatedPostResponse } from "../api/create-post";

function normalizeCreatedPostStatus(value?: string | null) {
  return value?.trim().toUpperCase() ?? "";
}

function formatPointReward(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function getCreatedPostRewardMessage(createdPost: CreatedPostResponse) {
  const resolvedReward =
    typeof createdPost.pointRemaining === "number" &&
    Number.isFinite(createdPost.pointRemaining)
      ? Math.max(0, Math.round(createdPost.pointRemaining))
      : 0;

  if (resolvedReward <= 0) {
    return null;
  }

  const normalizedStatus = normalizeCreatedPostStatus(createdPost.status);
  const formattedReward = formatPointReward(resolvedReward);

  if (normalizedStatus === "APPROVED") {
    return `Bài viết này có phần thưởng ${formattedReward} điểm.`;
  }

  return `Bạn sẽ nhận ${formattedReward} điểm khi bài viết được duyệt.`;
}

export function isCreatedPostApproved(createdPost: CreatedPostResponse) {
  return normalizeCreatedPostStatus(createdPost.status) === "APPROVED";
}

export function isCreatedPostPending(createdPost: CreatedPostResponse) {
  return normalizeCreatedPostStatus(createdPost.status) === "PENDING";
}
