export type Coordinate = { latitude: number; longitude: number };
export type Region = Coordinate & { latitudeDelta: number; longitudeDelta: number };

export const googleMapsWebKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY ?? '';
export const GOOGLE_MAPS_AUTH_ERROR = 'techa-google-maps-auth-error';

let loading: Promise<any> | null = null;

export function loadGoogleMaps(): Promise<any> {
  if (!googleMapsWebKey) return Promise.reject(new Error('Chave do Google Maps para web não configurada.'));
  const existing = (window as any).google?.maps;
  if (existing?.Map) return Promise.resolve(existing);
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    (window as any).gm_authFailure = () => window.dispatchEvent(new Event(GOOGLE_MAPS_AUTH_ERROR));
    const callback = '__techaGoogleMapsReady';
    const script = document.createElement('script');
    const timer = window.setTimeout(() => fail(new Error('O Google Maps demorou para responder.')), 15000);
    const fail = (error: Error) => {
      window.clearTimeout(timer);
      delete (window as any)[callback];
      script.remove();
      loading = null;
      reject(error);
    };
    (window as any)[callback] = () => {
      window.clearTimeout(timer);
      delete (window as any)[callback];
      resolve((window as any).google.maps);
    };
    script.async = true;
    script.onerror = () => fail(new Error('Não foi possível carregar o Google Maps.'));
    const params = new URLSearchParams({ key: googleMapsWebKey, loading: 'async', callback, v: 'weekly', language: 'pt-BR', libraries: 'maps,marker' });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    document.head.appendChild(script);
  });
  return loading;
}

export function fitGoogleRegion(maps: any, map: any, region: Region) {
  const bounds = new maps.LatLngBounds(
    { lat: region.latitude - region.latitudeDelta / 2, lng: region.longitude - region.longitudeDelta / 2 },
    { lat: region.latitude + region.latitudeDelta / 2, lng: region.longitude + region.longitudeDelta / 2 },
  );
  map.fitBounds(bounds);
}

export function googleBounds(maps: any, points: Coordinate[]) {
  const bounds = new maps.LatLngBounds();
  points.forEach(point => bounds.extend({ lat: point.latitude, lng: point.longitude }));
  return bounds;
}
