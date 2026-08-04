import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

type PinkBrushBackgroundProps = {
  children?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

export function PinkBrushBackground({
  children,
  contentContainerStyle,
  style,
}: PinkBrushBackgroundProps) {
  return (
    <View style={[styles.container, style]}>
      <Svg
        pointerEvents="none"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
        viewBox="0 0 390 844"
      >
        <Defs>
          <LinearGradient id="brushBase" x1="58" x2="330" y1="28" y2="808">
            <Stop offset="0" stopColor="#FFF4F8" />
            <Stop offset="0.5" stopColor="#FCE4EC" />
            <Stop offset="1" stopColor="#F9D5E0" />
          </LinearGradient>
          <LinearGradient id="cornerBrush" x1="255" x2="390" y1="12" y2="180">
            <Stop offset="0" stopColor="#FAD0DD" />
            <Stop offset="1" stopColor="#F7BFD1" />
          </LinearGradient>
        </Defs>

        <Path
          d="M40 22C92 4 161 10 232 17C296 23 353 34 376 72C395 103 387 147 389 195C391 247 378 300 376 355C374 414 383 474 373 536C364 596 334 648 334 705C334 752 352 799 327 827C299 858 230 855 164 845C106 836 55 818 28 780C2 743 8 687 9 633C10 578 18 524 17 469C15 413 5 359 8 304C12 242 30 186 39 134C46 95 12 55 40 22Z"
          fill="url(#brushBase)"
        />

        <Path
          d="M286 20C320 24 355 36 390 57V127C357 110 327 97 296 90C286 72 283 46 286 20Z"
          fill="url(#cornerBrush)"
          opacity="0.96"
        />
        <Path
          d="M304 70C336 80 365 97 390 120V162C361 144 334 130 304 118C300 103 300 86 304 70Z"
          fill="#F8BDD0"
          opacity="0.84"
        />
        <Path
          d="M0 108C16 90 34 76 58 67C51 101 44 132 34 161C25 187 14 209 0 228V108Z"
          fill="#FAD4DF"
          opacity="0.82"
        />
        <Path
          d="M0 452C24 420 52 391 84 365C74 413 61 455 44 494C32 521 18 545 0 573V452Z"
          fill="#FAD4DF"
          opacity="0.7"
        />
        <Path
          d="M0 694C35 680 68 676 101 681C82 714 61 746 35 777C25 790 14 801 0 813V694Z"
          fill="#F8CBDA"
          opacity="0.62"
        />

        <Path
          d="M75 112C107 145 124 197 121 252C118 309 101 358 77 399C56 348 50 291 53 236C55 190 62 149 75 112Z"
          fill="#FFFFFF"
          opacity="0.34"
        />
        <Path
          d="M265 136C292 165 309 208 311 256C313 315 299 369 278 416C257 383 248 342 246 299C243 244 248 191 265 136Z"
          fill="#FFFFFF"
          opacity="0.28"
        />
        <Path
          d="M110 508C153 472 214 466 263 489C229 516 196 530 156 541C130 548 105 560 79 556C84 536 95 520 110 508Z"
          fill="#FFFFFF"
          opacity="0.22"
        />
        <Path
          d="M56 36C80 24 107 20 138 19C120 44 107 69 90 93C79 109 68 125 53 135C48 103 47 67 56 36Z"
          fill="#FFFFFF"
          opacity="0.7"
        />
        <Path
          d="M347 226C361 239 375 258 390 285V338C369 353 349 366 322 375C334 329 340 281 347 226Z"
          fill="#FFFFFF"
          opacity="0.48"
        />
        <Path
          d="M270 767C309 759 349 772 390 802V844H306C291 823 280 797 270 767Z"
          fill="#FFFFFF"
          opacity="0.42"
        />
      </Svg>

      <View style={[styles.content, contentContainerStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
