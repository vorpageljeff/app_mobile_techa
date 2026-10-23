// app/farm/new.tsx
// Registro de nueva estancia + parcela con mapa GPS real (react-native-maps)
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import MapView from '@/components/map/MapView';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { farmsAPI, fieldsAPI } from '@/services/api';
import { fieldCacheDB } from '@/services/database';
import { FieldPolygonMap } from '@/components/map/FieldPolygonMap';
import { useI18nStore } from '@/store/i18n';
import { showNotice, getApiErrorMessage } from '@/utils/notify';

const CROP_KEYS = ['crop.soy', 'crop.corn', 'crop.wheat', 'crop.canola', 'crop.other'];
// Centro padrão: Hernandarias, Alto Paraná, Paraguay
const DEFAULT_REGION = { latitude: -25.397, longitude: -54.611, latitudeDelta: 0.05, longitudeDelta: 0.05 };

type Step = 'farm' | 'field' | 'polygon';

export default function NewFarmScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useI18nStore(s => s.t);
  const [step, setStep] = useState<Step>('farm');
  const [loading, setLoading] = useState(false);

  // Datos de la estancia
  const [farmName, setFarmName] = useState('');
  const [farmCity, setFarmCity] = useState('');
  const [createdFarmId, setCreatedFarmId] = useState('');

  // Datos de la parcela
  const [fieldName, setFieldName] = useState('');
  const [crop, setCrop] = useState('crop.soy');
  const [plantingDate, setPlantingDate] = useState('');
  const [polygonCoords, setPolygonCoords] = useState<{ latitude: number; longitude: number }[]>([]);

  // Mapa
  const [mapRegion, setMapRegion] = useState(DEFAULT_REGION);
  const [locationReady, setLocationReady] = useState(false);
  const [mapSearch, setMapSearch] = useState('');
  const [searchingMap, setSearchingMap] = useState(false);
  const mapRef = useRef<MapView>(null);

  // ── GPS: centra mapa en la ubicación real ───────────────────────
  useEffect(() => {
    if (step !== 'polygon') return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationReady(true);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const region = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setMapRegion(region);
        mapRef.current?.animateToRegion(region, 500);
      } catch {
        // fallback para Hernandarias
      } finally {
        setLocationReady(true);
      }
    })();
  }, [step]);

  // ── Paso 1: Crear Estancia ────────────────────────────────────────
  const handleCreateFarm = async () => {
    if (!farmName.trim()) { showNotice(t('common.requiredField'), t('farm.name')); return; }
    setLoading(true);
    try {
      const farm = await farmsAPI.create(farmName.trim(), farmCity.trim() || undefined, 'Alto Paraná');
      setCreatedFarmId(farm.id);
      queryClient.invalidateQueries({ queryKey: ['farms'] });
      setStep('field');
    } catch (e: any) {
      showNotice(t('common.error'), getApiErrorMessage(e, 'Não foi possível criar a fazenda'));
    } finally { setLoading(false); }
  };

  // ── Paso 2: Crear Parcela ─────────────────────────────────────────
  const handleCreateField = async () => {
    if (!fieldName.trim()) { showNotice(t('common.requiredField'), t('field.name')); return; }
    if (polygonCoords.length < 3) {
      showNotice(t('nav.field'), t('field.drawRequired'));
      return;
    }
    setLoading(true);

    const coords: [number, number][] = polygonCoords.map(p => [p.latitude, p.longitude]);
    const closed = [...coords, coords[0]];
    const geojson = { type: 'Polygon', coordinates: [closed.map(([lat, lon]) => [lon, lat])] };
    const area = estimateArea(coords);

    try {
      const field = await fieldsAPI.create(createdFarmId, {
        name: fieldName.trim(),
        crop: t(crop),
        planting_date: plantingDate || undefined,
        geometry_geojson: geojson,
      });

      // Caché offline (no-fatal)
      try {
        await fieldCacheDB.upsert({
          field_id: field.id,
          field_name: field.name,
          farm_name: farmName,
          geometry_json: JSON.stringify(geojson),
          area_ha: area,
        });
      } catch (cacheErr) {
        console.warn('[Cache] SQLite indisponível:', cacheErr);
      }

      queryClient.invalidateQueries({ queryKey: ['farms'] });

      router.replace('/(tabs)/farms');
      setTimeout(() => showNotice(t('field.registeredTitle'), `"${fieldName}" (${area.toFixed(1)} ha)\n${t('field.registeredMsg')}`), 300);
    } catch (e: any) {
      const msg = getApiErrorMessage(e, 'Não foi possível criar o talhão');
      showNotice(t('common.error'), msg);
    } finally { setLoading(false); }
  };

  // ── Toque en el mapa → agrega vértice ─────────────────────────────
  const handleMapPress = ({ latitude, longitude }: { latitude: number; longitude: number }) => {
    setPolygonCoords(prev => [...prev, { latitude, longitude }]);
  };

  const handleMovePoint = (index: number, coordinate: { latitude: number; longitude: number }) => {
    setPolygonCoords(prev => prev.map((point, i) => (i === index ? coordinate : point)));
  };

  const handleInsertPoint = (index: number, coordinate: { latitude: number; longitude: number }) => {
    setPolygonCoords(prev => {
      const next = [...prev];
      next.splice(index, 0, coordinate);
      return next;
    });
  };

  const handleSearchLocation = async () => {
    const query = mapSearch.trim();
    if (!query) return;
    if (Platform.OS === 'web') {
      const match = query.match(/^\s*(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)\s*$/);
      const latitude = match ? Number(match[1].replace(',', '.')) : NaN;
      const longitude = match ? Number(match[2].replace(',', '.')) : NaN;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        showNotice(t('common.error'), 'Na web, digite latitude e longitude, por exemplo: -25.397, -54.611. Você também pode arrastar o mapa.');
        return;
      }
      const nextRegion = { latitude, longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 };
      setMapRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 600);
      return;
    }
    setSearchingMap(true);
    try {
      const results = await Location.geocodeAsync(query);
      const first = results[0];
      if (!first) {
        showNotice(t('field.searchNotFound'), query);
        return;
      }
      const region = {
        latitude: first.latitude,
        longitude: first.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      };
      setMapRegion(region);
      mapRef.current?.animateToRegion(region, 600);
    } catch {
      showNotice(t('common.error'), t('field.searchError'));
    } finally {
      setSearchingMap(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 24}
    >
      {/* Barra de progreso */}
      <View style={styles.progressBar}>
        {(['farm', 'field', 'polygon'] as Step[]).map((s, i) => (
          <React.Fragment key={s}>
            <View style={[
              styles.stepCircle,
              (s === 'farm' || (s === 'field' && ['field', 'polygon'].includes(step)) || (s === 'polygon' && step === 'polygon'))
                && styles.stepCircleActive
            ]}>
              <Text style={styles.stepNum}>{i + 1}</Text>
            </View>
            {i < 2 && <View style={[
              styles.stepLine,
              (i === 0 && ['field', 'polygon'].includes(step)) && styles.stepLineActive,
              (i === 1 && step === 'polygon') && styles.stepLineActive,
            ]} />}
          </React.Fragment>
        ))}
      </View>

      {/* ── PASO 1: Estancia ── */}
      {step === 'farm' && (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepTitle}>{t('farm.newTitle')}</Text>
          <Text style={styles.label}>{t('farm.name')} *</Text>
          <TextInput style={styles.input} value={farmName} onChangeText={setFarmName}
            placeholder={t('farm.namePlaceholder')} placeholderTextColor="#9CA3AF" />
          <Text style={styles.label}>{t('farm.city')}</Text>
          <TextInput style={styles.input} value={farmCity} onChangeText={setFarmCity}
            placeholder={t('farm.cityPlaceholder')} placeholderTextColor="#9CA3AF" />
          <TouchableOpacity style={[styles.btnPrimary, loading && styles.btnDisabled]}
            onPress={handleCreateFarm} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>{t('common.next')} →</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── PASO 2: Datos de la Parcela ── */}
      {step === 'field' && (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepTitle}>{t('field.dataTitle')}</Text>
          <Text style={styles.label}>{t('field.name')} *</Text>
          <TextInput style={styles.input} value={fieldName} onChangeText={setFieldName}
            placeholder={t('field.namePlaceholder')} placeholderTextColor="#9CA3AF" />
          <Text style={styles.label}>{t('field.crop')}</Text>
          <View style={styles.cropRow}>
            {CROP_KEYS.map(c => (
              <TouchableOpacity key={c} style={[styles.cropChip, crop === c && styles.cropChipActive]}
                onPress={() => setCrop(c)}>
                <Text style={[styles.cropChipText, crop === c && styles.cropChipTextActive]}>{t(c)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>{t('field.plantingDate')}</Text>
          <TextInput
            style={styles.input}
            value={plantingDate}
            onChangeText={(text) => {
              // Máscara DD/MM/AAAA
              const digits = text.replace(/\D/g, '').slice(0, 8);
              let masked = digits;
              if (digits.length > 4) masked = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4);
              else if (digits.length > 2) masked = digits.slice(0,2) + '/' + digits.slice(2);
              setPlantingDate(masked);
              // Converte DD/MM/AAAA → AAAA-MM-DD para a API
              if (digits.length === 8) {
                const iso = `${digits.slice(4)}-${digits.slice(2,4)}-${digits.slice(0,2)}`;
                setPlantingDate(iso);
              }
            }}
            placeholder="DD/MM/AAAA"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            maxLength={10}
          />
          <TouchableOpacity style={styles.btnPrimary} onPress={() => setStep('polygon')}>
            <Text style={styles.btnText}>{t('field.drawNext')} →</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── PASO 3: Mapa con GPS ── */}
      {step === 'polygon' && (
        <View style={styles.mapContainer}>
          <Text style={styles.mapHint}>
            {t('field.drawHint')} ({polygonCoords.length} ponto{polygonCoords.length !== 1 ? 's' : ''}
            {polygonCoords.length >= 3 ? ` · ~${estimateArea(polygonCoords.map(p => [p.latitude, p.longitude] as [number, number])).toFixed(1)} ha` : ''})
          </Text>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={mapSearch}
              onChangeText={setMapSearch}
              placeholder={Platform.OS === 'web' ? '-25.397, -54.611' : t('field.searchPlaceholder')}
              placeholderTextColor="#9CA3AF"
              returnKeyType="search"
              onSubmitEditing={handleSearchLocation}
            />
            <TouchableOpacity
              style={[styles.searchButton, searchingMap && styles.btnDisabled]}
              onPress={handleSearchLocation}
              disabled={searchingMap}
            >
              {searchingMap
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={styles.searchButtonText}>{Platform.OS === 'web' ? 'Ir às coordenadas' : t('field.searchLocation')}</Text>}
            </TouchableOpacity>
          </View>
          <Text style={styles.moveHint}>{t('field.movePointHint')}</Text>

          {!locationReady && (
            <View style={styles.gpsLoading}>
              <ActivityIndicator color="#16A34A" />
              <Text style={styles.gpsLoadingText}>{t('field.gpsLoading')}</Text>
            </View>
          )}

          <FieldPolygonMap
            mapRef={mapRef}
            region={mapRegion}
            coordinates={polygonCoords}
            onAddCoordinate={handleMapPress}
            onMoveCoordinate={handleMovePoint}
            onInsertCoordinate={handleInsertPoint}
            pointLabel={t('field.point')}
            midpointLabel={t('field.addPoint')}
          />

          {/* Controles */}
          <View style={styles.mapControls}>
            <TouchableOpacity style={styles.btnUndo}
              onPress={() => setPolygonCoords(c => c.slice(0, -1))}
              disabled={polygonCoords.length === 0}>
              <Text style={styles.btnUndoText}>{t('field.undo')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnClear}
              onPress={() => setPolygonCoords([])}
              disabled={polygonCoords.length === 0}>
              <Text style={styles.btnClearText}>{t('field.clear')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, styles.btnSave, (loading || polygonCoords.length < 3) && styles.btnDisabled]}
            onPress={handleCreateField}
            disabled={loading || polygonCoords.length < 3}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>{t('field.register')}</Text>}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ── Estimación de área (Shoelace) ─────────────────────────────────
function estimateArea(coords: [number, number][]): number {
  if (coords.length < 3) return 0;
  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = coords[i][1] * 111320 * Math.cos((coords[i][0] * Math.PI) / 180);
    const yi = coords[i][0] * 111320;
    const xj = coords[j][1] * 111320 * Math.cos((coords[j][0] * Math.PI) / 180);
    const yj = coords[j][0] * 111320;
    area += xi * yj - xj * yi;
  }
  return Math.abs(area / 2) / 10000;
}

const G = '#16A34A';
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  progressBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  stepCircleActive: { backgroundColor: G },
  stepNum: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  stepLine: { width: 60, height: 2, backgroundColor: '#E5E7EB' },
  stepLineActive: { backgroundColor: G },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 40 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: '#1A202C', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    color: '#1A202C', backgroundColor: '#FFF', marginBottom: 14,
  },
  btnPrimary: { backgroundColor: G, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  cropRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  cropChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#D1D5DB', backgroundColor: '#FFF' },
  cropChipActive: { backgroundColor: '#F0FDF4', borderColor: G },
  cropChipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  cropChipTextActive: { color: G, fontWeight: '700' },
  // Mapa
  mapContainer: { flex: 1 },
  mapHint: {
    fontSize: 12, color: '#374151', textAlign: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#F9FAFB',
    fontSize: 13,
    color: '#1A202C',
  },
  searchButton: {
    minWidth: 92,
    borderRadius: 10,
    backgroundColor: G,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  searchButtonText: { color: '#FFF', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  moveHint: {
    fontSize: 11,
    color: '#6B7280',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingBottom: 8,
    textAlign: 'center',
  },
  gpsLoading: {
    position: 'absolute', top: 50, alignSelf: 'center', zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  gpsLoadingText: { color: '#FFF', fontSize: 13 },
  map: { flex: 1 },
  mapControls: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 12, paddingTop: 8, backgroundColor: '#FFF',
  },
  btnUndo: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB' },
  btnUndoText: { fontSize: 14, color: '#374151', fontWeight: '600' },
  btnClear: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#FCA5A5' },
  btnClearText: { fontSize: 14, color: '#EF4444', fontWeight: '600' },
  btnSave: { margin: 12, marginTop: 8 },
});
