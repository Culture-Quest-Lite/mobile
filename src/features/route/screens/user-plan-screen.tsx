import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppMap, type AppMapPoint } from "@/features/map/components/app-map";
import {
  getHotspotCoordinateBySlug,
  hotspotCollection,
} from "@/features/home/data/hotspots";
import { openGoogleMapsMultiStopRoute } from "@/lib/google-maps-navigation";
import {
  ensureForegroundLocationPermission,
  getDevelopmentLocationOverride,
  getDeviceCoordinate,
} from "@/lib/location";

type PlannedStop = AppMapPoint & {
  address: string;
  source: "SYSTEM" | "SEARCH" | "AI";
  scheduleLabel?: string;
};

type OptimizeMode = "OPENING_HOURS" | "DISTANCE";

const defaultUserPoint: AppMapPoint = {
  id: "user",
  title: "Vị trí của bạn",
  description: "Điểm xuất phát dự kiến",
  latitude: 10.7769,
  longitude: 106.7009,
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function distanceSquared(a: AppMapPoint, b: AppMapPoint) {
  const lat = a.latitude - b.latitude;
  const lng = a.longitude - b.longitude;
  return lat * lat + lng * lng;
}

function optimizeNearestNeighbor(start: AppMapPoint, stops: PlannedStop[]) {
  const remaining = [...stops];
  const ordered: PlannedStop[] = [];
  let cursor = start;

  while (remaining.length) {
    let bestIndex = 0;
    for (let index = 1; index < remaining.length; index += 1) {
      if (distanceSquared(cursor, remaining[index]) < distanceSquared(cursor, remaining[bestIndex])) {
        bestIndex = index;
      }
    }
    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    cursor = next;
  }

  return ordered;
}

function openingPriority(stop: PlannedStop) {
  const schedule = normalizeText(stop.scheduleLabel ?? "");
  if (!schedule) return 3;
  if (schedule.includes("sap dong") || schedule.includes("dong cua")) return 0;
  if (schedule.includes("24/7") || schedule.includes("ca ngay")) return 2;
  return 1;
}

const systemHotspots: PlannedStop[] = hotspotCollection
  .map((hotspot) => ({ hotspot, coordinate: getHotspotCoordinateBySlug(hotspot.slug) }))
  .filter(
    (
      item,
    ): item is {
      hotspot: (typeof hotspotCollection)[number];
      coordinate: { latitude: number; longitude: number };
    } => item.coordinate !== null,
  )
  .map(({ hotspot, coordinate }) => ({
    id: `system-${hotspot.slug}`,
    title: hotspot.title,
    description: hotspot.address,
    address: hotspot.address,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    source: "SYSTEM" as const,
    scheduleLabel: hotspot.scheduleLabel,
  }));

export default function UserPlanScreen() {
  const router = useRouter();
  const [systemQuery, setSystemQuery] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiCandidates, setAiCandidates] = useState<PlannedStop[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAiConfirmed, setIsAiConfirmed] = useState(false);
  const [userPoint, setUserPoint] = useState<AppMapPoint>(defaultUserPoint);
  const [stops, setStops] = useState<PlannedStop[]>([]);
  const [optimizeMode, setOptimizeMode] = useState<OptimizeMode>("DISTANCE");
  const [aiOptimizeExplanation, setAiOptimizeExplanation] = useState("");
  const [isReviewed, setIsReviewed] = useState(false);

  const mapPoints = useMemo(() => [userPoint, ...stops], [stops, userPoint]);

  const filteredSystemHotspots = useMemo(() => {
    const keyword = normalizeText(systemQuery);
    if (!keyword) return systemHotspots;
    return systemHotspots.filter((hotspot) =>
      normalizeText(`${hotspot.title} ${hotspot.address}`).includes(keyword),
    );
  }, [systemQuery]);

  function addStop(stop: PlannedStop) {
    if (stops.some((item) => String(item.id) === String(stop.id))) {
      Alert.alert("Địa điểm đã có", "Điểm này đã nằm trong kế hoạch.");
      return;
    }
    setStops((current) => [...current, stop]);
    setIsReviewed(false);
    setAiOptimizeExplanation("");
  }

  async function locateUser() {
    setIsLocating(true);
    try {
      let coordinate = getDevelopmentLocationOverride();
      if (!coordinate) {
        const permission = await ensureForegroundLocationPermission();
        if (!permission.granted) {
          throw new Error("Hãy cấp quyền vị trí để xác định điểm xuất phát.");
        }
        coordinate = await getDeviceCoordinate({
          accuracy: Location.Accuracy.Balanced,
          maxAge: 60_000,
          mayShowUserSettingsDialog: true,
        });
      }
      if (!coordinate) throw new Error("Không lấy được vị trí hiện tại.");
      setUserPoint({
        ...defaultUserPoint,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      });
    } catch (error) {
      Alert.alert(
        "Không thể lấy vị trí",
        error instanceof Error ? error.message : "Vui lòng thử lại.",
      );
    } finally {
      setIsLocating(false);
    }
  }


  function generateAiTextSuggestion() {
    const prompt = aiPrompt.trim();
    if (!prompt) {
      Alert.alert(
        "Nhập mô tả chuyến đi",
        "Ví dụ: Tôi muốn tham quan các địa điểm lịch sử, gần nhau và hoàn thành trong một buổi sáng.",
      );
      return;
    }

    setIsAiLoading(true);
    setIsAiConfirmed(false);
    setAiCandidates([]);

    setTimeout(() => {
      const words = normalizeText(prompt)
        .split(/\s+/)
        .filter((word) => word.length > 2);
      const ranked = systemHotspots
        .map((stop) => {
          const searchable = normalizeText(
            `${stop.title} ${stop.address} ${stop.scheduleLabel ?? ""}`,
          );
          const keywordScore = words.reduce(
            (score, word) => score + (searchable.includes(word) ? 3 : 0),
            0,
          );
          const nearbyScore = 1 / Math.max(distanceSquared(userPoint, stop), 0.000001);
          return { stop: { ...stop, source: "AI" as const }, score: keywordScore * 1000 + nearbyScore };
        })
        .filter(({ stop }) => !stops.some((selected) => selected.id === stop.id))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(({ stop }) => stop);

      const names = ranked.map((item) => item.title).join(", ");
      setAiText(
        `AI đề xuất một hành trình gồm ${ranked.length} địa điểm phù hợp với mô tả của bạn: ${names}. ` +
          "Các địa điểm được ưu tiên theo mức độ phù hợp với nhu cầu và khoảng cách gần vị trí hiện tại. " +
          "Hãy xác nhận đề xuất để chuyển nội dung này thành các hotspot có thể lựa chọn.",
      );
      setAiCandidates(ranked);
      setIsAiLoading(false);
    }, 600);
  }

  function confirmAiSuggestion() {
    if (!aiText || !aiCandidates.length) return;
    setIsAiConfirmed(true);
  }

  function moveStop(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= stops.length) return;
    setStops((current) => {
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
    setIsReviewed(false);
    setAiOptimizeExplanation("");
  }

  function optimizeRoute() {
    if (stops.length < 2) return;

    if (optimizeMode === "DISTANCE") {
      setStops(optimizeNearestNeighbor(userPoint, stops));
      setAiOptimizeExplanation(
        "AI đã ưu tiên điểm gần vị trí xuất phát trước, sau đó lần lượt chọn địa điểm gần điểm vừa đi qua nhất. Cách này giúp giảm tổng quãng đường ước tính. Khi có Directions API, hệ thống sẽ dùng quãng đường giao thông thực tế.",
      );
    } else {
      const optimized = [...stops].sort((a, b) => {
        const priorityDifference = openingPriority(a) - openingPriority(b);
        if (priorityDifference !== 0) return priorityDifference;
        return distanceSquared(userPoint, a) - distanceSquared(userPoint, b);
      });
      setStops(optimized);
      setAiOptimizeExplanation(
        "AI đã ưu tiên các địa điểm có giờ hoạt động hạn chế hoặc có nguy cơ đóng cửa sớm lên trước; các địa điểm mở cả ngày được xếp sau. Nếu thiếu dữ liệu giờ mở cửa, khoảng cách gần vị trí xuất phát được dùng làm tiêu chí phụ.",
      );
    }

    setIsReviewed(false);
  }

  async function openInGoogleMaps() {
    try {
      await openGoogleMapsMultiStopRoute({
        points: stops,
        travelMode: "driving",
        useCurrentLocationAsOrigin: true,
      });
    } catch (error) {
      Alert.alert(
        "Không thể mở Google Maps",
        error instanceof Error ? error.message : "Vui lòng thử lại.",
      );
    }
  }

  function reviewPlan() {
    if (stops.length < 2) return;
    setIsReviewed(true);
    Alert.alert(
      "Đã duyệt kế hoạch",
      "Lộ trình đã sẵn sàng. Khi backend hoàn thiện, bước này sẽ tạo Custom Route và cho Explorer bắt đầu hành trình như route thông thường.",
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FC]" edges={["top", "left", "right"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-white"
        >
          <SymbolView
            name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
            size={19}
            tintColor="#2B2233"
          />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[20px] font-extrabold text-[#2B2233]">
            Tạo tuyến đường cá nhân
          </Text>
          <Text className="text-[11px] text-[#777181]">
            Chọn hotspot theo thứ tự, nhờ AI hỗ trợ và duyệt hành trình
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-4 overflow-hidden rounded-[30px] bg-white">
          <AppMap
            points={mapPoints}
            routeCoordinates={mapPoints.map(({ latitude, longitude }) => ({ latitude, longitude }))}
            height={320}
          />
          <Pressable
            onPress={locateUser}
            className="absolute bottom-4 right-4 flex-row items-center gap-2 rounded-full bg-white px-4 py-3"
          >
            {isLocating ? (
              <ActivityIndicator size="small" color="#EB489B" />
            ) : (
              <SymbolView
                name={{ ios: "location.fill", android: "my_location", web: "my_location" }}
                size={16}
                tintColor="#EB489B"
              />
            )}
            <Text className="text-[11px] font-extrabold text-[#2B2233]">Vị trí của tôi</Text>
          </Pressable>
        </View>


        <View className="rounded-3xl bg-white p-4">
          <Text className="text-[14px] font-extrabold text-[#2B2233]">
            1. Tìm và chọn hotspot của hệ thống
          </Text>
          <Text className="mt-1 text-[10px] leading-4 text-[#8E869A]">
            Kết quả lọc theo thời gian thực. Hotspot được thêm vào lộ trình đúng theo thứ tự bạn chọn.
          </Text>

          <View className="mt-3 flex-row items-center rounded-2xl bg-[#F1F3F7] px-3">
            <SymbolView
              name={{ ios: "magnifyingglass", android: "search", web: "search" }}
              size={17}
              tintColor="#8E869A"
            />
            <TextInput
              value={systemQuery}
              onChangeText={setSystemQuery}
              placeholder="Tìm theo tên hotspot hoặc địa chỉ..."
              placeholderTextColor="#A09AA8"
              className="flex-1 px-3 py-3.5 text-[13px] text-[#2B2233]"
            />
          </View>

          <View className="mt-3 gap-2">
            {filteredSystemHotspots.slice(0, 8).map((hotspot) => {
              const selectedIndex = stops.findIndex((item) => item.id === hotspot.id);
              const isSelected = selectedIndex >= 0;
              return (
                <Pressable
                  key={String(hotspot.id)}
                  onPress={() => addStop(hotspot)}
                  className={`flex-row items-center gap-3 rounded-2xl border p-3 ${
                    isSelected ? "border-[#EB489B] bg-[#FFF6FA]" : "border-[#E8EDF4]"
                  }`}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1F6]">
                    <Text>{isSelected ? selectedIndex + 1 : "📍"}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[12px] font-extrabold text-[#2B2233]" numberOfLines={1}>
                      {hotspot.title}
                    </Text>
                    <Text className="mt-1 text-[10px] text-[#8E869A]" numberOfLines={1}>
                      {hotspot.address}
                    </Text>
                    {hotspot.scheduleLabel ? (
                      <Text className="mt-1 text-[9px] font-bold text-[#F58752]">
                        🕒 {hotspot.scheduleLabel}
                      </Text>
                    ) : null}
                  </View>
                  <Text className={`text-[11px] font-extrabold ${isSelected ? "text-[#EB489B]" : "text-[#777181]"}`}>
                    {isSelected ? `Đã chọn #${selectedIndex + 1}` : "+ Thêm"}
                  </Text>
                </Pressable>
              );
            })}
            {!filteredSystemHotspots.length ? (
              <View className="items-center rounded-2xl border border-dashed border-[#D9DDE7] px-4 py-6">
                <Text className="text-[11px] font-bold text-[#8E869A]">
                  Không tìm thấy hotspot phù hợp
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View className="mt-4 rounded-3xl bg-white p-4">
          <Text className="text-[14px] font-extrabold text-[#2B2233]">
            2. Mô tả chuyến đi để AI gợi ý
          </Text>
          <Text className="mt-1 text-[10px] leading-4 text-[#8E869A]">
            AI trả lời bằng nội dung mô tả trước. Sau khi Explorer xác nhận, đề xuất mới được chuyển thành hotspot để lựa chọn.
          </Text>
          <TextInput
            value={aiPrompt}
            onChangeText={setAiPrompt}
            multiline
            placeholder="Ví dụ: Tôi muốn đi các địa điểm lịch sử, kiến trúc đẹp, gần nhau và hoàn thành trong một buổi sáng..."
            placeholderTextColor="#A09AA8"
            className="mt-3 min-h-24 rounded-2xl bg-[#F1F3F7] px-4 py-3 text-[13px] leading-5 text-[#2B2233]"
            textAlignVertical="top"
          />
          <Pressable
            onPress={generateAiTextSuggestion}
            className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl bg-[#2B2233] py-3.5"
          >
            {isAiLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text>✨</Text>}
            <Text className="text-[12px] font-extrabold text-white">Nhận gợi ý dạng text</Text>
          </Pressable>

          {aiText ? (
            <View className="mt-3 rounded-2xl bg-[#F7F3FA] p-4">
              <View className="flex-row items-center gap-2">
                <Text>✨</Text>
                <Text className="text-[12px] font-extrabold text-[#2B2233]">Đề xuất của AI</Text>
              </View>
              <Text className="mt-2 text-[11px] leading-5 text-[#5E5868]">{aiText}</Text>
              {!isAiConfirmed ? (
                <Pressable
                  onPress={confirmAiSuggestion}
                  className="mt-3 rounded-xl bg-[#EB489B] py-3"
                >
                  <Text className="text-center text-[11px] font-extrabold text-white">
                    Xác nhận và chuyển thành hotspot
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {isAiConfirmed ? (
            <View className="mt-3 gap-2">
              <Text className="text-[11px] font-extrabold text-[#2B2233]">
                Chọn các địa điểm AI đã gợi ý
              </Text>
              {aiCandidates.map((stop) => {
                const isSelected = stops.some((item) => item.id === stop.id);
                return (
                  <Pressable
                    key={String(stop.id)}
                    onPress={() => addStop(stop)}
                    className={`flex-row items-center gap-3 rounded-2xl border p-3 ${
                      isSelected ? "border-[#EB489B] bg-[#FFF6FA]" : "border-[#E8EDF4]"
                    }`}
                  >
                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#F4EFF8]">
                      <Text>AI</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[12px] font-extrabold text-[#2B2233]">
                        {stop.title}
                      </Text>
                      <Text className="text-[10px] text-[#8E869A]" numberOfLines={1}>
                        {stop.address}
                      </Text>
                    </View>
                    <Text className="text-[11px] font-extrabold text-[#EB489B]">
                      {isSelected ? "Đã chọn" : "+ Chọn"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        <View className="mt-4 rounded-3xl bg-white p-4">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text className="text-[14px] font-extrabold text-[#2B2233]">
                3. Thứ tự và tối ưu lộ trình
              </Text>
              <Text className="text-[10px] text-[#8E869A]">
                {stops.length} địa điểm đã chọn theo đúng thứ tự Explorer bấm
              </Text>
            </View>
          </View>

          <View className="mt-3 flex-row gap-2">
            {(["OPENING_HOURS", "DISTANCE"] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => setOptimizeMode(mode)}
                className={`flex-1 rounded-xl py-3 ${
                  optimizeMode === mode ? "bg-[#2B2233]" : "bg-[#F1F3F7]"
                }`}
              >
                <Text
                  className={`text-center text-[10px] font-bold ${
                    optimizeMode === mode ? "text-white" : "text-[#777181]"
                  }`}
                >
                  {mode === "OPENING_HOURS" ? "Thời gian mở cửa" : "Tổng quãng đường"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={optimizeRoute}
            disabled={stops.length < 2}
            className={`mt-3 rounded-xl py-3 ${stops.length >= 2 ? "bg-[#FFF1F6]" : "bg-[#F1F3F7]"}`}
          >
            <Text
              className={`text-center text-[11px] font-extrabold ${
                stops.length >= 2 ? "text-[#D93679]" : "text-[#A3A7B0]"
              }`}
            >
              ✨ AI sắp xếp và giải thích
            </Text>
          </Pressable>

          {aiOptimizeExplanation ? (
            <View className="mt-3 rounded-2xl bg-[#FFF8EC] p-3">
              <Text className="text-[10px] font-extrabold text-[#9B641F]">AI giải thích</Text>
              <Text className="mt-1 text-[10px] leading-4 text-[#735A3D]">
                {aiOptimizeExplanation}
              </Text>
            </View>
          ) : null}

          <View className="mt-3 gap-2">
            {stops.map((stop, index) => (
              <View
                key={String(stop.id)}
                className="flex-row items-center gap-3 rounded-2xl border border-[#E8EDF4] p-3"
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-[#EB489B]">
                  <Text className="text-[12px] font-extrabold text-white">{index + 1}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[12px] font-extrabold text-[#2B2233]" numberOfLines={1}>
                    {stop.title}
                  </Text>
                  <Text className="text-[10px] text-[#8E869A]" numberOfLines={1}>
                    {stop.address}
                  </Text>
                  {stop.scheduleLabel ? (
                    <Text className="mt-1 text-[9px] font-bold text-[#F58752]">
                      🕒 {stop.scheduleLabel}
                    </Text>
                  ) : null}
                </View>
                <View className="gap-1">
                  <View className="flex-row gap-1">
                    <Pressable
                      onPress={() => moveStop(index, -1)}
                      disabled={index === 0}
                      className="h-7 w-7 items-center justify-center rounded-lg bg-[#F1F3F7]"
                    >
                      <Text>↑</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => moveStop(index, 1)}
                      disabled={index === stops.length - 1}
                      className="h-7 w-7 items-center justify-center rounded-lg bg-[#F1F3F7]"
                    >
                      <Text>↓</Text>
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => {
                      setStops((current) => current.filter((_, currentIndex) => currentIndex !== index));
                      setIsReviewed(false);
                    }}
                    className="h-7 items-center justify-center rounded-lg bg-[#FFF0F2]"
                  >
                    <Text className="text-[9px] font-bold text-[#D13C54]">Xóa</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {!stops.length ? (
              <View className="items-center rounded-2xl border border-dashed border-[#D9DDE7] px-4 py-7">
                <Text className="text-[12px] font-bold text-[#8E869A]">
                  Chưa có địa điểm nào trong hành trình
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View className="mt-4 rounded-3xl bg-white p-4">
          <Text className="text-[14px] font-extrabold text-[#2B2233]">
            4. Explorer duyệt và bắt đầu hành trình
          </Text>
          <Text className="mt-1 text-[10px] leading-4 text-[#8E869A]">
            Sau khi duyệt, Custom Route sẽ hoạt động giống một hành trình bình thường: hiển thị Route Detail, thứ tự hotspot, đường đi, check-in và tiến độ hoàn thành.
          </Text>

          <Pressable
            disabled={stops.length < 2}
            onPress={() => void openInGoogleMaps()}
            className={`mt-3 rounded-2xl py-4 ${stops.length >= 2 ? "bg-[#1677C8]" : "bg-[#D9DDE7]"}`}
          >
            <Text className="text-center text-[13px] font-extrabold text-white">
              Xem trước {stops.length} điểm trên Google Maps
            </Text>
          </Pressable>

          <Pressable
            disabled={stops.length < 2}
            onPress={reviewPlan}
            className={`mt-3 rounded-2xl py-4 ${stops.length >= 2 ? "bg-[#EB489B]" : "bg-[#D9DDE7]"}`}
          >
            <Text className="text-center text-[13px] font-extrabold text-white">
              Duyệt và tạo Custom Route
            </Text>
          </Pressable>

          {isReviewed ? (
            <Pressable
              onPress={() =>
                Alert.alert(
                  "Bắt đầu hành trình",
                  "UI đã sẵn sàng. Khi có API, nút này sẽ chuyển sang Route Detail và gọi API bắt đầu journey như route thông thường.",
                )
              }
              className="mt-3 rounded-2xl bg-[#2B2233] py-4"
            >
              <Text className="text-center text-[13px] font-extrabold text-white">
                Bắt đầu hành trình
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
