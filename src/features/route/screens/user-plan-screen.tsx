import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
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

import {
  autocompleteGoongPlaces,
  getGoongPlaceDetail,
  type GoongPlacePrediction,
} from "@/features/map/api/goong-places";
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

type OptimizeMode = "DISTANCE" | "TIME";

const defaultUserPoint: AppMapPoint = {
  id: "user",
  title: "Vị trí của bạn",
  description: "Điểm xuất phát dự kiến",
  latitude: 10.7769,
  longitude: 106.7009,
};

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

const systemHotspots: PlannedStop[] = hotspotCollection
  .map((hotspot) => ({ hotspot, coordinate: getHotspotCoordinateBySlug(hotspot.slug) }))
  .filter((item): item is { hotspot: (typeof hotspotCollection)[number]; coordinate: { latitude: number; longitude: number } } => item.coordinate !== null)
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
  const [query, setQuery] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [predictions, setPredictions] = useState<GoongPlacePrediction[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<PlannedStop[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [userPoint, setUserPoint] = useState<AppMapPoint>(defaultUserPoint);
  const [stops, setStops] = useState<PlannedStop[]>([]);
  const [optimizeMode, setOptimizeMode] = useState<OptimizeMode>("DISTANCE");
  const sessionToken = useRef(`user-plan-${Date.now()}`).current;

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setPredictions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        setPredictions(await autocompleteGoongPlaces(normalizedQuery, sessionToken, controller.signal));
      } catch (error) {
        if (!controller.signal.aborted) console.warn("[user-plan] autocomplete failed", error);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, sessionToken]);

  const mapPoints = useMemo(() => [userPoint, ...stops], [stops, userPoint]);

  function addStop(stop: PlannedStop) {
    if (stops.some((item) => String(item.id) === String(stop.id))) {
      Alert.alert("Địa điểm đã có", "Điểm này đã nằm trong kế hoạch.");
      return;
    }
    setStops((current) => [...current, stop]);
  }

  async function locateUser() {
    setIsLocating(true);
    try {
      let coordinate = getDevelopmentLocationOverride();
      if (!coordinate) {
        const permission = await ensureForegroundLocationPermission();
        if (!permission.granted) throw new Error("Hãy cấp quyền vị trí để xác định điểm xuất phát.");
        coordinate = await getDeviceCoordinate({
          accuracy: Location.Accuracy.Balanced,
          maxAge: 60_000,
          mayShowUserSettingsDialog: true,
        });
      }
      if (!coordinate) throw new Error("Không lấy được vị trí hiện tại.");
      setUserPoint({ ...defaultUserPoint, latitude: coordinate.latitude, longitude: coordinate.longitude });
    } catch (error) {
      Alert.alert("Không thể lấy vị trí", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      setIsLocating(false);
    }
  }

  async function selectPrediction(item: GoongPlacePrediction) {
    try {
      const detail = await getGoongPlaceDetail(item.placeId, sessionToken);
      addStop({
        id: `place-${item.placeId}`,
        title: item.mainText || item.description,
        description: detail.address,
        address: detail.address,
        latitude: detail.latitude,
        longitude: detail.longitude,
        source: "SEARCH",
      });
      setQuery("");
      setPredictions([]);
    } catch (error) {
      Alert.alert("Không thể thêm địa điểm", error instanceof Error ? error.message : "Vui lòng thử lại.");
    }
  }

  function suggestWithAi() {
    const prompt = aiPrompt.trim().toLowerCase();
    if (!prompt) {
      Alert.alert("Nhập mong muốn", "Ví dụ: Muốn đi các nơi lịch sử, kiến trúc và chụp ảnh trong Quận 1.");
      return;
    }

    setIsAiLoading(true);
    setTimeout(() => {
      const words = prompt
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/\s+/)
        .filter((word) => word.length > 2);
      const ranked = systemHotspots
        .map((stop) => {
          const searchable = `${stop.title} ${stop.address} ${stop.scheduleLabel ?? ""}`
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
          const keywordScore = words.reduce((score, word) => score + (searchable.includes(word) ? 3 : 0), 0);
          const nearbyScore = 1 / Math.max(distanceSquared(userPoint, stop), 0.000001);
          return { stop: { ...stop, source: "AI" as const }, score: keywordScore * 1000 + nearbyScore };
        })
        .filter(({ stop }) => !stops.some((selected) => selected.id === stop.id))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map(({ stop }) => stop);
      setAiSuggestions(ranked);
      setIsAiLoading(false);
    }, 550);
  }

  function moveStop(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= stops.length) return;
    setStops((current) => {
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function optimizeRoute() {
    if (stops.length < 2) return;
    setStops(optimizeNearestNeighbor(userPoint, stops));
    Alert.alert(
      "Đã tối ưu lộ trình",
      optimizeMode === "DISTANCE"
        ? "Các điểm đã được sắp theo quãng đường ước tính ngắn nhất."
        : "UI đã sắp theo khoảng cách gần nhất. Khi có API Directions/Traffic, chế độ này sẽ dùng thời gian di chuyển thực tế.",
    );
  }

  async function openInGoogleMaps() {
    try {
      await openGoogleMapsMultiStopRoute({ points: stops, travelMode: "driving", useCurrentLocationAsOrigin: true });
    } catch (error) {
      Alert.alert("Không thể mở Google Maps", error instanceof Error ? error.message : "Vui lòng thử lại.");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FC]" edges={["top", "left", "right"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-white">
          <SymbolView name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }} size={19} tintColor="#2B2233" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[20px] font-extrabold text-[#2B2233]">Tạo tuyến đường cá nhân</Text>
          <Text className="text-[11px] text-[#777181]">Chọn hotspot, nhờ AI gợi ý và tối ưu thứ tự</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View className="overflow-hidden rounded-[30px] bg-white">
          <AppMap
            points={mapPoints}
            routeCoordinates={mapPoints.map(({ latitude, longitude }) => ({ latitude, longitude }))}
            height={320}
          />
          <Pressable onPress={locateUser} className="absolute bottom-4 right-4 flex-row items-center gap-2 rounded-full bg-white px-4 py-3">
            {isLocating ? <ActivityIndicator size="small" color="#EB489B" /> : <SymbolView name={{ ios: "location.fill", android: "my_location", web: "my_location" }} size={16} tintColor="#EB489B" />}
            <Text className="text-[11px] font-extrabold text-[#2B2233]">Vị trí của tôi</Text>
          </Pressable>
        </View>

        <View className="mt-4 rounded-3xl bg-white p-4">
          <Text className="text-[14px] font-extrabold text-[#2B2233]">1. Chọn hotspot của hệ thống</Text>
          <Text className="mt-1 text-[10px] leading-4 text-[#8E869A]">Các địa điểm gần vị trí xuất phát được ưu tiên hiển thị.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 12 }}>
            {systemHotspots.slice(0, 8).map((hotspot) => (
              <Pressable key={String(hotspot.id)} onPress={() => addStop(hotspot)} className="w-44 rounded-2xl border border-[#E8EDF4] p-3">
                <View className="mb-2 h-8 w-8 items-center justify-center rounded-xl bg-[#FFF1F6]"><Text>📍</Text></View>
                <Text className="text-[12px] font-extrabold text-[#2B2233]" numberOfLines={2}>{hotspot.title}</Text>
                <Text className="mt-1 text-[10px] text-[#8E869A]" numberOfLines={2}>{hotspot.address}</Text>
                <Text className="mt-2 text-[10px] font-bold text-[#EB489B]">+ Thêm vào tuyến</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View className="mt-4 rounded-3xl bg-white p-4">
          <Text className="text-[14px] font-extrabold text-[#2B2233]">2. Mô tả chuyến đi để AI gợi ý</Text>
          <TextInput value={aiPrompt} onChangeText={setAiPrompt} multiline placeholder="Ví dụ: Tôi muốn đi 4 địa điểm lịch sử, kiến trúc đẹp, gần nhau và hoàn thành trong một buổi sáng..." placeholderTextColor="#A09AA8" className="mt-3 min-h-24 rounded-2xl bg-[#F1F3F7] px-4 py-3 text-[13px] leading-5 text-[#2B2233]" textAlignVertical="top" />
          <Pressable onPress={suggestWithAi} className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl bg-[#2B2233] py-3.5">
            {isAiLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text>✨</Text>}
            <Text className="text-[12px] font-extrabold text-white">AI gợi ý địa điểm</Text>
          </Pressable>
          {aiSuggestions.length ? (
            <View className="mt-3 gap-2">
              {aiSuggestions.map((stop) => (
                <Pressable key={String(stop.id)} onPress={() => addStop(stop)} className="flex-row items-center gap-3 rounded-2xl border border-[#E8EDF4] p-3">
                  <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#F4EFF8]"><Text>AI</Text></View>
                  <View className="flex-1"><Text className="text-[12px] font-extrabold text-[#2B2233]">{stop.title}</Text><Text className="text-[10px] text-[#8E869A]" numberOfLines={1}>{stop.address}</Text></View>
                  <Text className="text-[18px] text-[#EB489B]">+</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View className="mt-4 rounded-3xl bg-white p-4">
          <Text className="text-[14px] font-extrabold text-[#2B2233]">Hoặc tìm một địa điểm cụ thể</Text>
          <View className="mt-3 flex-row items-center rounded-2xl bg-[#F1F3F7] px-3">
            <SymbolView name={{ ios: "magnifyingglass", android: "search", web: "search" }} size={17} tintColor="#8E869A" />
            <TextInput value={query} onChangeText={setQuery} placeholder="Tên địa điểm hoặc địa chỉ..." placeholderTextColor="#A09AA8" className="flex-1 px-3 py-3.5 text-[13px] text-[#2B2233]" />
            {isSearching ? <ActivityIndicator size="small" color="#EB489B" /> : null}
          </View>
          {predictions.map((item) => (
            <Pressable key={item.placeId} onPress={() => void selectPrediction(item)} className="mt-2 flex-row items-start gap-3 rounded-2xl border border-[#EEF0F5] p-3">
              <Text>📍</Text><View className="flex-1"><Text className="text-[12px] font-extrabold text-[#2B2233]">{item.mainText}</Text><Text className="text-[10px] text-[#8E869A]">{item.secondaryText || item.description}</Text></View>
            </Pressable>
          ))}
        </View>

        <View className="mt-4 rounded-3xl bg-white p-4">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1"><Text className="text-[14px] font-extrabold text-[#2B2233]">3. Thứ tự hành trình</Text><Text className="text-[10px] text-[#8E869A]">{stops.length} địa điểm đã chọn</Text></View>
            <Pressable onPress={optimizeRoute} disabled={stops.length < 2} className={`rounded-xl px-3 py-2.5 ${stops.length >= 2 ? "bg-[#FFF1F6]" : "bg-[#F1F3F7]"}`}><Text className={`text-[10px] font-extrabold ${stops.length >= 2 ? "text-[#D93679]" : "text-[#A3A7B0]"}`}>⚡ Tối ưu lộ trình</Text></Pressable>
          </View>
          <View className="mt-3 flex-row gap-2">
            {(["DISTANCE", "TIME"] as const).map((mode) => (
              <Pressable key={mode} onPress={() => setOptimizeMode(mode)} className={`flex-1 rounded-xl py-2.5 ${optimizeMode === mode ? "bg-[#2B2233]" : "bg-[#F1F3F7]"}`}><Text className={`text-center text-[10px] font-bold ${optimizeMode === mode ? "text-white" : "text-[#777181]"}`}>{mode === "DISTANCE" ? "Tổng quãng đường ngắn" : "Ít tốn thời gian"}</Text></Pressable>
            ))}
          </View>

          <View className="mt-3 gap-2">
            {stops.map((stop, index) => (
              <View key={String(stop.id)} className="flex-row items-center gap-3 rounded-2xl border border-[#E8EDF4] p-3">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-[#EB489B]"><Text className="text-[12px] font-extrabold text-white">{index + 1}</Text></View>
                <View className="flex-1"><Text className="text-[12px] font-extrabold text-[#2B2233]" numberOfLines={1}>{stop.title}</Text><Text className="text-[10px] text-[#8E869A]" numberOfLines={1}>{stop.address}</Text>{stop.scheduleLabel ? <Text className="mt-1 text-[9px] font-bold text-[#F58752]">🕒 {stop.scheduleLabel}</Text> : null}</View>
                <View className="gap-1"><View className="flex-row gap-1"><Pressable onPress={() => moveStop(index, -1)} disabled={index === 0} className="h-7 w-7 items-center justify-center rounded-lg bg-[#F1F3F7]"><Text>↑</Text></Pressable><Pressable onPress={() => moveStop(index, 1)} disabled={index === stops.length - 1} className="h-7 w-7 items-center justify-center rounded-lg bg-[#F1F3F7]"><Text>↓</Text></Pressable></View><Pressable onPress={() => setStops((current) => current.filter((_, currentIndex) => currentIndex !== index))} className="h-7 items-center justify-center rounded-lg bg-[#FFF0F2]"><Text className="text-[9px] font-bold text-[#D13C54]">Xóa</Text></Pressable></View>
              </View>
            ))}
            {!stops.length ? <View className="items-center rounded-2xl border border-dashed border-[#D9DDE7] px-4 py-7"><Text className="text-[12px] font-bold text-[#8E869A]">Chưa có địa điểm nào trong hành trình</Text></View> : null}
          </View>
        </View>

        <View className="mt-4 rounded-3xl border border-[#F2D8E4] bg-[#FFF9FC] p-4">
          <Text className="text-[13px] font-extrabold text-[#2B2233]">Mở rộng khi backend/AI sẵn sàng</Text>
          <Text className="mt-2 text-[11px] leading-5 text-[#777181]">• Tránh giờ cao điểm theo dữ liệu giao thông.{"\n"}• Ưu tiên địa điểm sắp đóng cửa lên trước.{"\n"}• Tính thời gian tham quan và thời gian di chuyển thực tế.{"\n"}• AI giải thích vì sao đề xuất từng địa điểm.</Text>
        </View>

        <Pressable disabled={stops.length < 2} onPress={() => void openInGoogleMaps()} className={`mt-4 rounded-2xl py-4 ${stops.length >= 2 ? "bg-[#1677C8]" : "bg-[#D9DDE7]"}`}><Text className="text-center text-[13px] font-extrabold text-white">Mở {stops.length} điểm trong Google Maps</Text></Pressable>
        <Pressable disabled={stops.length < 2} onPress={() => Alert.alert("UI đã sẵn sàng", "Sau này nút này sẽ lưu Custom Route và chuyển sang trang Route Detail.")} className={`mt-3 rounded-2xl py-4 ${stops.length >= 2 ? "bg-[#EB489B]" : "bg-[#D9DDE7]"}`}><Text className="text-center text-[13px] font-extrabold text-white">Chốt kế hoạch và tạo route</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
