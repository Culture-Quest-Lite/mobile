import type { SymbolName } from "@/components/ui/symbol-view";

export type PostVisibilityValue = "PUBLIC" | "FRIENDS" | "PRIVATE";

export const postVisibilityOptions = [
  "PUBLIC",
  "FRIENDS",
  "PRIVATE",
] as const satisfies readonly PostVisibilityValue[];

function readVisibilityToken(value?: string | null) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function normalizePostVisibilityValue(
  value?: string | null,
): PostVisibilityValue {
  switch (readVisibilityToken(value)) {
    case "FRIENDS":
    case "PRIVATE":
      return readVisibilityToken(value) as PostVisibilityValue;
    case "PUBLIC":
    default:
      return "PUBLIC";
  }
}

export function getPostVisibilityLabel(value?: string | null) {
  const normalizedValue = readVisibilityToken(value);

  switch (normalizedValue) {
    case "PRIVATE":
      return "Chỉ mình tôi";
    case "FRIENDS":
      return "Bạn bè";
    case "FOLLOWER":
      return "Chỉ follower";
    case "PUBLIC":
      return "Công khai";
    default:
      return typeof value === "string" && value.trim() ? value.trim() : "Công khai";
  }
}

export function getPostVisibilityDescription(value: PostVisibilityValue) {
  switch (value) {
    case "FRIENDS":
      return "Bạn bè của bạn trên Culture Quest Lite.";
    case "PRIVATE":
      return "Chỉ bạn mới có thể xem bài viết này.";
    case "PUBLIC":
    default:
      return "Mọi người đều có thể xem bài viết này.";
  }
}

export function getPostVisibilityIcon(value?: string | null): SymbolName {
  const normalizedValue = readVisibilityToken(value);

  switch (normalizedValue) {
    case "PRIVATE":
      return {
        ios: "lock.fill",
        android: "lock",
        web: "lock",
      };
    case "FRIENDS":
    case "FOLLOWER":
      return {
        ios: "person.2.fill",
        android: "groups",
        web: "groups",
      };
    case "PUBLIC":
    default:
      return {
        ios: "globe.asia.australia.fill",
        android: "public",
        web: "public",
      };
  }
}
