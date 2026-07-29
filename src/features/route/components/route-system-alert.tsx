import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  View,
  type AlertButton,
  type AlertOptions,
} from "react-native";

type AlertRequest = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
};

type Listener = (request: AlertRequest) => void;

let listener: Listener | null = null;

export const routeSystemAlert = {
  alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions,
  ) {
    listener?.({ title, message, buttons, options });
  },
};

export function RouteSystemAlertHost() {
  const [request, setRequest] = useState<AlertRequest | null>(null);

  useEffect(() => {
    listener = setRequest;
    return () => {
      listener = null;
    };
  }, []);

  if (!request) return null;

  const buttons = request.buttons?.length
    ? request.buttons
    : [{ text: "Đã hiểu", style: "default" as const }];
  const hasDestructiveAction = buttons.some(
    (button) => button.style === "destructive",
  );
  const isSuccess = /đã |thành công|hoàn tất|bản nháp/i.test(request.title);
  const iconName = hasDestructiveAction
    ? "exclamationmark.triangle.fill"
    : isSuccess
      ? "checkmark.circle.fill"
      : "info.circle.fill";
  const iconColor = hasDestructiveAction
    ? "#E45454"
    : isSuccess
      ? "#28A66A"
      : "#EB489B";

  const close = () => setRequest(null);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (request.options?.cancelable !== false) close();
      }}
    >
      <View className="flex-1 items-center justify-center bg-black/45 px-6">
        <Pressable
          className="absolute inset-0"
          onPress={() => {
            if (request.options?.cancelable !== false) close();
          }}
        />

        <View
          className="w-full max-w-[380px] rounded-[30px] bg-white px-5 pb-5 pt-6"
          style={{
            shadowColor: "#1F1630",
            shadowOpacity: 0.2,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 12 },
            elevation: 14,
          }}
        >
          <View className="items-center">
            <View
              className="h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: `${iconColor}18` }}
            >
              <SymbolView name={iconName as any} size={28} tintColor={iconColor} />
            </View>
            <Text className="mt-4 text-center text-[19px] font-black text-[#2B2233]">
              {request.title}
            </Text>
            {!!request.message && (
              <Text className="mt-2 text-center text-[13px] leading-5 text-[#746D7C]">
                {request.message}
              </Text>
            )}
          </View>

          <View className={`mt-6 ${buttons.length > 2 ? "gap-2" : "flex-row gap-3"}`}>
            {buttons.map((button, index) => {
              const destructive = button.style === "destructive";
              const cancel = button.style === "cancel";
              return (
                <Pressable
                  key={`${button.text ?? "button"}-${index}`}
                  className={`${buttons.length > 2 ? "w-full" : "flex-1"} items-center justify-center rounded-2xl px-4 py-3.5 active:opacity-75`}
                  style={{
                    backgroundColor: destructive
                      ? "#FFF0F0"
                      : cancel
                        ? "#F3F4F7"
                        : "#EB489B",
                  }}
                  onPress={() => {
                    close();
                    button.onPress?.();
                  }}
                >
                  <Text
                    className="text-[13px] font-extrabold"
                    style={{
                      color: destructive
                        ? "#D74444"
                        : cancel
                          ? "#625B69"
                          : "#FFFFFF",
                    }}
                  >
                    {button.text || "Đồng ý"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
