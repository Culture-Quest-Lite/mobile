import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";

import { appAlert } from "@/components/ui/app-dialog";
import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { ScreenHorizontalPadding } from "@/constants/theme";
import { SymbolView } from "@/components/ui/symbol-view";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  getVoucherById,
  getVoucherImage,
  getVoucherRedeemCode,
  redeemVoucher,
  type Voucher,
  type VoucherUsage,
} from "../api/voucher-api";

export default function VoucherDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const voucherId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authSession = useAuthSession();
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [usage, setUsage] = useState<VoucherUsage | null>(null);

  const goToLogin = () => {
    router.push("/login?entry=home");
  };

  useEffect(() => {
    if (!Number.isFinite(voucherId)) {
      setLoading(false);
      setVoucher(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        // `GET /api/vouchers/{id}` là public — khách vẫn xem được chi tiết,
        // token chỉ dùng khi đã đăng nhập.
        const token = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const result = await getVoucherById(voucherId, token);
        if (!cancelled) setVoucher(result);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Không tải được thông tin voucher.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authSession.isAuthenticated, voucherId]);

  const handleRedeem = () => {
    if (!voucher) return;

    if (!authSession.isAuthenticated) {
      goToLogin();
      return;
    }

    appAlert.alert(
      "Xác nhận đổi voucher",
      `Bạn sẽ dùng ${voucher.pointsRequired.toLocaleString("vi-VN")} điểm để đổi voucher này.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đổi ngay",
          onPress: async () => {
            setRedeeming(true);
            try {
              const token = await getValidAccessToken();
              if (!token) return;

              const result = await redeemVoucher(voucher.voucherId, token);
              setUsage(result);
              setVoucher((current) =>
                current
                  ? {
                      ...current,
                      quantityRemaining: Math.max(
                        0,
                        current.quantityRemaining - 1,
                      ),
                    }
                  : current,
              );
            } catch (e) {
              appAlert.alert(
                "Không thể đổi voucher",
                e instanceof Error ? e.message : "Vui lòng thử lại.",
              );
            } finally {
              setRedeeming(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return <AppLoadingScreen />;
  }

  if (error || !voucher) {
    return (
      <SafeAreaView
        className="flex-1 bg-[#FFF9F6]"
        edges={["left", "right", "bottom"]}
        style={{ paddingHorizontal: ScreenHorizontalPadding }}
      >
        <View style={{ paddingTop: insets.top + 10 }}>
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF0F7]"
            onPress={() => router.back()}
          >
            <SymbolView
              name={{
                ios: "chevron.left",
                android: "arrow_back",
                web: "arrow_back",
              }}
              size={19}
              tintColor="#D93682"
            />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-center text-[18px] font-black text-[#2B2233]">
            Không tải được voucher
          </Text>
          <Text className="mt-2 text-center text-[#8E869A]">
            {error ?? "Voucher không tồn tại hoặc đã ngừng hoạt động."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const image = getVoucherImage(voucher);
  const discount =
    voucher.discountType === "PERCENTAGE"
      ? `${voucher.discountValue}%`
      : `${Number(voucher.discountValue).toLocaleString("vi-VN")}đ`;

  return (
    <SafeAreaView
      className="flex-1 bg-[#FFF9F6]"
      edges={["left", "right", "bottom"]}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        <View className="relative h-72 bg-[#FFF0F7]">
          {image ? (
            <Image
              source={{ uri: image }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <SymbolView
                name={{
                  ios: "ticket.fill",
                  android: "confirmation_number",
                  web: "confirmation_number",
                }}
                size={90}
                tintColor="#EB489B"
              />
            </View>
          )}
          <Pressable
            className="absolute left-4 h-11 w-11 items-center justify-center rounded-full bg-white/90"
            style={{ top: insets.top + 8 }}
            onPress={() => router.back()}
          >
            <SymbolView
              name={{
                ios: "chevron.left",
                android: "arrow_back",
                web: "arrow_back",
              }}
              size={20}
              tintColor="#2B2233"
            />
          </Pressable>
        </View>

        <View
          className="-mt-6 rounded-t-[30px] bg-[#FFF9F6] pt-6"
          style={{ paddingHorizontal: ScreenHorizontalPadding }}
        >
          <Text className="text-[13px] font-bold uppercase tracking-wide text-[#EB489B]">
            {voucher.partnerName}
          </Text>
          <Text className="mt-2 text-[25px] font-black leading-8 text-[#2B2233]">
            {voucher.voucherName}
          </Text>

          <View className="mt-4 flex-row gap-3">
            <View className="flex-1 rounded-2xl bg-[#FFF0F0] p-3">
              <Text className="text-[11px] text-[#9A6D72]">Ưu đãi</Text>
              <Text className="mt-1 text-[20px] font-black text-[#F15B64]">
                {discount}
              </Text>
            </View>
            <View className="flex-1 rounded-2xl bg-[#FFF6DB] p-3">
              <Text className="text-[11px] text-[#9A7D2A]">Điểm đổi</Text>
              <Text className="mt-1 text-[20px] font-black text-[#C98A10]">
                {voucher.pointsRequired.toLocaleString("vi-VN")}
              </Text>
            </View>
          </View>

          <View className="mt-5 rounded-[22px] bg-white p-4">
            <Text className="text-[16px] font-black text-[#2B2233]">
              Thông tin voucher
            </Text>
            <Text className="mt-2 text-[14px] leading-6 text-[#6F6877]">
              {voucher.description || "Chưa có mô tả chi tiết."}
            </Text>
          </View>

          <View className="mt-3 rounded-[22px] bg-white p-4">
            <Text className="text-[14px] font-bold text-[#2B2233]">Điều kiện</Text>
            <Text className="mt-2 text-[13px] leading-6 text-[#6F6877]">
              Đơn tối thiểu: {voucher.minOrderAmount
                ? `${Number(voucher.minOrderAmount).toLocaleString("vi-VN")}đ`
                : "Không yêu cầu"}
            </Text>
            <Text className="text-[13px] leading-6 text-[#6F6877]">
              Giảm tối đa: {voucher.maxDiscountAmount
                ? `${Number(voucher.maxDiscountAmount).toLocaleString("vi-VN")}đ`
                : "Theo ưu đãi"}
            </Text>
            <Text className="text-[13px] leading-6 text-[#6F6877]">
              Số lượng còn lại: {voucher.quantityRemaining}
            </Text>
            <Text className="text-[13px] leading-6 text-[#6F6877]">
              Hạn dùng: {new Date(voucher.endDate).toLocaleDateString("vi-VN")}
            </Text>
          </View>

          {usage ? (
            <View className="mt-3 rounded-[22px] border border-[#BCE5C8] bg-[#F0FFF4] p-4">
              <Text className="text-[16px] font-black text-[#238A4D]">
                Đổi voucher thành công
              </Text>
              <Text className="mt-2 text-[12px] text-[#4F7B5D]">
                Mã sử dụng của bạn
              </Text>
              <Text
                selectable
                className="mt-1 text-[25px] font-black tracking-[3px] text-[#176C3B]"
              >
                {getVoucherRedeemCode(usage)}
              </Text>
              <Text className="mt-2 text-[12px] text-[#4F7B5D]">
                Hãy đưa mã này cho đối tác khi sử dụng. Bạn có thể xem lại trong
                “Voucher của tôi”.
              </Text>
              <Pressable
                className="mt-3 items-center rounded-full bg-[#238A4D] py-3"
                onPress={() => router.push("/vouchers/my")}
              >
                <Text className="text-[14px] font-black text-white">
                  Xem voucher của tôi
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 border-t border-[#EEE8EF] bg-white pt-3"
        style={{
          paddingBottom: Math.max(insets.bottom, 14),
          paddingHorizontal: ScreenHorizontalPadding,
        }}
      >
        <Pressable
          disabled={redeeming || !!usage || voucher.quantityRemaining <= 0}
          className={`items-center rounded-full py-4 ${
            usage || voucher.quantityRemaining <= 0
              ? "bg-[#D8D2D9]"
              : "bg-[#EB489B]"
          }`}
          onPress={handleRedeem}
        >
          {redeeming ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-[16px] font-black text-white">
              {usage
                ? "Đã đổi voucher"
                : voucher.quantityRemaining <= 0
                  ? "Voucher đã hết"
                  : !authSession.isAuthenticated
                    ? "Đăng nhập để đổi voucher"
                    : `Đổi với ${voucher.pointsRequired.toLocaleString("vi-VN")} điểm`}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
