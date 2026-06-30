import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { type ComponentProps, type ReactNode } from "react";

const materialGlyphMap = require("@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json") as Record<
  string,
  number
>;

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

const symbolAliases: Record<string, string> = {
  "arrow.down.circle": "download",
  "arrow.down.right": "trending-down",
  "arrow.right": "arrow-forward",
  "arrow.turn.up.right": "reply",
  "arrow.up.right": "trending-up",
  "arrowshape.turn.up.right.fill": "reply",
  bell: "notifications",
  "book.closed.fill": "menu-book",
  bookmark: "bookmark",
  "bubble.left": "chat-bubble",
  "bubble.left.and.bubble.right": "forum",
  "bubble.left.fill": "chat",
  "building.2.fill": "apartment",
  "building.columns": "account-balance",
  "building.columns.fill": "account-balance",
  camera: "photo-camera",
  "camera.fill": "photo-camera",
  "chart.bar.fill": "bar-chart",
  "chart.line.uptrend.xyaxis": "show-chart",
  checkmark: "check",
  "checkmark.circle.fill": "check-circle",
  "checkmark.seal": "verified",
  "checkmark.seal.fill": "verified",
  "chevron.left": "arrow-back",
  "chevron.right": "arrow-forward-ios",
  clock: "schedule",
  "clock.arrow.circlepath": "history",
  "clock.fill": "schedule",
  "crown.fill": "workspace-premium",
  "doc.text": "description",
  "doc.text.image.fill": "perm-media",
  "dollarsign.circle.fill": "monetization-on",
  ellipsis: "more-horiz",
  "envelope.badge.fill": "mail",
  "figure.walk": "directions-walk",
  "flame.fill": "local-fire-department",
  "fork.knife": "restaurant",
  "gift.fill": "redeem",
  globe: "public",
  "hand.thumbsup": "thumb-up",
  "hand.thumbsup.fill": "thumb-up",
  heart: "favorite-border",
  "heart.fill": "favorite",
  hourglass: "hourglass-empty",
  "info.circle": "info",
  "leaf.fill": "park",
  "lightbulb.fill": "lightbulb",
  "line.3.horizontal": "menu",
  "list.bullet": "format-list-bulleted",
  "list.number": "format-list-numbered",
  location: "my-location",
  "location.fill": "place",
  "lock.fill": "lock",
  "lock.shield": "shield",
  magnifyingglass: "search",
  map: "map",
  "map.fill": "map",
  "mappin.and.ellipse": "location-on",
  "mappin.circle.fill": "place",
  minus: "remove",
  "mountain.2": "terrain",
  "music.note": "music-note",
  paintbrush: "brush",
  paintpalette: "palette",
  "paintpalette.fill": "palette",
  "paperplane.fill": "send",
  "pause.fill": "pause",
  pencil: "edit",
  person: "person",
  "person.2.fill": "groups",
  "person.3.fill": "groups",
  "person.crop.circle.badge.plus": "person-add",
  "person.fill": "person",
  phone: "call",
  photo: "photo",
  "photo.on.rectangle.angled": "image",
  "play.fill": "play-arrow",
  "play.slash.fill": "play-disabled",
  "questionmark.circle": "help-outline",
  "record.circle": "fiber-manual-record",
  "rectangle.grid.1x2": "dashboard",
  "rectangle.portrait.and.arrow.right": "logout",
  rosette: "verified",
  safari: "explore",
  "safari.fill": "explore",
  "slider.horizontal.3": "tune",
  sparkles: "auto-awesome",
  "speaker.wave.2.fill": "volume-up",
  "square.and.arrow.up": "share",
  "square.grid.2x2.fill": "grid-view",
  "star.fill": "star",
  "sun.max.fill": "wb-sunny",
  "theatermasks.fill": "theater-comedy",
  "ticket.fill": "confirmation-number",
  "trophy.fill": "emoji-events",
  waveform: "graphic-eq",
  xmark: "close",
};

export type SymbolName =
  | string
  | {
      ios?: string;
      android?: string;
      web?: string;
    };

export type SymbolViewProps = Omit<ComponentProps<typeof MaterialIcons>, "color" | "name"> & {
  fallback?: ReactNode;
  name: SymbolName;
  tintColor?: ComponentProps<typeof MaterialIcons>["color"];
  type?: string;
  weight?: string;
};

function isMaterialIconName(name: string): name is MaterialIconName {
  return Object.prototype.hasOwnProperty.call(materialGlyphMap, name);
}

function isNonEmptyString(value: string | undefined): value is string {
  return Boolean(value);
}

function getNameCandidates(name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return [];
  }

  const aliasedName = symbolAliases[trimmedName];
  const normalizedName = trimmedName.replace(/_/g, "-");

  return Array.from(new Set([trimmedName, normalizedName, aliasedName].filter(isNonEmptyString)));
}

function resolveMaterialIconName(name: SymbolName): MaterialIconName | null {
  const platformNames =
    typeof name === "string" ? [name] : [name.android, name.web, name.ios].filter(isNonEmptyString);

  for (const platformName of platformNames) {
    for (const candidate of getNameCandidates(platformName)) {
      if (isMaterialIconName(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

export function SymbolView({
  allowFontScaling,
  fallback,
  name,
  size = 24,
  tintColor,
  type: _type,
  weight: _weight,
  ...props
}: SymbolViewProps) {
  const resolvedName = resolveMaterialIconName(name);
  const iconSize = size + 1;

  if (!resolvedName) {
    return fallback ?? (
      <MaterialIcons
        {...props}
        allowFontScaling={allowFontScaling ?? false}
        color={tintColor}
        name="help-outline"
        size={iconSize}
      />
    );
  }

  return (
    <MaterialIcons
      {...props}
      allowFontScaling={allowFontScaling ?? false}
      color={tintColor}
      name={resolvedName}
      size={iconSize}
    />
  );
}
