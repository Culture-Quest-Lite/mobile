import { useMemo, useRef } from 'react';
import { Platform, Text, View } from 'react-native';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';

export type AppMapPoint = {
  id: string | number;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
};

export type AppMapProps = {
  points: AppMapPoint[];
  routeCoordinates?: { latitude: number; longitude: number }[];
  height?: number;
  showsUserLocation?: boolean;
  onPointPress?: (point: AppMapPoint) => void;
};

const defaultRegion: Region = {
  latitude: 10.7769,
  longitude: 106.7009,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

function isValidCoordinate(point: Pick<AppMapPoint, 'latitude' | 'longitude'>) {
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
    latitudeDelta: Math.max((Math.max(...latitudes) - Math.min(...latitudes)) * 1.8, 0.015),
    longitudeDelta: Math.max((Math.max(...longitudes) - Math.min(...longitudes)) * 1.8, 0.015),
  };
}

export function AppMap({
  points,
  routeCoordinates,
  height = 260,
  showsUserLocation = true,
  onPointPress,
}: AppMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const validPoints = useMemo(() => points.filter(isValidCoordinate), [points]);
  const initialRegion = useMemo(() => getRegion(validPoints), [validPoints]);

  const polylineCoordinates =
    routeCoordinates && routeCoordinates.length > 1
      ? routeCoordinates
      : validPoints.map((point) => ({
          latitude: point.latitude,
          longitude: point.longitude,
        }));

  if (Platform.OS === 'web') {
    return (
      <View
        style={{
          height,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#E8F0FE',
          borderRadius: 28,
          overflow: 'hidden',
        }}
      >
        <Text style={{ color: '#6E6B62', fontWeight: '700' }}>
          MapView chỉ chạy trên Android/iOS.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        height,
        width: '100%',
        overflow: 'hidden',
        borderRadius: 28,
        backgroundColor: '#E8F0FE',
      }}
    >
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        mapType="standard"
        style={{ width: '100%', height: '100%' }}
        initialRegion={initialRegion}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton
        loadingEnabled
        loadingIndicatorColor="#EB489B"
        loadingBackgroundColor="#E8F0FE"
        onMapReady={() => {
          if (validPoints.length > 1) {
            mapRef.current?.fitToCoordinates(
              validPoints.map((point) => ({
                latitude: point.latitude,
                longitude: point.longitude,
              })),
              {
                animated: true,
                edgePadding: { top: 55, right: 55, bottom: 55, left: 55 },
              },
            );
          }
        }}
      >
        {polylineCoordinates.length > 1 ? (
          <Polyline
            coordinates={polylineCoordinates}
            strokeWidth={4}
            strokeColor="#EB489B"
          />
        ) : null}

        {validPoints.map((point, index) => (
          <Marker
            key={String(point.id)}
            coordinate={{
              latitude: point.latitude,
              longitude: point.longitude,
            }}
            title={point.title}
            description={point.description}
            onPress={() => onPointPress?.(point)}
          >
            <View
              style={{
                height: 30,
                minWidth: 30,
                paddingHorizontal: 8,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#EB489B',
                borderColor: '#FFFFFF',
                borderWidth: 2,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>
                {index + 1}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}