import { useScreenLayout } from "@/hooks/use-screen-layout";

const AUTH_CARD_MAX_WIDTH = 430;

export function useAuthScreenLayout(compactHeightThreshold: number) {
  const layout = useScreenLayout({ maxContentWidth: AUTH_CARD_MAX_WIDTH });
  const isCompactScreen =
    layout.isCompactWidth || layout.height <= compactHeightThreshold;
  const horizontalPadding = layout.gutter;
  const cardMaxWidth = Math.min(
    Math.max(layout.safeWidth - horizontalPadding * 2, 0),
    AUTH_CARD_MAX_WIDTH,
  );

  return {
    ...layout,
    backButtonTop: layout.insets.top + (isCompactScreen ? 12 : 14),
    cardMaxWidth,
    horizontalPadding,
    isCompactScreen,
  };
}
