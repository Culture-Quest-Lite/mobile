import { SymbolView } from "@/components/ui/symbol-view";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ReviewMediaViewerItem = {
  type: "image" | "video";
  uri: string;
};

const viewerBackgroundColor = "#000000";
const viewerChromeBackgroundColor = "rgba(0, 0, 0, 0.42)";

function clampIndex(value: number, itemCount: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(Math.round(value), 0), Math.max(itemCount - 1, 0));
}

function ReviewMediaVideoPage({
  height,
  uri,
  width,
}: {
  height: number;
  uri: string;
  width: number;
}) {
  const videoPlayer = useVideoPlayer(uri, (player) => {
    player.loop = false;
    player.muted = false;
    player.showNowPlayingNotification = false;
  });

  return (
    <VideoView
      player={videoPlayer}
      contentFit="contain"
      nativeControls
      style={{ height, width }}
    />
  );
}

export function ReviewMediaViewer({
  initialIndex,
  items,
  onClose,
}: {
  initialIndex: number;
  items: ReviewMediaViewerItem[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [viewerSize, setViewerSize] = useState({ height: 0, width: 0 });
  const [activeIndex, setActiveIndex] = useState(() =>
    clampIndex(initialIndex, items.length),
  );
  const pageWidth = viewerSize.width;

  // Nhảy thẳng tới ảnh vừa bấm, không animate để không thấy các ảnh trước lướt qua.
  useEffect(() => {
    if (pageWidth <= 0) {
      return;
    }

    scrollRef.current?.scrollTo({
      animated: false,
      x: clampIndex(initialIndex, items.length) * pageWidth,
      y: 0,
    });
  }, [initialIndex, items.length, pageWidth]);

  function handleLayout(event: LayoutChangeEvent) {
    const { height, width } = event.nativeEvent.layout;

    setViewerSize((currentSize) =>
      currentSize.height === height && currentSize.width === width
        ? currentSize
        : { height, width },
    );
  }

  function handleMomentumScrollEnd(
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) {
    if (pageWidth <= 0) {
      return;
    }

    setActiveIndex(
      clampIndex(event.nativeEvent.contentOffset.x / pageWidth, items.length),
    );
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      visible
    >
      <View
        onLayout={handleLayout}
        style={{ backgroundColor: viewerBackgroundColor, flex: 1 }}
      >
        {pageWidth > 0 ? (
          <ScrollView
            ref={scrollRef}
            contentOffset={{
              x: clampIndex(initialIndex, items.length) * pageWidth,
              y: 0,
            }}
            horizontal
            onMomentumScrollEnd={handleMomentumScrollEnd}
            pagingEnabled
            showsHorizontalScrollIndicator={false}
          >
            {items.map((item, index) => (
              <View
                className="items-center justify-center"
                key={`review-media-viewer-${index}-${item.uri}`}
                style={{ height: viewerSize.height, width: pageWidth }}
              >
                {item.type === "video" ? (
                  <ReviewMediaVideoPage
                    height={viewerSize.height}
                    uri={item.uri}
                    width={pageWidth}
                  />
                ) : (
                  <Image
                    source={item.uri}
                    contentFit="contain"
                    transition={160}
                    cachePolicy="memory-disk"
                    style={{ height: viewerSize.height, width: pageWidth }}
                  />
                )}
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View
          className="absolute left-0 right-0 top-0 flex-row items-center justify-between px-4"
          pointerEvents="box-none"
          style={{ paddingTop: insets.top + 10 }}
        >
          <Pressable
            accessibilityLabel="Đóng ảnh"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center rounded-full"
            hitSlop={10}
            onPress={onClose}
            style={({ pressed }) => ({
              backgroundColor: viewerChromeBackgroundColor,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <SymbolView
              name={{
                ios: "xmark",
                android: "close",
                web: "close",
              }}
              size={19}
              tintColor="#FFFFFF"
            />
          </Pressable>

          {items.length > 1 ? (
            <View
              className="rounded-full px-3 py-1.5"
              style={{ backgroundColor: viewerChromeBackgroundColor }}
            >
              <Text
                className="text-[13px] font-semibold text-white"
                style={{ includeFontPadding: false, lineHeight: 17 }}
              >
                {`${activeIndex + 1}/${items.length}`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
