import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { SymbolView } from "@/components/ui/symbol-view";
import { getVoucherImage, type Voucher } from "../api/voucher-api";

export function formatVoucherDiscount(voucher: Voucher) {
  return voucher.discountType === "PERCENTAGE"
    ? `Giảm ${Number(voucher.discountValue)}%`
    : `Giảm ${Number(voucher.discountValue).toLocaleString("vi-VN")}đ`;
}

/** Thẻ voucher gọn cho dải ngang "Ưu đãi quanh đây". */
export function VoucherMiniCard({
  voucher,
  width = 220,
  /** Nhãn phụ dưới tên quán, ví dụ "Quanh Chợ Bến Thành". */
  contextLabel,
}: {
  voucher: Voucher;
  width?: number;
  contextLabel?: string | null;
}) {
  const router = useRouter();
  const image = getVoucherImage(voucher);

  return (
    <Pressable
      className="overflow-hidden rounded-[22px] bg-white"
      style={{ elevation: 2, width }}
      onPress={() => router.push(`/vouchers/${voucher.voucherId}`)}
    >
      <View className="h-[104px] w-full bg-[#FFF0F7]">
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
              size={36}
              tintColor="#EB489B"
            />
          </View>
        )}
        <View className="absolute left-2 top-2 rounded-full bg-[#F15B64] px-2.5 py-1">
          <Text className="text-[11px] font-black text-white">
            {formatVoucherDiscount(voucher)}
          </Text>
        </View>
      </View>

      <View className="px-3 pb-3 pt-2.5">
        <Text
          className="text-[14px] font-black text-[#2B2233]"
          numberOfLines={2}
        >
          {voucher.voucherName}
        </Text>
        <Text
          className="mt-1 text-[12px] font-semibold text-[#8E869A]"
          numberOfLines={1}
        >
          {voucher.partnerName}
        </Text>
        {contextLabel ? (
          <View className="mt-1.5 flex-row items-center gap-1">
            <SymbolView
              name={{
                ios: "location.fill",
                android: "location_on",
                web: "location_on",
              }}
              size={11}
              tintColor="#1677C8"
            />
            <Text className="flex-1 text-[11px] text-[#1677C8]" numberOfLines={1}>
              {contextLabel}
            </Text>
          </View>
        ) : null}
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-[12px] font-black text-[#C98A10]">
            {voucher.pointsRequired.toLocaleString("vi-VN")} điểm
          </Text>
          <Text className="text-[11px] text-[#8E869A]">
            Còn {voucher.quantityRemaining}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
