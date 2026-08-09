import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SymbolView } from "@/components/ui/symbol-view";
import { ScreenHorizontalPadding } from "@/constants/theme";
import {
  Pressable,
  ScrollView,
  Text as RNText,
  View,
  type TextProps,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { setStoredLanguage } from "@/lib/i18n";

const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const detailTextMaxFontSizeMultiplier = 1.05;

type LanguageOption = {
  code: string;
  label: string;
  nativeLabel: string;
};

const languages: LanguageOption[] = [
  {
    code: "vi",
    label: "Vietnamese",
    nativeLabel: "Tiếng Việt",
  },
  {
    code: "en",
    label: "English",
    nativeLabel: "English",
  },
];

function Text({
  maxFontSizeMultiplier = detailTextMaxFontSizeMultiplier,
  style,
  ...props
}: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[{ includeFontPadding: false }, style]}
      {...props}
    />
  );
}

export default function LanguageSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/profile/menu");
  };

  const handleLanguageChange = async (languageCode: string) => {
    await i18n.changeLanguage(languageCode);
    await setStoredLanguage(languageCode);
  };

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      edges={["left", "right", "bottom"]}
    >
      <ScrollView
        className="flex-1 bg-white"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 12) + 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={gradientColors}
          end={{ x: 1, y: 0.5 }}
          start={{ x: 0, y: 0.5 }}
          style={{
            paddingBottom: 12,
            paddingHorizontal: ScreenHorizontalPadding,
            paddingTop: insets.top + 8,
          }}
        >
          <View className="flex-row items-center justify-between">
            <Pressable
              accessibilityLabel={t('common.back')}
              className="h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/15"
              onPress={handleBack}
            >
              <SymbolView
                name={{
                  ios: "chevron.left",
                  android: "arrow_back",
                  web: "arrow_back",
                }}
                size={18}
                tintColor="#FFF7F0"
              />
            </Pressable>

            <Text
              className="flex-1 px-3 text-center text-[19px] font-semibold text-white"
              numberOfLines={1}
              style={{ lineHeight: 22 }}
            >
              {t('settings.language.title')}
            </Text>

            <View className="h-9 w-9" />
          </View>
        </LinearGradient>

        <View className="bg-white px-4 py-4">
          <Text
            className="mb-3 text-[14px] text-[#6B6B6B]"
            style={{ lineHeight: 18 }}
          >
            {t('settings.language.description')}
          </Text>

          <View className="rounded-2xl border border-[#ECE8F2] bg-white">
            {languages.map((lang, index) => (
              <LanguageRow
                key={lang.code}
                language={lang}
                isSelected={i18n.language === lang.code}
                onPress={() => handleLanguageChange(lang.code)}
                showDivider={index < languages.length - 1}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LanguageRow({
  language,
  isSelected,
  onPress,
  showDivider,
}: {
  language: LanguageOption;
  isSelected: boolean;
  onPress: () => void;
  showDivider: boolean;
}) {
  return (
    <Pressable
      className="flex-row items-center justify-between px-4 py-4"
      onPress={onPress}
      style={
        showDivider
          ? {
              borderBottomColor: "#ECE8F2",
              borderBottomWidth: 1,
            }
          : undefined
      }
    >
      <View className="flex-1">
        <Text
          className="text-[16px] font-semibold text-[#27233A]"
          style={{ lineHeight: 20 }}
        >
          {language.nativeLabel}
        </Text>
        <Text
          className="mt-0.5 text-[13px] text-[#9A94A8]"
          style={{ lineHeight: 16 }}
        >
          {language.label}
        </Text>
      </View>

      {isSelected && (
        <View className="h-6 w-6 items-center justify-center rounded-full bg-[#EB489B]">
          <SymbolView
            name={{
              ios: "checkmark",
              android: "check",
              web: "check",
            }}
            size={14}
            tintColor="#FFFFFF"
          />
        </View>
      )}
    </Pressable>
  );
}
