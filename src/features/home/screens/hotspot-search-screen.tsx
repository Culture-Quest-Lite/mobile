import { SymbolView } from "@/components/ui/symbol-view";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { NearbyHotspotDto } from "../api/get-nearby-hotspots";
import type { HotspotSearchSortDirection } from "../api/search-hotspots";
import { useHotspotSearch } from "../hooks/use-hotspot-search";
import { getApiHotspotRouteSlug, getHotspotHref } from "../data/hotspots";
import {
  getDefaultOperatorForField,
  getFieldLabel,
  getFieldOperators,
  getFieldPlaceholder,
  hotspotSearchFieldOrder,
  hotspotSearchSortOptions,
  type HotspotAdvancedFilterDraft,
} from "../utils/hotspot-search-utils";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

const screenShadowStyle = {
  shadowColor: "rgba(20, 24, 40, 0.06)",
  shadowOpacity: 1,
  shadowRadius: 18,
  shadowOffset: {
    width: 0,
    height: 10,
  },
  elevation: 4,
} as const;

const defaultImageUri =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee";

function readMeaningfulText(value?: string | null) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
}

function formatHotspotMetric(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }

  return `${Math.max(0, Math.round(value))}`;
}

function resolveHotspotImageUri(hotspot: NearbyHotspotDto) {
  const sortedMedias = [...hotspot.medias]
    .filter((media) => readMeaningfulText(media.fileUrl))
    .sort((left, right) => {
      const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;

      return leftOrder - rightOrder;
    });

  return sortedMedias[0]?.fileUrl.trim() ?? defaultImageUri;
}

function resolveHotspotOverview(hotspot: NearbyHotspotDto) {
  return (
    readMeaningfulText(hotspot.description) ??
    readMeaningfulText(hotspot.historyInformation) ??
    "Không có mô tả cho hotspot này."
  );
}

function resolveHotspotTags(hotspot: NearbyHotspotDto) {
  return Array.from(
    new Set(
      hotspot.tags
        .map((tag) => tag.tagName.trim())
        .filter((tagName) => tagName.length > 0),
    ),
  ).slice(0, 3);
}

function SearchSummaryChip({ label }: { label: string }) {
  return (
    <View className="rounded-full border border-[#E8EDF3] bg-[#F7FAFC] px-3 py-2">
      <Text className="text-[12px] font-bold text-[#435160]">{label}</Text>
    </View>
  );
}

function FilterChoiceChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable className="rounded-full" hitSlop={6} onPress={onPress}>
      <View
        className={`rounded-full px-3 py-2 ${
          active ? "bg-[#1F2937]" : "border border-[#E5E7EB] bg-white"
        }`}
      >
        <Text
          className={`text-[12px] font-bold ${
            active ? "text-white" : "text-[#475467]"
          }`}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function SortDirectionChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return <FilterChoiceChip active={active} label={label} onPress={onPress} />;
}

function StatusQuickValueRow({
  onSelect,
  selectedValue,
}: {
  onSelect: (value: string) => void;
  selectedValue: string;
}) {
  return (
    <View className="mt-3 flex-row gap-2">
      {["DRAFT", "PUBLISHED"].map((value) => (
        <FilterChoiceChip
          key={value}
          active={selectedValue.trim().toUpperCase() === value}
          label={value}
          onPress={() => onSelect(value)}
        />
      ))}
    </View>
  );
}

function AdvancedFilterCard({
  filter,
  onRemove,
  onUpdate,
}: {
  filter: HotspotAdvancedFilterDraft;
  onRemove: () => void;
  onUpdate: (patch: Partial<Omit<HotspotAdvancedFilterDraft, "id">>) => void;
}) {
  const supportedOperators = getFieldOperators(filter.field);
  const isStatusField = filter.field === "status";

  return (
    <View
      className="rounded-[24px] border border-[#EDF1F5] bg-[#FBFCFE] p-4"
      style={screenShadowStyle}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-[14px] font-black text-[#111827]">
          {getFieldLabel(filter.field)}
        </Text>
        <Pressable hitSlop={8} onPress={onRemove}>
          <Text className="text-[12px] font-bold text-[#D14343]">Xóa</Text>
        </Pressable>
      </View>

      <ScrollView
        className="mt-3"
        contentContainerStyle={{ paddingRight: 24 }}
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
      >
        {hotspotSearchFieldOrder.map((field, index) => (
          <View
            key={`${filter.id}-field-${field}`}
            className={index === hotspotSearchFieldOrder.length - 1 ? "" : "mr-2"}
          >
            <FilterChoiceChip
              active={filter.field === field}
              label={getFieldLabel(field)}
              onPress={() =>
                onUpdate({
                  field,
                  operator: getDefaultOperatorForField(field),
                  rawValue: "",
                })
              }
            />
          </View>
        ))}
      </ScrollView>

      <ScrollView
        className="mt-3"
        contentContainerStyle={{ paddingRight: 24 }}
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
      >
        {supportedOperators.map((operator, index) => (
          <View
            key={`${filter.id}-operator-${operator}`}
            className={index === supportedOperators.length - 1 ? "" : "mr-2"}
          >
            <FilterChoiceChip
              active={filter.operator === operator}
              label={operator}
              onPress={() => onUpdate({ operator })}
            />
          </View>
        ))}
      </ScrollView>

      <View className="mt-3 rounded-[18px] border border-[#E6EBF0] bg-white px-4 py-3">
        <TextInput
          placeholder={getFieldPlaceholder(filter.field)}
          placeholderTextColor="#98A2B3"
          value={filter.rawValue}
          onChangeText={(value) => onUpdate({ rawValue: value })}
        />
      </View>

      {isStatusField ? (
        <StatusQuickValueRow
          selectedValue={filter.rawValue}
          onSelect={(value) => onUpdate({ rawValue: value })}
        />
      ) : null}
    </View>
  );
}

function ResultStatChip({
  icon,
  label,
}: {
  icon: SymbolName;
  label: string;
}) {
  return (
    <View className="flex-row items-center rounded-full bg-[#F7FAFC] px-2.5 py-1.5">
      <SymbolView name={icon} size={12} tintColor="#536471" />
      <Text className="ml-1.5 text-[11px] font-bold text-[#536471]">{label}</Text>
    </View>
  );
}

function HotspotSearchResultCard({
  hotspot,
  onPress,
}: {
  hotspot: NearbyHotspotDto;
  onPress: () => void;
}) {
  const tags = resolveHotspotTags(hotspot);

  return (
    <Pressable
      className="rounded-[26px] border border-[#EDF1F5] bg-white p-3"
      onPress={onPress}
      style={screenShadowStyle}
    >
      <View className="flex-row gap-3">
        <Image
          source={resolveHotspotImageUri(hotspot)}
          cachePolicy="memory-disk"
          contentFit="cover"
          style={{ borderRadius: 18, height: 112, width: 112 }}
          transition={180}
        />

        <View className="min-w-0 flex-1">
          <View className="flex-row items-start justify-between gap-3">
            <Text
              className="min-w-0 flex-1 text-[16px] font-black leading-5 text-[#111827]"
              numberOfLines={2}
            >
              {hotspot.hotspotName.trim() || "Hotspot"}
            </Text>
            <View className="rounded-full bg-[#FFF4E8] px-2.5 py-1.5">
              <Text className="text-[11px] font-extrabold text-[#C96C1E]">
                {hotspot.status.trim() || "N/A"}
              </Text>
            </View>
          </View>

          <Text className="mt-1 text-[12px] leading-[18px] text-[#667085]" numberOfLines={2}>
            {readMeaningfulText(hotspot.address) ?? "Địa chỉ đang cập nhật"}
          </Text>

          <Text
            className="mt-2 text-[13px] leading-[18px] text-[#475467]"
            numberOfLines={3}
          >
            {resolveHotspotOverview(hotspot)}
          </Text>

          <View className="mt-3 flex-row flex-wrap gap-2">
            <ResultStatChip
              icon={{ ios: "sparkles", android: "auto_awesome", web: "auto_awesome" }}
              label={`XP ${formatHotspotMetric(hotspot.xp)}`}
            />
            <ResultStatChip
              icon={{ ios: "star.fill", android: "star", web: "star" }}
              label={`Điểm ${formatHotspotMetric(hotspot.point)}`}
            />
            <ResultStatChip
              icon={{ ios: "calendar", android: "calendar_today", web: "calendar_today" }}
              label={hotspot.createdAt.slice(0, 10) || "Ngày tạo"}
            />
          </View>
        </View>
      </View>

      {tags.length > 0 ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {tags.map((tag) => (
            <View
              key={`${hotspot.hotspotId}-${tag}`}
              className="rounded-full bg-[#F8EEF6] px-3 py-1.5"
            >
              <Text className="text-[11px] font-bold text-[#C73A7A]">{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function PaginationBar({
  currentPage,
  onPageChange,
  totalPages,
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
}) {
  return (
    <View className="mt-6 flex-row items-center justify-center gap-3">
      <Pressable
        className={`rounded-full px-4 py-2 ${currentPage <= 1 ? "bg-[#EEF2F6]" : "bg-[#111827]"}`}
        disabled={currentPage <= 1}
        onPress={() => onPageChange(currentPage - 1)}
      >
        <Text
          className={`text-[13px] font-bold ${
            currentPage <= 1 ? "text-[#98A2B3]" : "text-white"
          }`}
        >
          Trước
        </Text>
      </Pressable>

      <View className="rounded-full bg-[#F7FAFC] px-4 py-2">
        <Text className="text-[13px] font-bold text-[#435160]">
          Trang {currentPage}/{Math.max(1, totalPages)}
        </Text>
      </View>

      <Pressable
        className={`rounded-full px-4 py-2 ${
          currentPage >= totalPages ? "bg-[#EEF2F6]" : "bg-[#111827]"
        }`}
        disabled={currentPage >= totalPages}
        onPress={() => onPageChange(currentPage + 1)}
      >
        <Text
          className={`text-[13px] font-bold ${
            currentPage >= totalPages ? "text-[#98A2B3]" : "text-white"
          }`}
        >
          Sau
        </Text>
      </Pressable>
    </View>
  );
}

export default function HotspotSearchScreen() {
  const inputRef = useRef<TextInput | null>(null);
  const router = useRouter();
  const [isAdvancedPanelVisible, setIsAdvancedPanelVisible] = useState(false);
  const {
    addDraftFilter,
    applyAdvancedFilters,
    currentPage,
    draftFilters,
    errorMessage,
    hasAdvancedFilters,
    keyword,
    pendingSortBy,
    pendingSortDirection,
    removeDraftFilter,
    results,
    retry,
    setCurrentPage,
    setKeyword,
    setPendingSortBy,
    setPendingSortDirection,
    status,
    summaryChips,
    totalPages,
    updateDraftFilter,
  } = useHotspotSearch();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right", "bottom"]}>
      <View className="border-b border-[#EEF2F6] bg-white px-5 pb-4 pt-3">
        <View className="flex-row items-center">
          <View
            className="mr-2 h-10 flex-row items-center rounded-[14px] bg-[#F4F6F8] px-3.5"
            style={{ width: "82%" }}
          >
            <SymbolView
              name={{ ios: "magnifyingglass", android: "search", web: "search" }}
              size={15}
              tintColor="#98A2B3"
            />
              <TextInput
                ref={inputRef}
                className="ml-2.5 flex-1 py-0 text-[15px] text-[#111827]"
                placeholder="Tìm hotspot hoặc địa chỉ"
                placeholderTextColor="#98A2B3"
                returnKeyType="search"
                value={keyword}
              onChangeText={setKeyword}
            />
          </View>

          <Pressable
            hitSlop={8}
            onPress={() => {
              setIsAdvancedPanelVisible(false);
              setKeyword("");
              inputRef.current?.focus();
            }}
          >
            <Text className="text-[15px] font-medium text-[#667085]">Hủy</Text>
          </Pressable>
        </View>

        {summaryChips.length > 0 ? (
          <ScrollView
            className="mt-3"
            contentContainerStyle={{ paddingRight: 24 }}
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
          >
            {summaryChips.map((chipLabel, index) => (
              <View
                key={`${chipLabel}-${index}`}
                className={index === summaryChips.length - 1 ? "" : "mr-2"}
              >
                <SearchSummaryChip label={chipLabel} />
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 36 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-3">
          {isAdvancedPanelVisible ? (
            <View
              className="rounded-[28px] border border-[#EDF1F5] bg-white p-4"
              style={screenShadowStyle}
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-[16px] font-black text-[#111827]">
                  Bộ lọc hotspot
                </Text>
                <Pressable hitSlop={8} onPress={() => addDraftFilter()}>
                  <Text className="text-[13px] font-bold text-[#C73A7A]">+ Thêm filter</Text>
                </Pressable>
              </View>

              <View className="mt-4 gap-4">
                {draftFilters.length > 0 ? (
                  draftFilters.map((filter) => (
                    <AdvancedFilterCard
                      key={filter.id}
                      filter={filter}
                      onRemove={() => removeDraftFilter(filter.id)}
                      onUpdate={(patch) => updateDraftFilter(filter.id, patch)}
                    />
                  ))
                ) : (
                  <View className="rounded-[22px] bg-[#F8FAFC] px-4 py-4">
                    <Text className="text-[13px] leading-5 text-[#667085]">
                      Chưa có filter nâng cao. Bạn có thể thêm filter theo tag, địa chỉ,
                      mô tả, lịch sử, trạng thái, ngày tạo hoặc người tạo.
                    </Text>
                  </View>
                )}
              </View>

              <View className="mt-5">
                <Text className="text-[14px] font-black text-[#111827]">
                  Sắp xếp kết quả
                </Text>

                <ScrollView
                  className="mt-3"
                  contentContainerStyle={{ paddingRight: 24 }}
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                >
                  {hotspotSearchSortOptions.map((option, index) => (
                    <View
                      key={option.value}
                      className={index === hotspotSearchSortOptions.length - 1 ? "" : "mr-2"}
                    >
                      <FilterChoiceChip
                        active={pendingSortBy === option.value}
                        label={option.label}
                        onPress={() => setPendingSortBy(option.value)}
                      />
                    </View>
                  ))}
                </ScrollView>

                <View className="mt-3 flex-row gap-2">
                  {(["DESC", "ASC"] as HotspotSearchSortDirection[]).map((direction) => (
                    <SortDirectionChip
                      key={direction}
                      active={pendingSortDirection === direction}
                      label={direction === "DESC" ? "Giảm dần" : "Tăng dần"}
                      onPress={() => setPendingSortDirection(direction)}
                    />
                  ))}
                </View>
              </View>

              <Pressable
                className="mt-5 items-center rounded-full bg-[#111827] px-5 py-3.5"
                onPress={applyAdvancedFilters}
              >
                <Text className="text-[14px] font-black text-white">Áp dụng bộ lọc</Text>
              </Pressable>
            </View>
          ) : null}

          {!keyword.trim() && !hasAdvancedFilters ? (
            <View className="mt-3">
              <Text className="text-[13px] leading-5 text-[#667085]">
                Tìm kiếm theo tên hotspot hoặc địa chỉ.
              </Text>
            </View>
          ) : null}

          {keyword.trim() || hasAdvancedFilters ? (
            <View className="mt-5">
              {status === "loading" ? (
                <View className="min-h-[320px] items-center justify-center">
                  <ActivityIndicator color="#111827" size="large" />
                  <Text className="mt-4 text-[14px] font-medium text-[#667085]">
                    Đang tải dữ liệu hotspot...
                  </Text>
                </View>
              ) : status === "error" ? (
                <View
                  className="mt-4 rounded-[26px] border border-[#F2D7D7] bg-[#FFF8F8] px-5 py-5"
                  style={screenShadowStyle}
                >
                  <Text className="text-[15px] font-black text-[#A02828]">
                    {errorMessage ?? "Không thể tải dữ liệu hotspot."}
                  </Text>
                  <Pressable
                    className="mt-4 self-start rounded-full bg-[#111827] px-4 py-2.5"
                    onPress={retry}
                  >
                    <Text className="text-[13px] font-bold text-white">Thử lại</Text>
                  </Pressable>
                </View>
              ) : results.length === 0 ? (
                <View
                  className="mt-4 rounded-[26px] border border-dashed border-[#E5E7EB] bg-[#FAFBFC] px-5 py-8"
                  style={screenShadowStyle}
                >
                  <Text className="text-center text-[16px] font-black text-[#111827]">
                    Không có hotspot phù hợp
                  </Text>
                  <Text className="mt-2 text-center text-[13px] leading-5 text-[#667085]">
                    Hãy thử đổi từ khóa hoặc giảm điều kiện tìm kiếm để xem thêm hotspot.
                  </Text>
                </View>
              ) : (
                <View className="mt-4 gap-4">
                  {results.map((hotspot) => (
                    <HotspotSearchResultCard
                      key={`${hotspot.hotspotId}-${hotspot.createdAt}`}
                      hotspot={hotspot}
                      onPress={() =>
                        router.push(
                          getHotspotHref(
                            getApiHotspotRouteSlug(hotspot.hotspotId),
                            hotspot.hotspotId,
                          ),
                        )
                      }
                    />
                  ))}
                </View>
              )}

              {status === "ready" && results.length > 0 && totalPages > 1 ? (
                <PaginationBar
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  totalPages={totalPages}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
