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
  Target,
  Navigation,
  SlidersHorizontal,
} from 'lucide-react';
import { BusinessData, ScraperSettings } from '../types';

interface MapSearchResult extends BusinessData {
  _id: string;
  lat?: number;
  lng?: number;
}

const uniqueId = () => Math.random().toString(36).slice(2, 9);

const buildGMapsLink = (name?: string, address?: string) => {
  const q = `${name || ''} ${address || ''}`.trim();
  return q
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
    : 'https://www.google.com/maps';
};

// Icono personalizado indigo para marcadores de resultado
const createResultIcon = (L: any, index: number) => {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        background: #4f46e5;
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(79,70,229,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="transform: rotate(45deg); font-size: 10px; font-weight: 900;">${index + 1}</span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
  });
};

const MapSearch: React.FC = () => {
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const centerMarkerRef = useRef<any>(null);
  const resultMarkersRef = useRef<any[]>([]);
  const mapElRef = useRef<HTMLDivElement>(null);
  const leafletCssRef = useRef<HTMLLinkElement | null>(null);
  const activeCardRef = useRef<HTMLDivElement | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(1);
  const [keyword, setKeyword] = useState<string>('');
  const [maxLeads, setMaxLeads] = useState<number>(20);

  const [isScraping, setIsScraping] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MapSearchResult[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [lastCenter, setLastCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [lastKeyword, setLastKeyword] = useState('');

  // ── Cargar Leaflet ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!leafletCssRef.current) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      leafletCssRef.current = link;
    }

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
      center: [-33.4489, -70.6693],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    setMapReady(true);

    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      setCenter({ lat, lng });
    });
  }, []);

  // ── Círculo + marcador de centro ──────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !leafletRef.current || !center) return;
    const L = leafletRef.current;
    const map = mapRef.current;

    if (circleRef.current) circleRef.current.remove();
    if (centerMarkerRef.current) centerMarkerRef.current.remove();

    circleRef.current = L.circle([center.lat, center.lng], {
      radius: radiusKm * 1000,
      color: '#4f46e5',
      fillColor: '#4f46e5',
      fillOpacity: 0.08,
      weight: 2,
      dashArray: '6 4',
    }).addTo(map);

    const crossIcon = L.divIcon({
      className: '',
      html: `<div style="
        width:16px; height:16px;
        background:#4f46e5;
        border-radius:50%;
        border:3px solid white;
        box-shadow:0 0 0 2px #4f46e5;
      "></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    centerMarkerRef.current = L.marker([center.lat, center.lng], { icon: crossIcon })
      .addTo(map)
      .bindTooltip('Centro de búsqueda', { permanent: false, direction: 'top' });

    map.setView([center.lat, center.lng], map.getZoom());
  }, [center, radiusKm]);

  // ── Renderizar marcadores de resultados en el mapa ────────────────────────
  useEffect(() => {
    if (!mapRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    const map = mapRef.current;

    // Limpiar marcadores anteriores
    resultMarkersRef.current.forEach((m) => m.remove());
    resultMarkersRef.current = [];

    if (results.length === 0) return;

    const bounds: [number, number][] = [];

    results.forEach((item, idx) => {
      // Usar coordenadas si las hay, si no estimar desde el centro + offset
      let lat = item.lat;
      let lng = item.lng;

      if (!lat || !lng) {
        // Sin coordenadas exactas: dispersar aleatoriamente dentro del radio visual
        // para que el marcador sea visible (no se apilan todos en el centro)
        const angle = (idx / results.length) * 2 * Math.PI;
        const spread = (radiusKm * 0.6) / 111.32;
        lat = (lastCenter?.lat ?? center?.lat ?? -33.4489) + spread * Math.sin(angle);
        lng = (lastCenter?.lng ?? center?.lng ?? -70.6693) + spread * Math.cos(angle) / Math.cos(((lastCenter?.lat ?? -33.4489) * Math.PI) / 180);
      }

      bounds.push([lat, lng]);

      const popupContent = `
        <div style="min-width:220px; font-family:system-ui,sans-serif;">
          <div style="background:#4f46e5;color:white;padding:8px 12px;margin:-13px -20px 10px;border-radius:4px 4px 0 0;">
            <span style="font-size:10px;font-weight:900;opacity:0.8;text-transform:uppercase;letter-spacing:1px;">#${idx + 1}</span>
            <div style="font-weight:900;font-size:14px;margin-top:2px;line-height:1.2;">${item.name}</div>
          </div>
          ${item.categoryName ? `<div style="font-size:10px;font-weight:700;color:#6366f1;background:#eef2ff;display:inline-block;padding:2px 8px;border-radius:20px;margin-bottom:8px;text-transform:uppercase;">${item.categoryName}</div>` : ''}
          ${item.stars ? `<div style="font-size:11px;color:#b45309;font-weight:700;margin-bottom:6px;">⭐ ${item.stars}${item.reviewsCount ? ` (${item.reviewsCount} reseñas)` : ''}</div>` : ''}
          ${item.address ? `<div style="font-size:11px;color:#64748b;margin-bottom:6px;display:flex;gap:4px;"><span>📍</span><span>${item.address}</span></div>` : ''}
          ${item.phone && item.phone !== 'No disponible' ? `<div style="font-size:12px;font-weight:800;color:#1e293b;margin-bottom:8px;">📞 ${item.phone}</div>` : ''}
          <div style="display:flex;gap:6px;margin-top:10px;border-top:1px solid #f1f5f9;padding-top:8px;">
            ${item.website ? `<a href="${item.website}" target="_blank" style="flex:1;text-align:center;background:#eef2ff;color:#4f46e5;padding:5px 8px;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none;">🌐 Web</a>` : ''}
            <a href="${item.url}" target="_blank" style="flex:1;text-align:center;background:#f8fafc;color:#475569;padding:5px 8px;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none;">📍 Maps</a>
          </div>
        </div>
      `;

      const icon = createResultIcon(L, idx);
      const marker = L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup(popupContent, { maxWidth: 260 });

      // Al abrir popup → resaltar card
      marker.on('popupopen', () => {
        setActiveId(item._id);
        // scroll suave a la card
        setTimeout(() => {
          const card = document.getElementById(`card-${item._id}`);
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      });

      marker.on('popupclose', () => {
        setActiveId(null);
      });

      resultMarkersRef.current.push(marker);
    });

    // Ajustar vista para mostrar todos los marcadores
    if (bounds.length > 0) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      } catch (_) {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  // ── Geolocalización ───────────────────────────────────────────────────────
  const geolocate = () => {
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCenter({ lat, lng });
        if (mapRef.current) mapRef.current.setView([lat, lng], 14);
      },
      () => setError('No se pudo obtener tu ubicación.')
    );
  };

  // ── Hacer clic en card → abrir popup del marcador ─────────────────────────
  const focusMarker = (id: string) => {
    const idx = results.findIndex((r) => r._id === id);
    if (idx === -1) return;
    const marker = resultMarkersRef.current[idx];
    if (marker && mapRef.current) {
      mapRef.current.setView(marker.getLatLng(), 16, { animate: true });
      marker.openPopup();
    }
    setActiveId(id);
  };

  // ── Búsqueda ──────────────────────────────────────────────────────────────
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
      setActiveId(null);
      setCurrentOffset(0);
      setLastCenter(searchCenter);
      setLastKeyword(keyword.trim());
    }

    const offsetToUse = isLoadMore ? currentOffset + maxLeads : 0;
    const usedCenter = isLoadMore ? lastCenter! : searchCenter;
    const usedKeyword = isLoadMore ? lastKeyword : keyword.trim();
    const zoom = Math.max(10, Math.min(16, Math.round(15 - Math.log2(radiusKm + 0.5))));
    const ll = `@${usedCenter.lat},${usedCenter.lng},${zoom}z`;

    try {
      const res = await fetch('/api/serp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, q: usedKeyword, ll, num: maxLeads, start: offsetToUse }),
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
        url: r?.place_link || r?.links?.place_link || buildGMapsLink(r?.title || r?.name, r?.address || r?.full_address),
        // SerpApi a veces devuelve gps_coordinates
        lat: r?.gps_coordinates?.latitude ?? r?.latitude ?? undefined,
        lng: r?.gps_coordinates?.longitude ?? r?.longitude ?? undefined,
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

  const deleteResult = (id: string) => {
    const idx = results.findIndex((r) => r._id === id);
    if (idx !== -1 && resultMarkersRef.current[idx]) {
      resultMarkersRef.current[idx].remove();
      resultMarkersRef.current.splice(idx, 1);
    }
    setResults((prev) => prev.filter((r) => r._id !== id));
    if (activeId === id) setActiveId(null);
  };

  const clearAll = () => {
    if (results.length === 0) return;
    if (window.confirm('¿Confirmas limpiar todos los resultados?')) {
      resultMarkersRef.current.forEach((m) => m.remove());
      resultMarkersRef.current = [];
      setResults([]);
      setActiveId(null);
    }
  };

  const exportCSV = () => {
    if (results.length === 0) return;
    const headers = ['Nombre', 'Teléfono', 'Web', 'Dirección', 'Categoría'];
    const rows = results.map((r) => [
      `"${r.name}"`, `"${r.phone || ''}"`, `"${r.website || ''}"`,
      `"${r.address || ''}"`, `"${r.categoryName || ''}"`,
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

  // ── Render ────────────────────────────────────────────────────────────────
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
          Los resultados aparecen como marcadores — tócalos para ver la info.
        </p>
      </div>

      {/* Controles + Mapa */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Controles */}
        <div className="lg:col-span-1 flex flex-col gap-5">

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

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-4">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Radio de búsqueda
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range" min={0.1} max={20} step={0.1} value={radiusKm}
                onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                className="flex-1 accent-indigo-600"
              />
              <span className="text-indigo-600 font-black text-sm w-16 text-right">
                {radiusKm.toFixed(1)} km
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[0.5, 1, 2, 5, 10].map((v) => (
                <button key={v} type="button" onClick={() => setRadiusKm(v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${radiusKm === v ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {v} km
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-4">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <PlusCircle className="w-3.5 h-3.5" /> Cantidad por página
            </p>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 20, 30].map((v) => (
                <button key={v} type="button" onClick={() => setMaxLeads(v)}
                  className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${maxLeads === v ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {center && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 text-sm">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Punto seleccionado</p>
              <p className="text-slate-700 font-bold">{center.lat.toFixed(5)}, {center.lng.toFixed(5)}</p>
            </div>
          )}

          <button type="button" onClick={geolocate}
            className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-700 py-3 rounded-2xl font-black text-sm hover:bg-slate-200 transition">
            <Navigation className="w-4 h-4" /> Usar mi ubicación
          </button>

          <button type="button" onClick={() => handleSearch(false)}
            disabled={isScraping || !center || !keyword.trim()}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-5 rounded-2xl font-black text-base hover:bg-indigo-600 shadow-xl disabled:opacity-50 transition-all active:scale-95">
            {isScraping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            {isScraping ? scrapeStatus || 'Buscando…' : 'Buscar en esta área'}
          </button>
        </div>

        {/* Mapa */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden" style={{ height: 500 }}>
            {!mapReady && (
              <div className="h-full flex items-center justify-center text-slate-400 gap-3">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="font-bold text-sm">Cargando mapa…</span>
              </div>
            )}
            <div ref={mapElRef} style={{ height: '100%', width: '100%', display: mapReady ? 'block' : 'none' }} />
          </div>
          {!center && mapReady && (
            <p className="text-center text-xs text-slate-400 font-bold mt-3 flex items-center justify-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              Haz clic en el mapa para seleccionar el área de búsqueda
            </p>
          )}
          {results.length > 0 && (
            <p className="text-center text-xs text-emerald-600 font-bold mt-3 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {results.length} marcadores en el mapa — toca uno para ver la info
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
              <button onClick={exportCSV}
                className="flex items-center gap-2 bg-emerald-500 text-white px-5 py-3 rounded-2xl font-black text-sm hover:shadow-lg transition">
                <Download className="w-4 h-4" /> Exportar
              </button>
              <button onClick={clearAll}
                className="flex items-center gap-2 bg-rose-50 text-rose-600 border border-rose-200 px-5 py-3 rounded-2xl font-black text-sm hover:bg-rose-100 transition">
                <Trash2 className="w-4 h-4" /> Limpiar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((item, idx) => (
              <div
                id={`card-${item._id}`}
                key={item._id}
                onClick={() => focusMarker(item._id)}
                className={`p-7 rounded-[2rem] border-2 bg-white transition-all flex flex-col h-full relative group cursor-pointer ${
                  activeId === item._id
                    ? 'border-indigo-500 shadow-2xl shadow-indigo-100 ring-4 ring-indigo-50 scale-[1.02]'
                    : 'border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-200'
                }`}
              >
                {/* Número */}
                <div className="absolute top-4 left-4 w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-black shadow">
                  {idx + 1}
                </div>

                {/* Botón eliminar */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); deleteResult(item._id); }}
                  className="absolute top-4 right-4 p-2 bg-rose-50 text-rose-500 hover:text-rose-700 rounded-xl opacity-0 group-hover:opacity-100 transition border border-rose-100"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Contenido */}
                <div className="mb-4 mt-4">
                  {item.categoryName && (
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl uppercase tracking-widest">
                      {item.categoryName}
                    </span>
                  )}
                  <h4 className="text-lg font-black text-slate-800 mt-3 leading-tight line-clamp-2">{item.name}</h4>
                  {item.stars && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-amber-700 font-black text-xs">{item.stars}</span>
                      {item.reviewsCount && <span className="text-slate-400 text-[10px] font-bold">({item.reviewsCount} reseñas)</span>}
                    </div>
                  )}
                </div>

                <div className="space-y-3 text-sm flex-grow">
                  {(item.address || item.fullAddress) && (
                    <div className="flex items-start gap-2 text-slate-500">
                      <MapPin className="w-4 h-4 shrink-0 text-slate-300 mt-0.5" />
                      <span className="text-xs font-medium">{item.address || item.fullAddress}</span>
                    </div>
                  )}
                  {item.phone && item.phone !== 'No disponible' && (
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-transparent hover:border-indigo-100 hover:bg-white transition-all">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-indigo-500" />
                        <a href={`tel:${item.phone}`} onClick={(e) => e.stopPropagation()}
                          className="text-sm font-black tracking-tight text-slate-800 hover:text-indigo-600 transition-colors">
                          {item.phone}
                        </a>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); copyPhone(item.phone!, item._id); }}
                        className="p-1.5 text-slate-300 hover:text-indigo-500 transition-colors">
                        {copiedId === item._id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-5 mt-5 border-t border-slate-50">
                  {item.website ? (
                    <a href={item.website} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-indigo-600 text-[11px] font-black flex items-center gap-1.5 uppercase hover:underline">
                      <Globe className="w-4 h-4" /> Visitar Web
                    </a>
                  ) : (
                    <span className="text-slate-300 text-[10px] font-black uppercase">Sin Sitio Web</span>
                  )}
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="bg-slate-50 p-2.5 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all hover:bg-indigo-50">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                {/* Hint de interacción */}
                <p className="text-center text-[10px] text-indigo-400 font-bold mt-3 opacity-0 group-hover:opacity-100 transition">
                  Clic para ver en el mapa →
                </p>
              </div>
            ))}
          </div>

          {/* Cargar más */}
          <div className="flex justify-center pt-8 pb-16">
            <button onClick={() => handleSearch(true)} disabled={isScraping}
              className="group flex flex-col items-center gap-4 transition-all hover:scale-105 active:scale-95 disabled:opacity-50">
              <div className="bg-slate-900 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-200 group-hover:bg-indigo-600 transition-colors">
                {isScraping ? <Loader2 className="w-6 h-6 animate-spin" /> : <PlusCircle className="w-8 h-8" />}
              </div>
              <div className="text-center">
                <p className="font-black text-slate-800 uppercase tracking-tighter text-sm">Cargar más resultados</p>
                <p className="text-[10px] font-bold text-slate-400 italic">Siguiente página del mismo área</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapSearch;
