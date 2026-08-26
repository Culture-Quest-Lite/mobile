import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

/**
 * Danh sách sắp xếp lại được bằng cách nhấn giữ rồi kéo.
 *
 * Vì sao tự dựng thay vì dùng thư viện: `react-native-draggable-flatlist` mới
 * hỗ trợ tới Reanimated 3, còn dự án đang ở Reanimated 4; ngoài ra nó là
 * `FlatList` nên đặt trong `ScrollView` sẽ dính cảnh báo nested list. Danh sách
 * điểm dừng luôn ngắn (vài mục) nên bản tự dựng vừa đủ và không thêm phụ thuộc.
 *
 * Cách hoạt động: mỗi hàng được đặt tuyệt đối và dịch xuống theo
 * `vị trí * rowHeight`. `positions` là bản đồ key -> vị trí, sống trên UI
 * thread nên việc hoán đổi trong lúc kéo không đi qua JS thread lần nào. Chỉ
 * khi thả tay mới đồng bộ thứ tự mới về React qua `onReorder`.
 *
 * Mọi hàng phải cao đúng `rowHeight` (đã gồm khoảng cách giữa các hàng).
 */

const spring = { damping: 20, mass: 0.6, stiffness: 210 } as const;

export type DraggableListRenderInfo<T> = {
  index: number;
  /** Hàng này đang được cầm kéo. */
  isDragging: boolean;
  /**
   * Có hàng nào đó trong danh sách đang được kéo. Vị trí chỉ được đồng bộ về
   * React khi thả tay, nên trong lúc kéo mọi số thứ tự đang hiển thị đều là số
   * cũ - dùng cờ này để tạm ẩn chúng thay vì cho người dùng thấy số sai.
   */
  isReordering: boolean;
  item: T;
};

type DraggableListProps<T> = {
  data: T[];
  /** Chiều cao một ô, đã bao gồm khoảng hở với ô kế tiếp. */
  rowHeight: number;
  /** Thời gian nhấn giữ trước khi bắt đầu kéo (ms). Dài hơn thì cuộn dễ hơn. */
  longPressDuration?: number;
  keyExtractor: (item: T) => string;
  onReorder: (next: T[]) => void;
  renderItem: (info: DraggableListRenderInfo<T>) => ReactNode;
};

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

function DraggableRow({
  children,
  count,
  index,
  itemKey,
  longPressDuration,
  onDragEnd,
  onDragStart,
  positions,
  rowHeight,
}: {
  children: ReactNode;
  count: number;
  index: number;
  itemKey: string;
  longPressDuration: number;
  onDragEnd: () => void;
  onDragStart: (key: string) => void;
  positions: SharedValue<Record<string, number>>;
  rowHeight: number;
}) {
  // Lấy vị trí ban đầu từ `index` chứ không từ `positions`: hàng mới thêm vào
  // mount TRƯỚC khi effect đồng bộ `positions` của danh sách cha kịp chạy, đọc
  // `positions` lúc đó sẽ ra 0 và hàng bị bay từ đầu danh sách xuống chỗ của nó.
  const translateY = useSharedValue(index * rowHeight);
  const isDragging = useSharedValue(false);
  const dragStartY = useSharedValue(0);

  // Khi một hàng khác bị kéo qua chỗ này, vị trí của hàng hiện tại đổi -> trượt
  // sang chỗ mới. Hàng đang được cầm thì bỏ qua vì nó đang bám theo ngón tay.
  useAnimatedReaction(
    () => positions.get()[itemKey],
    (position, previous) => {
      if (position === undefined || position === previous) return;
      if (isDragging.get()) return;
      translateY.set(withSpring(position * rowHeight, spring));
    },
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(longPressDuration)
        .onStart(() => {
          isDragging.set(true);
          dragStartY.set(translateY.get());
          runOnJS(onDragStart)(itemKey);
        })
        .onUpdate((event) => {
          const nextY = dragStartY.get() + event.translationY;
          translateY.set(nextY);

          const current = positions.get();
          const currentIndex = current[itemKey];
          const targetIndex = clamp(
            Math.round(nextY / rowHeight),
            0,
            count - 1,
          );
          if (currentIndex === undefined || targetIndex === currentIndex) return;

          /**
           * Chèn chứ không hoán đổi: các hàng nằm giữa vị trí cũ và vị trí mới
           * dịch lên/xuống một bậc. Nếu chỉ đổi chỗ hàng đang kéo với hàng ở
           * đích thì khi ngón tay lướt nhanh qua 2-3 bậc trong một khung hình,
           * những hàng ở giữa đứng yên và thứ tự trở nên lộn xộn.
           */
          const next: Record<string, number> = { ...current };
          next[itemKey] = targetIndex;

          const keys = Object.keys(current);
          for (let cursor = 0; cursor < keys.length; cursor += 1) {
            const key = keys[cursor];
            if (key === itemKey) continue;

            const position = current[key];
            if (
              currentIndex < targetIndex &&
              position > currentIndex &&
              position <= targetIndex
            ) {
              next[key] = position - 1;
            } else if (
              currentIndex > targetIndex &&
              position >= targetIndex &&
              position < currentIndex
            ) {
              next[key] = position + 1;
            }
          }

          positions.set(next);
        })
        .onFinalize(() => {
          if (!isDragging.get()) return;
          isDragging.set(false);
          const position = positions.get()[itemKey] ?? 0;
          translateY.set(withSpring(position * rowHeight, spring));
          runOnJS(onDragEnd)();
        }),
    [
      count,
      dragStartY,
      isDragging,
      itemKey,
      longPressDuration,
      onDragEnd,
      onDragStart,
      positions,
      rowHeight,
      translateY,
    ],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.get() },
      { scale: withSpring(isDragging.get() ? 1.03 : 1, spring) },
    ],
    zIndex: isDragging.get() ? 20 : 0,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          { height: rowHeight, left: 0, position: "absolute", right: 0, top: 0 },
          animatedStyle,
        ]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

export function DraggableList<T>({
  data,
  keyExtractor,
  longPressDuration = 220,
  onReorder,
  renderItem,
  rowHeight,
}: DraggableListProps<T>) {
  const keys = useMemo(() => data.map(keyExtractor), [data, keyExtractor]);
  const keySignature = keys.join("|");
  const positions = useSharedValue<Record<string, number>>(
    Object.fromEntries(keys.map((key, index) => [key, index])),
  );
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  // Thêm/xóa mục thì đánh lại vị trí. Sau một lần kéo, thứ tự mảng đã khớp
  // `positions` nên phép gán này ra đúng giá trị cũ - hàng không bị nhảy.
  useEffect(() => {
    positions.set(
      Object.fromEntries(keySignature.split("|").map((key, index) => [key, index])),
    );
  }, [keySignature, positions]);

  const handleDragEnd = useCallback(() => {
    const map = positions.get();
    const next = [...data].sort(
      (a, b) => (map[keyExtractor(a)] ?? 0) - (map[keyExtractor(b)] ?? 0),
    );
    setDraggingKey(null);
    onReorder(next);
  }, [data, keyExtractor, onReorder, positions]);

  if (!data.length) {
    return null;
  }

  return (
    <View style={{ height: data.length * rowHeight }}>
      {data.map((item, index) => {
        const key = keyExtractor(item);
        return (
          <DraggableRow
            count={data.length}
            index={index}
            itemKey={key}
            key={key}
            longPressDuration={longPressDuration}
            onDragEnd={handleDragEnd}
            onDragStart={setDraggingKey}
            positions={positions}
            rowHeight={rowHeight}
          >
            {renderItem({
              index,
              isDragging: draggingKey === key,
              isReordering: draggingKey !== null,
              item,
            })}
          </DraggableRow>
        );
      })}
    </View>
  );
}
