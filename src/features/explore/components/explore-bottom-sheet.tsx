import { useEffect, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

/**
 * Bottom sheet 3 nấc cho màn Khám phá.
 *
 * Vì sao dùng reanimated + gesture-handler thay vì `PanResponder` + `Animated`:
 * cử chỉ kéo chạy thẳng trên UI thread, không phải đi qua cầu JS từng frame nên
 * không khựng khi bản đồ và danh sách đang render. Cùng cách làm với bottom
 * sheet ở màn "Địa danh gần bạn" (`all-hotspots-screen`).
 */

export type ExploreSheetSnap = 'full' | 'half' | 'peek';

const snapOrder: ExploreSheetSnap[] = ['full', 'half', 'peek'];

const springConfig = {
  damping: 22,
  mass: 0.95,
  overshootClamping: false,
  stiffness: 210,
} as const;

/** Quãng đường vận tốc thả tay được quy đổi ra, để vuốt nhanh đi xa hơn. */
const velocityProjection = 0.12;

function clamp(value: number, min: number, max: number) {
  'worklet';

  return Math.min(Math.max(value, min), max);
}

export function getExploreSheetHeights(maxHeight: number) {
  const safeMaxHeight = Math.max(maxHeight, 320);

  return {
    full: Math.round(safeMaxHeight * 0.86),
    half: Math.round(safeMaxHeight * 0.52),
    peek: Math.round(Math.min(Math.max(safeMaxHeight * 0.26, 168), 230)),
  } satisfies Record<ExploreSheetSnap, number>;
}

export function ExploreBottomSheet({
  children,
  header,
  maxHeight,
  onSnapChange,
  snap,
}: {
  children: ReactNode;
  header: ReactNode;
  maxHeight: number;
  onSnapChange: (snap: ExploreSheetSnap) => void;
  snap: ExploreSheetSnap;
}) {
  const heights = useMemo(() => getExploreSheetHeights(maxHeight), [maxHeight]);
  // Sheet cao đúng bằng nấc `full`, các nấc thấp hơn là phần bị đẩy xuống dưới.
  const offsets = useMemo(
    () => snapOrder.map((item) => heights.full - heights[item]),
    [heights],
  );

  const translateY = useSharedValue(heights.full - heights[snap]);
  const dragStart = useSharedValue(0);
  const snapOffsets = useSharedValue(offsets);

  useEffect(() => {
    snapOffsets.set(offsets);
  }, [offsets, snapOffsets]);

  useEffect(() => {
    translateY.set(withSpring(heights.full - heights[snap], springConfig));
  }, [heights, snap, translateY]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-6, 6])
        .failOffsetX([-16, 16])
        .onBegin(() => {
          dragStart.set(translateY.get());
        })
        .onUpdate((event) => {
          const bounds = snapOffsets.get();

          translateY.set(
            clamp(
              dragStart.get() + event.translationY,
              bounds[0],
              bounds[bounds.length - 1],
            ),
          );
        })
        .onEnd((event) => {
          const bounds = snapOffsets.get();
          const projected = clamp(
            translateY.get() + event.velocityY * velocityProjection,
            bounds[0],
            bounds[bounds.length - 1],
          );

          let nearestIndex = 0;

          for (let index = 1; index < bounds.length; index += 1) {
            if (
              Math.abs(bounds[index] - projected) <
              Math.abs(bounds[nearestIndex] - projected)
            ) {
              nearestIndex = index;
            }
          }

          translateY.set(withSpring(bounds[nearestIndex], springConfig));
          runOnJS(onSnapChange)(snapOrder[nearestIndex]);
        }),
    [dragStart, onSnapChange, snapOffsets, translateY],
  );

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));

  return (
    <Animated.View
      style={[
        {
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          bottom: 0,
          elevation: 18,
          height: heights.full,
          left: 0,
          position: 'absolute',
          right: 0,
          shadowColor: 'rgba(31, 22, 48, 0.22)',
          shadowOffset: { height: -8, width: 0 },
          shadowOpacity: 1,
          shadowRadius: 22,
        },
        sheetAnimatedStyle,
      ]}
    >
      <GestureDetector gesture={panGesture}>
        <View className="px-4 pb-1 pt-2.5">
          <View className="mx-auto h-1 w-9 rounded-full bg-[#E3E0E8]" />
          <View className="mt-2.5">{header}</View>
        </View>
      </GestureDetector>

      <View className="flex-1">{children}</View>
    </Animated.View>
  );
}
