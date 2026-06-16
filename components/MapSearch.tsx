import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin,
  Search,
  Loader2,
  Phone,
  Globe,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Star,
  X,
  Copy,
  Check,
  Download,
  Trash2,
  PlusCircle,
  Mail,
  Target,
  Navigation,
  SlidersHorizontal,
} from 'lucide-react';
import { BusinessData, ScraperSettings } from '../types';

// ─── tipos internos ───────────────────────────────────────────────────────────
interface MapSearchResult extends BusinessData {
  _id: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────
const uniqueId = () => Math.random().toString(36).slice(2, 9);

const buildGMapsLink = (name?: string, address?: string) => {
  const q = `${name || ''} ${address || ''}`.trim();
  return q
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
    : 'https://www.google.com/maps';
};

// Convierte metros a grados aproximados (para el bbox visual)
const metersToDeg = (meters: number) => meters / 111_320;

// ─── componente principal ─────────────────────────────────────────────────────
const MapSearch: React.FC = () => {
  // ── refs de Leaflet (cargado dinámicamente) ──────────────────────────────
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const mapElRef = useRef<HTMLDivElement>(null);
  const leafletCssRef = useRef<HTMLLinkElement | null>(null);

  // ── estado ───────────────────────────────────────────────────────────────
  const [mapReady, setMapReady] = useState(false);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(1);
  const [keyword, setKeyword] = useState<string>('');
  const [maxLeads, setMaxLeads] = useState<number>(20);

  const [isScraping, setIsScraping] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MapSearchResult[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [lastCenter, setLastCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [lastKeyword, setLastKeyword] = useState('');
  const [lastRadius, setLastRadius] = useState(1);

  // ── cargar Leaflet CSS + JS ───────────────────────────────────────────────
  useEffect(() => {
    // CSS
    if (!leafletCssRef.current) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      leafletCssRef.current = link;
    }

    // JS
    if ((window as any).L) {
      leafletRef.current = (window as any).L;
      initMap();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      leafletRef.current = (window as any).L;
      initMap();
    };
    document.body.appendChild(script);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initMap = useCallback(() => {
    if (!mapElRef.current || mapRef.current) return;
    const L = leafletRef.current;

    const map = L.map(mapElRef.current, {
      center: [-33.4489, -70.6693], // Santiago por defecto
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    setMapReady(true);

    // Click en el mapa → actualizar centro
    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      setCenter({ lat, lng });
    });
  }, []);

  // ── actualizar círculo y marcador cuando cambia centro o radio ────────────
  useEffect(() => {
    if (!mapRef.current || !leafletRef.current || !center) return;
    const L = leafletRef.current;
    const map = mapRef.current;

    // Limpiar anteriores
    if (circleRef.current) circleRef.current.remove();
    if (markerRef.current) markerRef.current.remove();

    const radiusMeters = radiusKm * 1000;

    circleRef.current = L.circle([center.lat, center.lng], {
      radius: radiusMeters,
      color: '#4f46e5',
      fillColor: '#4f46e5',
      fillOpacity: 0.12,
      weight: 2,
    }).addTo(map);

    markerRef.current = L.circleMarker([center.lat, center.lng], {
      radius: 8,
      color: '#4f46e5',
      fillColor: '#4f46e5',
      fillOpacity: 0.9,
      weight: 2,
    }).addTo(map);

    map.setView([center.lat, center.lng], map.getZoom());
  }, [center, radiusKm]);

  // ── localización del usuario ──────────────────────────────────────────────
  const geolocate = () => {
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCenter({ lat, lng });
        if (mapRef.current) {
          mapRef.current.setView([lat, lng], 14);
        }
      },
      () => setError('No se pudo obtener tu ubicación.')
    );
  };

  // ── búsqueda principal ────────────────────────────────────────────────────
  const handleSearch = async (isLoadMore = false) => {
    const searchCenter = isLoadMore ? lastCenter : center;

    if (!searchCenter) {
      setError('Haz clic en el mapa para elegir el área de búsqueda.');
      return;
    }
    if (!keyword.trim()) {
      setError('Escribe qué quieres buscar (ej: iglesia adventista, mall chino…).');
      return;
    }

    const savedSettings = localStorage.getItem('scraper_settings');
    if (!savedSettings) {
      setError("Configura tu SerpApi Key en la pestaña 'Motor API' primero.");
      return;
    }
    const { apiKey }: ScraperSettings = JSON.parse(savedSettings);

    setError(null);
    setIsScraping(true);
    setScrapeStatus(isLoadMore ? 'Cargando más resultados…' : 'Consultando Google Maps por área…');

    if (!isLoadMore) {
      setResults([]);
      setCurrentOffset(0);
      setLastCenter(searchCenter);
      setLastKeyword(keyword.trim());
      setLastRadius(radiusKm);
    }

    const offsetToUse = isLoadMore ? currentOffset + maxLeads : 0;
    const usedCenter = isLoadMore ? lastCenter! : searchCenter;
    const usedKeyword = isLoadMore ? lastKeyword : keyword.trim();

    // Zoom calculado desde el radio: menor radio → mayor zoom
    const zoom = Math.max(10, Math.min(16, Math.round(15 - Math.log2(radiusKm + 0.5))));
    const ll = `@${usedCenter.lat},${usedCenter.lng},${zoom}z`;

    try {
      const res = await fetch('/api/serp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          q: usedKeyword,
          ll,
          num: maxLeads,
          start: offsetToUse,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Error /api/serp (${res.status}): ${txt || 'Sin detalle'}`);
      }

      const data = await res.json();
      const local: any[] = Array.isArray(data?.local_results) ? data.local_results : [];

      if (local.length === 0) {
        throw new Error(
          isLoadMore
            ? 'No hay más resultados para esta área.'
            : 'Sin resultados en esta área. Prueba ampliar el radio o cambia la búsqueda.'
        );
      }

      const normalized: MapSearchResult[] = local.map((r: any) => ({
        _id: uniqueId(),
        name: r?.title || r?.name || '',
        phone: r?.phone || r?.phone_number || '',
        website: r?.website || r?.website_link || '',
        address: r?.address || r?.full_address || '',
        fullAddress: r?.address || r?.full_address || '',
        categoryName: r?.type || r?.category || '',
        stars: r?.rating ?? r?.stars ?? undefined,
        reviewsCount: r?.reviews ?? r?.reviews_count ?? undefined,
        url:
          r?.place_link ||
          r?.links?.place_link ||
          buildGMapsLink(r?.title || r?.name, r?.address || r?.full_address),
      }));

      setResults((prev) => (isLoadMore ? [...prev, ...normalized] : normalized));
      setCurrentOffset(offsetToUse);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsScraping(false);
      setScrapeStatus('');
    }
  };

  const deleteResult = (id: string) => setResults((prev) => prev.filter((r) => r._id !== id));
  const clearAll = () => {
    if (results.length === 0) return;
    if (window.confirm('¿Confirmas limpiar todos los resultados?')) setResults([]);
  };

  const exportCSV = () => {
    if (results.length === 0) return;
    const headers = ['Nombre', 'Teléfono', 'Web', 'Dirección', 'Categoría'];
    const rows = results.map((r) => [
      `"${r.name}"`,
      `"${r.phone || ''}"`,
      `"${r.website || ''}"`,
      `"${r.address || ''}"`,
      `"${r.categoryName || ''}"`,
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map((r) => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `leads_mapa_${Date.now()}.csv`;
    link.click();
  };

  const copyPhone = (phone: string, id: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-fadeIn">

      {/* Encabezado */}
      <div className="space-y-1">
        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-2xl shadow-lg shadow-indigo-200">
            <Target className="w-7 h-7 text-white" />
          </div>
          Búsqueda por <span className="text-indigo-600">Área en Mapa</span>
        </h2>
        <p className="text-slate-500 font-medium text-sm">
          Haz clic en el mapa para marcar el área, ajusta el radio y escribe qué deseas encontrar.
        </p>
      </div>

      {/* Panel de controles + mapa */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Controles ── */}
        <div className="lg:col-span-1 flex flex-col gap-5">

          {/* Qué buscar */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-4">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Search className="w-3.5 h-3.5" /> ¿Qué deseas buscar?
            </p>
            <input
              type="text"
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-semibold text-slate-700 focus:border-indigo-200 focus:bg-white transition"
              placeholder="Ej: iglesia adventista, mall chino, clínica dental…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* Radio */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-4">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Radio de búsqueda
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0.1}
                max={20}
                step={0.1}
                value={radiusKm}
                onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                className="flex-1 accent-indigo-600"
              />
              <span className="text-indigo-600 font-black text-sm w-16 text-right">
                {radiusKm.toFixed(1)} km
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[0.5, 1, 2, 5, 10].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setRadiusKm(v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                    radiusKm === v
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {v} km
                </button>
              ))}
            </div>
          </div>

          {/* Cantidad */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-4">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <PlusCircle className="w-3.5 h-3.5" /> Cantidad por página
            </p>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 20, 30].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMaxLeads(v)}
                  className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${
                    maxLeads === v
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Coordenadas elegidas */}
          {center && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 text-sm">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Punto seleccionado</p>
              <p className="text-slate-700 font-bold">
                {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
              </p>
            </div>
          )}

          {/* Botones de acción */}
          <button
            type="button"
            onClick={geolocate}
            className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-700 py-3 rounded-2xl font-black text-sm hover:bg-slate-200 transition"
          >
            <Navigation className="w-4 h-4" /> Usar mi ubicación
          </button>

          <button
            type="button"
            onClick={() => handleSearch(false)}
            disabled={isScraping || !center || !keyword.trim()}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-5 rounded-2xl font-black text-base hover:bg-indigo-600 shadow-xl disabled:opacity-50 transition-all active:scale-95"
          >
            {isScraping ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
            {isScraping ? scrapeStatus || 'Buscando…' : 'Buscar en esta área'}
          </button>
        </div>

        {/* ── Mapa ── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden" style={{ height: 460 }}>
            {!mapReady && (
              <div className="h-full flex items-center justify-center text-slate-400 gap-3">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="font-bold text-sm">Cargando mapa…</span>
              </div>
            )}
            <div
              ref={mapElRef}
              style={{ height: '100%', width: '100%', display: mapReady ? 'block' : 'none' }}
            />
          </div>
          {!center && mapReady && (
            <p className="text-center text-xs text-slate-400 font-bold mt-3 flex items-center justify-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              Haz clic en el mapa para seleccionar el área de búsqueda
            </p>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-6 bg-rose-50 border-2 border-rose-100 text-rose-700 rounded-3xl flex items-center gap-4">
          <AlertTriangle className="w-8 h-8 shrink-0" />
          <div>
            <p className="font-black text-sm uppercase">Atención</p>
            <p className="text-xs font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Resultados */}
      {results.length > 0 && (
        <div className="space-y-6 animate-slideUp">
          <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              Resultados en área ({results.length})
            </h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 bg-emerald-500 text-white px-5 py-3 rounded-2xl font-black text-sm hover:shadow-lg transition"
              >
                <Download className="w-4 h-4" /> Exportar
              </button>
              <button
                onClick={clearAll}
                className="flex items-center gap-2 bg-rose-50 text-rose-600 border border-rose-200 px-5 py-3 rounded-2xl font-black text-sm hover:bg-rose-100 transition"
              >
                <Trash2 className="w-4 h-4" /> Limpiar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((item) => (
              <div
                key={item._id}
                className="p-7 rounded-[2rem] border-2 border-slate-100 bg-white shadow-sm hover:shadow-xl transition-all flex flex-col h-full relative group"
              >
                {/* Botón eliminar */}
                <button
                  type="button"
                  onClick={() => deleteResult(item._id)}
                  className="absolute top-4 right-4 p-2 bg-rose-50 text-rose-500 hover:text-rose-700 rounded-xl opacity-0 group-hover:opacity-100 transition border border-rose-100"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Categoría + nombre */}
                <div className="mb-4">
                  {item.categoryName && (
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl uppercase tracking-widest">
                      {item.categoryName}
                    </span>
                  )}
                  <h4 className="text-lg font-black text-slate-800 mt-3 leading-tight line-clamp-2">
                    {item.name}
                  </h4>
                  {item.stars && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-amber-700 font-black text-xs">{item.stars}</span>
                      {item.reviewsCount && (
                        <span className="text-slate-400 text-[10px] font-bold">
                          ({item.reviewsCount} reseñas)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Dirección */}
                <div className="space-y-3 text-sm flex-grow">
                  {(item.address || item.fullAddress) && (
                    <div className="flex items-start gap-2 text-slate-500">
                      <MapPin className="w-4 h-4 shrink-0 text-slate-300 mt-0.5" />
                      <span className="text-xs font-medium">{item.address || item.fullAddress}</span>
                    </div>
                  )}

                  {/* Teléfono */}
                  {item.phone && item.phone !== 'No disponible' && (
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-transparent hover:border-indigo-100 hover:bg-white transition-all">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-indigo-500" />
                        <a
                          href={`tel:${item.phone}`}
                          className="text-sm font-black tracking-tight text-slate-800 hover:text-indigo-600 transition-colors"
                        >
                          {item.phone}
                        </a>
                      </div>
                      <button
                        onClick={() => copyPhone(item.phone!, item._id)}
                        className="p-1.5 text-slate-300 hover:text-indigo-500 transition-colors"
                      >
                        {copiedId === item._id ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-5 mt-5 border-t border-slate-50">
                  {item.website ? (
                    <a
                      href={item.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 text-[11px] font-black flex items-center gap-1.5 uppercase hover:underline"
                    >
                      <Globe className="w-4 h-4" /> Visitar Web
                    </a>
                  ) : (
                    <span className="text-slate-300 text-[10px] font-black uppercase">Sin Sitio Web</span>
                  )}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-slate-50 p-2.5 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all hover:bg-indigo-50"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Cargar más */}
          <div className="flex justify-center pt-8 pb-16">
            <button
              onClick={() => handleSearch(true)}
              disabled={isScraping}
              className="group flex flex-col items-center gap-4 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <div className="bg-slate-900 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-200 group-hover:bg-indigo-600 transition-colors">
                {isScraping ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <PlusCircle className="w-8 h-8" />
                )}
              </div>
              <div className="text-center">
                <p className="font-black text-slate-800 uppercase tracking-tighter text-sm">
                  Cargar más resultados
                </p>
                <p className="text-[10px] font-bold text-slate-400 italic">
                  Siguiente página del mismo área
                </p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapSearch;
