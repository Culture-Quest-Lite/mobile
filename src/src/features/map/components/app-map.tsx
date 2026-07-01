import { useMemo, useRef } from 'react';
import { Platform, Text, View } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';

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
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  const latitudeDelta = Math.max((maxLatitude - minLatitude) * 1.8, 0.015);
  const longitudeDelta = Math.max((maxLongitude - minLongitude) * 1.8, 0.015);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta,
    longitudeDelta,
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
      : validPoints.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));

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
    <View style={{ height, overflow: 'hidden', borderRadius: 28 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton
        onMapReady={() => {
          if (validPoints.length > 1) {
            mapRef.current?.fitToCoordinates(
              validPoints.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
              {
                animated: true,
                edgePadding: { top: 55, right: 55, bottom: 55, left: 55 },
              },
            );
          }
        }}
      >
        {polylineCoordinates.length > 1 ? (
          <Polyline coordinates={polylineCoordinates} strokeWidth={4} strokeColor="#EB489B" />
        ) : null}

        {validPoints.map((point, index) => (
          <Marker
            key={String(point.id)}
            coordinate={{ latitude: point.latitude, longitude: point.longitude }}
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
              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>{index + 1}</Text>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}
