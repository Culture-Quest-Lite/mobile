import { MaxContentWidth, ScreenHorizontalPadding } from "@/constants/theme";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type UseScreenLayoutOptions = {
  compactWidthBreakpoint?: number;
  maxContentWidth?: number;
};

export function useScreenLayout(options: UseScreenLayoutOptions = {}) {
  const { compactWidthBreakpoint = 340, maxContentWidth = MaxContentWidth } = options;
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const safeWidth = Math.max(width - insets.left - insets.right, 0);
  const isCompactWidth = safeWidth <= compactWidthBreakpoint;
  const gutter = ScreenHorizontalPadding;
  const contentMaxWidth = Math.min(maxContentWidth, safeWidth);
  const contentWidth = Math.min(Math.max(safeWidth - gutter * 2, 0), contentMaxWidth);
  const scrollContentMinHeight = height + insets.top + insets.bottom;

  return {
    contentMaxWidth,
    contentWidth,
    gutter,
    height,
    insets,
    isCompactWidth,
    safeWidth,
    scrollContentMinHeight,
    width,
  };
}
