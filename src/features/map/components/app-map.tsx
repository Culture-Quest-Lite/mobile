import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Platform, Text, View } from "react-native";
import MapView, {
  Circle,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type Region,
} from "react-native-maps";

export type AppMapPoint = {
  accentColor?: string;
  labelBackgroundColor?: string;
  labelTextColor?: string;
  id: string | number;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  isCurrentUser?: boolean;
  avatarUri?: string | null;
};

export type AppMapConnectionLine = {
  color: string;
  coordinates: { latitude: number; longitude: number }[];
  id: string;
  lineDashPattern?: number[];
  strokeWidth?: number;
};

export type AppMapProps = {
  connectPointsWhenRouteMissing?: boolean;
  connectionLines?: AppMapConnectionLine[];
  fitEdgePadding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  focusVerticalOffsetRatio?: number;
  focusedPointId?: string | number | null;
  highlightedPointId?: string | number | null;
  points: AppMapPoint[];
  routeCoordinates?: { latitude: number; longitude: number }[];
  height?: number;
  borderRadius?: number;
  mapType?: "hybrid" | "standard";
  showsMyLocationButton?: boolean;
  showsUserLocation?: boolean;
  onPointPress?: (point: AppMapPoint) => void;
};

const defaultRegion: Region = {
  latitude: 10.7769,
  longitude: 106.7009,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

const defaultFitEdgePadding = {
  top: 55,
  right: 55,
  bottom: 55,
  left: 55,
};

function isValidCoordinate(point: Pick<AppMapPoint, "latitude" | "longitude">) {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180
  );
}

function getRegion(points: AppMapPoint[]): Region {
  const validPoints = points.filter(isValidCoordinate);
  if (validPoints.length === 0) return defaultRegion;

  const latitudes = validPoints.map((point) => point.latitude);
  const longitudes = validPoints.map((point) => point.longitude);

  return {
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    latitudeDelta: Math.max(
      (Math.max(...latitudes) - Math.min(...latitudes)) * 1.8,
      0.015,
    ),
    longitudeDelta: Math.max(
      (Math.max(...longitudes) - Math.min(...longitudes)) * 1.8,
      0.015,
    ),
  };
}

export function AppMap({
  borderRadius = 28,
  connectPointsWhenRouteMissing = true,
  connectionLines,
  fitEdgePadding,
  focusVerticalOffsetRatio = 0,
  focusedPointId,
  highlightedPointId,
  points,
  routeCoordinates,
  height = 260,
  mapType = "standard",
  showsMyLocationButton = true,
  showsUserLocation = true,
  onPointPress,
}: AppMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const [markerImageStates, setMarkerImageStates] = useState<
    Record<string, "failed" | "loaded">
  >({});
  const validPoints = useMemo(() => points.filter(isValidCoordinate), [points]);
  const initialRegion = useMemo(() => getRegion(validPoints), [validPoints]);
  const activeFitEdgePadding = fitEdgePadding ?? defaultFitEdgePadding;
  const normalizedFocusOffsetRatio = Math.max(
    0,
    Math.min(focusVerticalOffsetRatio, 0.32),
  );
  const focusedPoint =
    focusedPointId === null || typeof focusedPointId === "undefined"
      ? null
      : (validPoints.find((point) => `${point.id}` === `${focusedPointId}`) ??
        null);

  const polylineCoordinates =
    routeCoordinates && routeCoordinates.length > 1
      ? routeCoordinates
      : connectPointsWhenRouteMissing
        ? validPoints.map((point) => ({
            latitude: point.latitude,
            longitude: point.longitude,
          }))
        : [];
  const activeConnectionLines =
    connectionLines?.filter((line) => line.coordinates.length > 1) ?? [];

  useEffect(() => {
    if (!mapRef.current || validPoints.length === 0) return;

    const timer = setTimeout(() => {
      if (focusedPoint || validPoints.length === 1) {
        const targetPoint = focusedPoint ?? validPoints[0];
        const latitudeDelta = focusedPoint ? 0.018 : 0.025;
        const longitudeDelta = focusedPoint ? 0.018 : 0.025;

        mapRef.current?.animateToRegion(
          {
            latitude:
              targetPoint.latitude - latitudeDelta * normalizedFocusOffsetRatio,
            longitude: targetPoint.longitude,
            latitudeDelta,
            longitudeDelta,
          },
          350,
        );
        return;
      }

      mapRef.current?.fitToCoordinates(
        validPoints.map((point) => ({
          latitude: point.latitude,
          longitude: point.longitude,
        })),
        {
          animated: true,
          edgePadding: activeFitEdgePadding,
        },
      );
    }, 80);

    return () => clearTimeout(timer);
  }, [
    activeFitEdgePadding,
    focusedPoint,
    normalizedFocusOffsetRatio,
    validPoints,
  ]);

  if (Platform.OS === "web") {
    return (
      <View
        style={{
          height,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#E8F0FE",
          borderRadius,
          overflow: "hidden",
        }}
      >
        <Text style={{ color: "#6E6B62", fontWeight: "700" }}>
          MapView chỉ chạy trên Android/iOS.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        height,
        width: "100%",
        overflow: "hidden",
        borderRadius,
        backgroundColor: "#E8F0FE",
      }}
    >
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        style={{ width: "100%", height: "100%" }}
        initialRegion={initialRegion}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={showsMyLocationButton}
        loadingEnabled
        loadingIndicatorColor="#EB489B"
        loadingBackgroundColor="#E8F0FE"
        onMapReady={() => {
          if (focusedPoint || validPoints.length === 1) {
            const targetPoint = focusedPoint ?? validPoints[0];
            const latitudeDelta = focusedPoint ? 0.018 : 0.025;
            const longitudeDelta = focusedPoint ? 0.018 : 0.025;

            mapRef.current?.animateToRegion(
              {
                latitude:
                  targetPoint.latitude -
                  latitudeDelta * normalizedFocusOffsetRatio,
                longitude: targetPoint.longitude,
                latitudeDelta,
                longitudeDelta,
              },
              0,
            );
            return;
          }

          if (validPoints.length > 1) {
            mapRef.current?.fitToCoordinates(
              validPoints.map((point) => ({
                latitude: point.latitude,
                longitude: point.longitude,
              })),
              {
                animated: true,
                edgePadding: activeFitEdgePadding,
              },
            );
          }
        }}
      >
        {polylineCoordinates.length > 1 ? (
          <Polyline
            coordinates={polylineCoordinates}
            strokeWidth={3}
            strokeColor="rgba(127, 154, 189, 0.38)"
          />
        ) : null}

        {activeConnectionLines.map((line) => (
          <Polyline
            key={line.id}
            coordinates={line.coordinates}
            lineDashPattern={line.lineDashPattern ?? [6, 6]}
            strokeColor={line.color}
            strokeWidth={line.strokeWidth ?? 3}
          />
        ))}

        {validPoints.map((point) => {
          const coordinate = {
            latitude: point.latitude,
            longitude: point.longitude,
          };
          const isHighlighted =
            highlightedPointId !== null &&
            typeof highlightedPointId !== "undefined" &&
            `${point.id}` === `${highlightedPointId}`;
          const markerSize = isHighlighted ? 50 : 46;
          const markerRadius = markerSize / 2;
          const labelMarginTop = isHighlighted ? 5 : 6;
          const avatarKey = point.avatarUri ? `${point.id}:${point.avatarUri}` : null;
          const avatarState = avatarKey ? markerImageStates[avatarKey] : null;
          const shouldRenderAvatar = Boolean(point.avatarUri) && avatarState !== "failed";
          const shouldTrackViewChanges = Boolean(point.avatarUri) && avatarState !== "loaded";

          return [
            point.isCurrentUser ? (
              <Circle
                key={`${point.id}-radius`}
                center={coordinate}
                fillColor="rgba(70, 149, 255, 0.18)"
                radius={160}
                strokeColor="rgba(70, 149, 255, 0.22)"
                strokeWidth={1}
              />
            ) : null,
            <Marker
              key={String(point.id)}
              coordinate={coordinate}
              title={point.title}
              description={point.description}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => onPointPress?.(point)}
              tracksViewChanges={shouldTrackViewChanges}
            >
              <View
                collapsable={false}
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  width: isHighlighted ? 120 : 112,
                  height: isHighlighted ? 88 : 84,
                }}
              >
                <View
                  collapsable={false}
                  style={{
                    width: markerSize,
                    height: markerSize,
                    borderRadius: markerRadius,
                    borderWidth: isHighlighted ? 3.5 : 3,
                    borderColor: point.accentColor ?? "#5B9BFF",
                    backgroundColor: "#FFFFFF",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    shadowColor: "#18243B",
                    shadowOpacity: isHighlighted ? 0.24 : 0.18,
                    shadowRadius: isHighlighted ? 8 : 6,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: isHighlighted ? 9 : 7,
                  }}
                >
                  {shouldRenderAvatar ? (
                    <Image
                      source={{ uri: point.avatarUri }}
                      onError={() => {
                        if (!avatarKey) {
                          return;
                        }

                        setMarkerImageStates((currentValue) =>
                          currentValue[avatarKey] === "failed"
                            ? currentValue
                            : {
                                ...currentValue,
                                [avatarKey]: "failed",
                              },
                        );
                      }}
                      onLoadEnd={() => {
                        if (!avatarKey) {
                          return;
                        }

                        setMarkerImageStates((currentValue) =>
                          currentValue[avatarKey] === "loaded"
                            ? currentValue
                            : {
                                ...currentValue,
                                [avatarKey]: "loaded",
                              },
                        );
                      }}
                      style={{
                        width: markerSize,
                        height: markerSize,
                        borderRadius: markerRadius,
                      }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text
                      style={{
                        color: point.accentColor ?? "#5B9BFF",
                        fontSize: 16,
                      }}
                    >
                      {point.title.slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                </View>

                <View
                  style={{
                    marginTop: labelMarginTop,
                    maxWidth: 100,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: point.accentColor ?? "#5B9BFF",
                    backgroundColor: point.labelBackgroundColor ?? "#FFFFFF",
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      color:
                        point.labelTextColor ?? point.accentColor ?? "#2C4B74",
                      fontSize: 11,
                      fontWeight: "700",
                      textAlign: "center",
                    }}
                  >
                    {point.title}
                  </Text>
                </View>
              </View>
            </Marker>,
          ];
        })}
      </MapView>
    </View>
  );
}
