import { LinearGradient } from "expo-linear-gradient";
import { StatusBar, type StatusBarStyle } from "expo-status-bar";
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

type AppLoadingScreenProps = {
  edges?: Edge[];
  message?: string;
  mode?: "embedded" | "fullscreen";
  spinnerColor?: string;
  statusBarStyle?: StatusBarStyle;
  style?: StyleProp<ViewStyle>;
};

const defaultEdges: Edge[] = ["top", "left", "right", "bottom"];

export function AppLoadingScreen({
  edges = defaultEdges,
  mode = "fullscreen",
  spinnerColor = "#E93D83",
  statusBarStyle = "dark",
  style,
}: AppLoadingScreenProps) {
  const content = (
    <View style={[styles.canvas, style]}>
      <LinearGradient
        colors={["#FFFFFF", "#FFFFFF"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.centerContent}>
        <ActivityIndicator color={spinnerColor} size="large" />
      </View>
    </View>
  );

  if (mode === "embedded") {
    return content;
  }

  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      <StatusBar style={statusBarStyle} />
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#FFFFFF",
    flex: 1,
  },
  canvas: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    overflow: "hidden",
  },
  softWash: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.96,
  },
  centerContent: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
});
