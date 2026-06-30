import { useScreenLayout } from "@/hooks/use-screen-layout";

const AUTH_CARD_MAX_WIDTH = 390;

export function useAuthScreenLayout(compactHeightThreshold: number) {
  const layout = useScreenLayout({ maxContentWidth: AUTH_CARD_MAX_WIDTH });
  const isCompactScreen =
    layout.isCompactWidth || layout.height <= compactHeightThreshold;
  const horizontalPadding = layout.safeWidth <= 360 ? 18 : 22;
  const cardMaxWidth = Math.min(
    Math.max(layout.safeWidth - horizontalPadding * 2, 0),
    AUTH_CARD_MAX_WIDTH,
  );

  return {
    ...layout,
    backButtonTop: layout.insets.top + (isCompactScreen ? 10 : 12),
    cardMaxWidth,
    horizontalPadding,
    isCompactScreen,
  };
}
