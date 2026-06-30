import { MaxContentWidth } from "@/constants/theme";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type UseScreenLayoutOptions = {
  compactWidthBreakpoint?: number;
  maxContentWidth?: number;
};

export function useScreenLayout(options: UseScreenLayoutOptions = {}) {
  const { compactWidthBreakpoint = 360, maxContentWidth = MaxContentWidth } = options;
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const safeWidth = Math.max(width - insets.left - insets.right, 0);
  const isCompactWidth = safeWidth <= compactWidthBreakpoint;
  const gutter = safeWidth < 360 ? 10 : safeWidth < 428 ? 14 : 18;
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
