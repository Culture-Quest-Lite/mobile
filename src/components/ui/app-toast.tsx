import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SymbolView } from "@/components/ui/symbol-view";
import { bodyLineHeightFor } from "@/lib/text-scale";

export type AppToastTone = "error" | "info" | "success";

type ToastRequest = {
  duration?: number;
  id: number;
  message: string;
  tone: AppToastTone;
};

type ToastPayload =
  | string
  | {
      duration?: number;
      message: string;
      tone?: AppToastTone;
    };

type Listener = (request: ToastRequest) => void;

let activeListener: Listener | null = null;
let nextToastId = 1;

const toneConfig: Record<
  AppToastTone,
  {
    backgroundColor: string;
    iconBackgroundColor: string;
    iconColor: string;
    iconName: Parameters<typeof SymbolView>[0]["name"];
    textColor: string;
  }
> = {
  error: {
    backgroundColor: "#FFF2F0",
    iconBackgroundColor: "#FDE2DE",
    iconColor: "#D84C3E",
    iconName: "error",
    textColor: "#742C25",
  },
  info: {
    backgroundColor: "#FFF8EC",
    iconBackgroundColor: "#FFE7C1",
    iconColor: "#DD8C1C",
    iconName: "info",
    textColor: "#6E4B17",
  },
  success: {
    backgroundColor: "#EFFAF2",
    iconBackgroundColor: "#D7F0DE",
    iconColor: "#2A8A52",
    iconName: "checkmark.circle.fill",
    textColor: "#1F5C39",
  },
};

function normalizeToastPayload(payload: ToastPayload): ToastRequest {
  if (typeof payload === "string") {
    return {
      id: nextToastId++,
      message: payload,
      tone: "info",
    };
  }

  return {
    duration: payload.duration,
    id: nextToastId++,
    message: payload.message,
    tone: payload.tone ?? "info",
  };
}

export const appToast = {
  error(message: string, duration?: number) {
    activeListener?.({
      duration,
      id: nextToastId++,
      message,
      tone: "error",
    });
  },
  info(message: string, duration?: number) {
    activeListener?.({
      duration,
      id: nextToastId++,
      message,
      tone: "info",
    });
  },
  show(payload: ToastPayload) {
    activeListener?.(normalizeToastPayload(payload));
  },
  success(message: string, duration?: number) {
    activeListener?.({
      duration,
      id: nextToastId++,
      message,
      tone: "success",
    });
  },
};

export function AppToastHost() {
  const insets = useSafeAreaInsets();
  const [request, setRequest] = useState<ToastRequest | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(-14));
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activeListener = setRequest;

    return () => {
      activeListener = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!request) {
      return;
    }

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    opacity.stopAnimation();
    translateY.stopAnimation();
    opacity.setValue(0);
    translateY.setValue(-14);

    Animated.parallel([
      Animated.timing(opacity, {
        duration: 180,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration: 220,
        easing: Easing.out(Easing.quad),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();

    const toastId = request.id;
    hideTimeoutRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          duration: 160,
          easing: Easing.in(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          duration: 160,
          easing: Easing.in(Easing.quad),
          toValue: -10,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setRequest((currentRequest) =>
          currentRequest?.id === toastId ? null : currentRequest,
        );
      });
    }, request.duration ?? 2200);

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [opacity, request, translateY]);

  if (!request) {
    return null;
  }

  const currentTone = toneConfig[request.tone];

  return (
    <Modal
      animationType="none"
      onRequestClose={() => {
        setRequest(null);
      }}
      statusBarTranslucent
      transparent
      visible
    >
      <View
        pointerEvents="box-none"
        style={{
          bottom: 0,
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
        }}
      >
        <Animated.View
          pointerEvents="box-none"
          style={{
            left: 16,
            opacity,
            position: "absolute",
            right: 16,
            top: insets.top + 12,
            transform: [{ translateY }],
            zIndex: 40,
          }}
        >
          <Pressable
            accessibilityRole="alert"
            className="rounded-[20px] px-4 py-3"
            onPress={() => {
              setRequest(null);
            }}
            style={{
              backgroundColor: currentTone.backgroundColor,
              shadowColor: "#1F1630",
              shadowOpacity: 0.12,
              shadowRadius: 16,
              shadowOffset: {
                height: 10,
                width: 0,
              },
              elevation: 8,
            }}
          >
            <View className="flex-row items-center gap-3">
              <View
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: currentTone.iconBackgroundColor }}
              >
                <SymbolView
                  name={currentTone.iconName}
                  size={17}
                  tintColor={currentTone.iconColor}
                />
              </View>

              <Text
                className="flex-1 text-[13px] font-medium"
                style={{
                  color: currentTone.textColor,
                  includeFontPadding: false,
                  lineHeight: bodyLineHeightFor(13),
                }}
              >
                {request.message}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}
