/** GPS 거리 계산 (Haversine). 단위: m */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))));
}

export interface GeoTarget {
  lat: number | null;
  lng: number | null;
  radiusM: number;
}

export type GpsVerdict = {
  status: 'OK' | 'OUT_OF_RANGE' | 'NO_GPS';
  distanceM: number | null;
};

/**
 * 직원 위치가 지정 근무지 허용반경 안인지 판정한다.
 * 근무지에 좌표가 등록돼 있지 않으면 검증을 건너뛰고 OK 로 본다.
 */
export function verifyLocation(
  lat: number | null | undefined,
  lng: number | null | undefined,
  target: GeoTarget | null,
): GpsVerdict {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return { status: 'NO_GPS', distanceM: null };
  }
  if (!target || target.lat == null || target.lng == null) {
    return { status: 'OK', distanceM: null };
  }
  const d = distanceMeters(lat, lng, target.lat, target.lng);
  return { status: d <= target.radiusM ? 'OK' : 'OUT_OF_RANGE', distanceM: d };
}
