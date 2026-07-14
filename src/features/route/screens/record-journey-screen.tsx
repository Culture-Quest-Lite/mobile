import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppMap, type AppMapPoint } from "@/features/map/components/app-map";

type RecordStatus = "READY" | "RECORDING" | "DRAFT";

const demoCheckins: AppMapPoint[] = [
  { id: 1, title: "Bưu điện Sài Gòn", description: "Check-in 09:12", latitude: 10.78012, longitude: 106.69901 },
  { id: 2, title: "Nhà thờ Đức Bà", description: "Check-in 09:38", latitude: 10.77972, longitude: 106.69903 },
];

export default function RecordJourneyScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<RecordStatus>("READY");
  const [checkins, setCheckins] = useState<AppMapPoint[]>([]);
  const mapPoints = useMemo(() => (checkins.length ? checkins : [{ id: "current", title: "Vị trí hiện tại", latitude: 10.7769, longitude: 106.7009 }]), [checkins]);

  function startDemo() {
    setStatus("RECORDING");
    setCheckins([]);
    Alert.alert("Bắt đầu ghi hành trình", "Khi API có sẵn, thao tác này sẽ gọi POST /api/v1/routes/record.");
  }

  function addDemoCheckin() {
    const next = demoCheckins[checkins.length];
    if (!next) {
      Alert.alert("Đã đủ dữ liệu demo", "Các check-in tiếp theo sẽ được thêm tự động từ API check-in thật.");
      return;
    }
    setCheckins((current) => [...current, next]);
  }

  function finishDemo() {
    if (!checkins.length) {
      Alert.alert("Chưa có check-in", "Hãy check-in ít nhất một hotspot trước khi kết thúc.");
      return;
    }
    setStatus("DRAFT");
    Alert.alert("Đã tạo bản nháp", "Sau này thao tác này sẽ gọi PUT /api/v1/routes/record/finish và chuyển route sang DRAFT.");
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FC]" edges={["top", "left", "right"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-white">
          <SymbolView name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }} size={19} tintColor="#2B2233" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[20px] font-extrabold text-[#2B2233]">Ghi hành trình</Text>
          <Text className="text-[11px] text-[#777181]">Lưu lại những hotspot bạn thực sự đã đi qua</Text>
        </View>
        <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF4EF]" onPress={() => Alert.alert("Luồng sử dụng", "Bắt đầu ghi → đi và check-in hotspot → kết thúc để tạo bản nháp → chỉnh sửa route và story → finalize để submit TRIAL.") }><Text className="text-[16px] font-extrabold text-[#F15B45]">?</Text></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
        <View className="px-4">
          <View className="overflow-hidden rounded-[30px] bg-white">
            <AppMap points={mapPoints} routeCoordinates={checkins.map(({ latitude, longitude }) => ({ latitude, longitude }))} height={360} />
            <View className="absolute left-4 top-4 flex-row items-center gap-2 rounded-full bg-white/95 px-3 py-2">
              <View className={`h-2.5 w-2.5 rounded-full ${status === "RECORDING" ? "bg-[#F15B45]" : status === "DRAFT" ? "bg-[#F5A623]" : "bg-[#9AA0AA]"}`} />
              <Text className="text-[10px] font-extrabold text-[#2B2233]">{status === "READY" ? "CHƯA BẮT ĐẦU" : status}</Text>
            </View>
            {status === "RECORDING" ? <View className="absolute bottom-4 left-4 right-4 rounded-2xl bg-[#2B2233]/90 px-4 py-3"><Text className="text-center text-[11px] font-bold text-white">Đang ghi · hãy mở màn hình Check-in khi đến hotspot</Text></View> : null}
          </View>
        </View>

        <View className="mt-4 px-4">
          <LinearGradient colors={["#E84D6A", "#F58752"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="rounded-3xl p-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-[11px] font-bold uppercase tracking-wider text-white/80">Route Record</Text>
                <Text className="mt-1 text-[18px] font-extrabold text-white">{status === "READY" ? "Sẵn sàng ghi chuyến đi mới" : status === "RECORDING" ? "Hành trình đang được ghi" : "Bản nháp đã sẵn sàng"}</Text>
                <Text className="mt-1 text-[11px] leading-5 text-white/85">{status === "READY" ? "Chỉ được ghi một hành trình tại một thời điểm." : status === "RECORDING" ? `${checkins.length} hotspot đã được lưu. Mỗi check-in sẽ tạo một story nháp.` : "Kiểm tra, đổi tên route và chỉnh sửa các story trước khi finalize."}</Text>
              </View>
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-black/20"><SymbolView name={{ ios: "record.circle", android: "fiber_manual_record", web: "fiber_manual_record" }} size={23} tintColor="#FFFFFF" /></View>
            </View>
          </LinearGradient>
        </View>

        <View className="mt-4 px-4">
          <View className="rounded-3xl bg-white p-4">
            <View className="flex-row items-center justify-between">
              <View><Text className="text-[14px] font-extrabold text-[#2B2233]">Hotspot đã đi qua</Text><Text className="mt-0.5 text-[10px] text-[#8E869A]">Story nháp được tạo sau mỗi check-in</Text></View>
              <View className="rounded-full bg-[#FFF4EF] px-3 py-1.5"><Text className="text-[10px] font-extrabold text-[#F15B45]">{checkins.length} CHECK-IN</Text></View>
            </View>

            <View className="mt-3 gap-2">
              {checkins.map((item, index) => (
                <View key={String(item.id)} className="flex-row items-center gap-3 rounded-2xl border border-[#E8EDF4] p-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-[#F15B45]"><Text className="text-[12px] font-extrabold text-white">{index + 1}</Text></View>
                  <View className="flex-1"><Text className="text-[12px] font-extrabold text-[#2B2233]">{item.title}</Text><Text className="mt-0.5 text-[10px] text-[#8E869A]">{item.description} · Story mặc định đã tạo</Text></View>
                  <View className="rounded-lg bg-[#FFF8F4] px-2 py-1"><Text className="text-[9px] font-extrabold text-[#A44A35]">DRAFT</Text></View>
                </View>
              ))}
              {!checkins.length ? <View className="items-center rounded-2xl border border-dashed border-[#D9DDE7] px-4 py-8"><SymbolView name={{ ios: "mappin.slash", android: "location_off", web: "location_off" }} size={22} tintColor="#A09AA8" /><Text className="mt-2 text-[12px] font-bold text-[#8E869A]">Chưa có hotspot nào được check-in</Text></View> : null}
            </View>
          </View>
        </View>

        <View className="mt-4 gap-2 px-4">
          {status === "READY" ? (
            <Pressable onPress={startDemo} className="rounded-2xl bg-[#F15B45] py-4"><Text className="text-center text-[13px] font-extrabold text-white">Bắt đầu ghi hành trình</Text></Pressable>
          ) : null}

          {status === "RECORDING" ? (
            <>
              <Pressable onPress={addDemoCheckin} className="rounded-2xl border border-[#F7C7D1] bg-white py-4"><Text className="text-center text-[13px] font-extrabold text-[#EB489B]">Mô phỏng check-in hotspot</Text></Pressable>
              <Pressable onPress={finishDemo} className="rounded-2xl bg-[#2B2233] py-4"><Text className="text-center text-[13px] font-extrabold text-white">Kết thúc và tạo bản nháp</Text></Pressable>
              <Text className="text-center text-[10px] leading-4 text-[#8E869A]">Khi có backend, check-in sẽ đến từ màn hình hotspot và nút kết thúc gọi API finish.</Text>
            </>
          ) : null}

          {status === "DRAFT" ? (
            <>
              <Pressable onPress={() => Alert.alert("Chỉnh sửa bản nháp", "Đi tới form update route và danh sách story tương ứng khi các API/module này được nối.")} className="rounded-2xl border border-[#E8EDF4] bg-white py-4"><Text className="text-center text-[13px] font-extrabold text-[#2B2233]">Xem và chỉnh sửa bản nháp</Text></Pressable>
              <Pressable onPress={() => Alert.alert("Finalize route", "Sau này nút này sẽ gọi PUT /api/v1/routes/record/finalize/{id} và chuyển trạng thái sang TRIAL.")} className="rounded-2xl bg-[#EB489B] py-4"><Text className="text-center text-[13px] font-extrabold text-white">Submit route lên hệ thống</Text></Pressable>
              <Pressable onPress={() => { setStatus("READY"); setCheckins([]); }} className="py-3"><Text className="text-center text-[11px] font-bold text-[#8E869A]">Đặt lại UI demo</Text></Pressable>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
