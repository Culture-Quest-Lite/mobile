import {
  normalizePostVisibilityValue,
  type PostVisibilityValue,
} from "@/lib/post-visibility";

let currentCommunityPostVisibility: PostVisibilityValue = "PUBLIC";

export function getCommunityPostVisibility() {
  return currentCommunityPostVisibility;
}

export function setCommunityPostVisibility(value: PostVisibilityValue) {
  currentCommunityPostVisibility = normalizePostVisibilityValue(value);
  return currentCommunityPostVisibility;
}
