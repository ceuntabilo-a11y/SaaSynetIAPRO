import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin, Search, Loader2, Phone, Globe, ExternalLink,
  AlertTriangle, CheckCircle2, Star, X, Copy, Check,
  Download, Trash2, PlusCircle, Target, Navigation,
  SlidersHorizontal, BrainCircuit, Mail, Sparkles, FolderOpen, Save,
  ChevronLeft, ChevronRight, Mic, MicOff, Route,
  Filter, FileText, Map, Briefcase, Circle,
} from 'lucide-react';
import { BusinessData, ScraperSettings } from '../types';
import { enrichLeadsWithAI } from '../lib/ai';
import EmailModal from './EmailModal';
import SessionManager, { Session, SessionLead, loadSessions, saveSessions } from './SessionManager';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type VisitStatus = 'nuevo' | 'contactado' | 'interesado' | 'cerrado' | 'rechazado';

interface CRMEntry {
  status: VisitStatus;
  note: string;
  updatedAt: number;
}

interface MapSearchResult extends BusinessData {
  _id: string;
  lat?: number;
  lng?: number;
  crm?: CRMEntry;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uniqueId = () => Math.random().toString(36).slice(2, 9);

const buildGMapsLink = (name?: string, address?: string) => {
  const q = `${name || ''} ${address || ''}`.trim();
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : 'https://www.google.com/maps';
};

const buildNavLink = (name?: string, address?: string, lat?: number, lng?: number) => {
  if (lat && lng) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const q = `${name || ''} ${address || ''}`.trim();
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
};

const CRM_STORAGE_KEY = 'saasynet_crm_v1';

const loadCRM = (): Record<string, CRMEntry> => {
  try { return JSON.parse(localStorage.getItem(CRM_STORAGE_KEY) || '{}'); } catch { return {}; }
};

const saveCRM = (data: Record<string, CRMEntry>) => {
  localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify(data));
};

const STATUS_CONFIG: Record<VisitStatus, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  nuevo:       { label: 'Nuevo',       color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', emoji: '🔵' },
  contactado:  { label: 'Contactado',  color: '#eab308', bg: '#fefce8', border: '#fef08a', emoji: '🟡' },
  interesado:  { label: 'Interesado',  color: '#f97316', bg: '#fff7ed', border: '#fed7aa', emoji: '🟠' },
  cerrado:     { label: 'Cerrado',     color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', emoji: '🟢' },
  rechazado:   { label: 'Rechazado',   color: '#ef4444', bg: '#fef2f2', border: '#fecaca', emoji: '🔴' },
};

const STATUSES: VisitStatus[] = ['nuevo', 'contactado', 'interesado', 'cerrado', 'rechazado'];

const scoreColor = (score?: string) => {
  if (score === 'Premium') return '#7c3aed';
  if (score === 'Estándar') return '#0891b2';
  return '#64748b';
};

const createResultIcon = (index: number, status: VisitStatus) => {
  const color = STATUS_CONFIG[status].color;
  const L = (window as any).L;
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};color:white;width:30px;height:30px;
      border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      border:2px solid white;box-shadow:0 2px 10px ${color}88;
      display:flex;align-items:center;justify-content:center;
    "><span style="transform:rotate(45deg);font-size:10px;font-weight:900;">${index + 1}</span></div>`,
    iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -32],
  });
};

// ─── Componente Modal Modo Campo ──────────────────────────────────────────────
interface FieldModeProps {
  leads: MapSearchResult[];
  initialIndex: number;
  onClose: () => void;
  onUpdateCRM: (id: string, entry: CRMEntry) => void;
}

const FieldMode: React.FC<FieldModeProps> = ({ leads, initialIndex, onClose, onUpdateCRM }) => {
  const [idx, setIdx] = useState(initialIndex);
  const [status, setStatus] = useState<VisitStatus>(leads[initialIndex]?.crm?.status || 'nuevo');
  const [note, setNote] = useState(leads[initialIndex]?.crm?.note || '');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  const lead = leads[idx];

  useEffect(() => {
    setStatus(lead?.crm?.status || 'nuevo');
    setNote(lead?.crm?.note || '');
    setTranscript('');
  }, [idx]);

  const save = (s: VisitStatus, n: string) => {
    onUpdateCRM(lead._id, { status: s, note: n, updatedAt: Date.now() });
  };

  const handleStatus = (s: VisitStatus) => {
    setStatus(s);
    save(s, note);
  };

  const handleNote = (n: string) => {
    setNote(n);
    save(status, n);
  };

  const prev = () => { if (idx > 0) setIdx(idx - 1); };
  const next = () => { if (idx < leads.length - 1) setIdx(idx + 1); };

  // Notas de voz
  const toggleRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Tu navegador no soporta notas de voz.'); return; }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'es-ES';
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
      const newNote = note ? `${note}\n[Voz] ${text}` : `[Voz] ${text}`;
      handleNote(newNote);
    };
    rec.onend = () => setIsRecording(false);
    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  };

  const cfg = STATUS_CONFIG[status];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col" style={{ touchAction: 'pan-y' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-slate-700">
        <button onClick={onClose} className="text-slate-400 hover:text-white transition">
          <X className="w-6 h-6" />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modo Campo</p>
          <p className="text-white font-black text-sm">{idx + 1} / {leads.length}</p>
        </div>
        <div className="w-6" />
      </div>

      {/* Progreso */}
      <div className="h-1 bg-slate-700">
        <div className="h-full bg-indigo-500 transition-all" style={{ width: `${((idx + 1) / leads.length) * 100}%` }} />
      </div>

      {/* Contenido principal */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">

        {/* Nombre y categoría */}
        <div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-sm shrink-0">
              {idx + 1}
            </div>
            <div>
              {lead.categoryName && (
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{lead.categoryName}</span>
              )}
              <h2 className="text-white font-black text-2xl leading-tight">{lead.name}</h2>
              {lead.stars && (
                <p className="text-amber-400 text-sm font-bold mt-1">⭐ {lead.stars} {lead.reviewsCount ? `(${lead.reviewsCount})` : ''}</p>
              )}
            </div>
          </div>
        </div>

        {/* Dirección */}
        {lead.address && (
          <div className="bg-slate-800 rounded-2xl p-4 flex items-start gap-3">
            <MapPin className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-slate-200 text-sm font-medium">{lead.address}</p>
          </div>
        )}

        {/* Acciones rápidas */}
        <div className="grid grid-cols-2 gap-3">
          {lead.phone && lead.phone !== 'No disponible' && (
            <a href={`tel:${lead.phone}`}
              className="flex items-center justify-center gap-2 bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-emerald-500 transition active:scale-95">
              <Phone className="w-5 h-5" /> Llamar
            </a>
          )}
          <a href={buildNavLink(lead.name, lead.address, lead.lat, lead.lng)}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-blue-500 transition active:scale-95">
            <Navigation className="w-5 h-5" /> Navegar
          </a>
          {lead.website && (
            <a href={lead.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-slate-700 text-white py-4 rounded-2xl font-black text-sm hover:bg-slate-600 transition active:scale-95">
              <Globe className="w-5 h-5" /> Web
            </a>
          )}
          {lead.email && (
            <div className="flex items-center justify-center gap-2 bg-slate-700 text-indigo-300 py-4 rounded-2xl font-black text-xs">
              <Mail className="w-4 h-4" /> {lead.email}
            </div>
          )}
        </div>

        {/* Resumen IA */}
        {lead.aiSummary && (
          <div className="bg-violet-900/40 border border-violet-700/40 rounded-2xl p-4">
            <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Análisis IA
            </p>
            <p className="text-violet-200 text-sm leading-relaxed">{lead.aiSummary}</p>
          </div>
        )}

        {/* Estado CRM */}
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Estado de visita</p>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => {
              const c = STATUS_CONFIG[s];
              return (
                <button key={s} onClick={() => handleStatus(s)}
                  className="px-4 py-2 rounded-xl text-xs font-black transition-all border-2"
                  style={{
                    background: status === s ? c.color : 'transparent',
                    color: status === s ? 'white' : c.color,
                    borderColor: c.color,
                  }}>
                  {c.emoji} {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nota de texto */}
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nota</p>
          <textarea
            value={note}
            onChange={(e) => handleNote(e.target.value)}
            placeholder="Escribe una nota sobre esta visita…"
            rows={3}
            className="w-full bg-slate-800 border border-slate-600 rounded-2xl p-4 text-slate-200 text-sm resize-none outline-none focus:border-indigo-500 transition"
          />
        </div>

        {/* Nota de voz */}
        <div>
          <button onClick={toggleRecording}
            className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-sm transition-all active:scale-95 ${
              isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
            }`}>
            {isRecording ? <><MicOff className="w-5 h-5" /> Detener grabación</> : <><Mic className="w-5 h-5" /> Grabar nota de voz</>}
          </button>
          {transcript && (
            <p className="mt-2 text-xs text-slate-400 bg-slate-800 p-3 rounded-xl">
              <span className="text-indigo-400 font-bold">Transcripción: </span>{transcript}
            </p>
          )}
        </div>
      </div>

      {/* Navegación inferior */}
      <div className="px-5 pb-8 pt-4 border-t border-slate-700 flex items-center justify-between gap-4">
        <button onClick={prev} disabled={idx === 0}
          className="flex items-center gap-2 bg-slate-700 text-white px-6 py-4 rounded-2xl font-black text-sm disabled:opacity-30 hover:bg-slate-600 transition active:scale-95">
          <ChevronLeft className="w-5 h-5" /> Anterior
        </button>
        <div className="flex-1 text-center">
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: cfg.color }}>
            {cfg.emoji} {cfg.label}
          </span>
        </div>
        <button onClick={next} disabled={idx === leads.length - 1}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black text-sm disabled:opacity-30 hover:bg-indigo-500 transition active:scale-95">
          Siguiente <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// ─── Componente principal MapSearch ──────────────────────────────────────────
const MapSearch: React.FC = () => {
  const mapRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const centerMarkerRef = useRef<any>(null);
  const resultMarkersRef = useRef<any[]>([]);
  const mapElRef = useRef<HTMLDivElement>(null);

  const [mapReady, setMapReady] = useState(false);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [maxLeads, setMaxLeads] = useState(20);
  const [isScraping, setIsScraping] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MapSearchResult[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [lastCenter, setLastCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [lastKeyword, setLastKeyword] = useState('');
  const [emailModalLead, setEmailModalLead] = useState<BusinessData | null>(null);
  const [showSessionManager, setShowSessionManager] = useState(false);
  const [crmData, setCrmData] = useState<Record<string, CRMEntry>>(loadCRM);

  // Modo Campo
  const [fieldMode, setFieldMode] = useState(false);
  const [fieldIndex, setFieldIndex] = useState(0);

  // Filtros
  const [showFilters, setShowFilters] = useState(false);
  const [filterPhone, setFilterPhone] = useState(false);
  const [filterWeb, setFilterWeb] = useState(false);
  const [filterNoWeb, setFilterNoWeb] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterScore, setFilterScore] = useState<string>('todos');
  const [filterStars, setFilterStars] = useState(0);
  const [filterCategory, setFilterCategory] = useState('todos');
  const [filterStatus, setFilterStatus] = useState<VisitStatus | 'todos'>('todos');

  // Resultados con CRM aplicado
  const resultsWithCRM: MapSearchResult[] = results.map(r => ({
    ...r,
    crm: crmData[r._id] || r.crm,
  }));

  // Filtrado
  const categories = ['todos', ...Array.from(new Set(results.map(r => r.categoryName).filter(Boolean))) as string[]];

  const filteredResults = resultsWithCRM.filter(r => {
    if (filterPhone && !r.phone) return false;
    if (filterWeb && !r.website) return false;
    if (filterNoWeb && r.website) return false;
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      const match = [r.name, r.address, r.categoryName, r.phone, r.email]
        .filter(Boolean).join(' ').toLowerCase();
      if (!match.includes(q)) return false;
    }
    if (filterScore !== 'todos' && r.aiScore !== filterScore) return false;
    if (filterStars > 0 && parseFloat(String(r.stars || 0)) < filterStars) return false;
    if (filterCategory !== 'todos' && r.categoryName !== filterCategory) return false;
    if (filterStatus !== 'todos' && (r.crm?.status || 'nuevo') !== filterStatus) return false;
    return true;
  });

  // ── CRM helpers ──────────────────────────────────────────────────────────
  const updateCRM = (id: string, entry: CRMEntry) => {
    const updated = { ...crmData, [id]: entry };
    setCrmData(updated);
    saveCRM(updated);
    setResults(prev => prev.map(r => r._id === id ? { ...r, crm: entry } : r));
  };

  // ── Inicializar mapa ────────────────────────────────────────────────────
  useEffect(() => {
    const loadMap = () => {
      if (!mapElRef.current || mapRef.current) return;
      const L = (window as any).L;
      if (!L) return;

      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const map = L.map(mapElRef.current, { center: [-33.4489, -70.6693], zoom: 13 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19,
      }).addTo(map);
      map.on('click', (e: any) => setCenter({ lat: e.latlng.lat, lng: e.latlng.lng }));
      mapRef.current = map;
      setMapReady(true);

      const observer = new ResizeObserver(() => map.invalidateSize());
      if (mapElRef.current) observer.observe(mapElRef.current);
      setTimeout(() => map.invalidateSize(), 100);
      setTimeout(() => map.invalidateSize(), 600);
      setTimeout(() => map.invalidateSize(), 1500);

      return () => { observer.disconnect(); map.remove(); mapRef.current = null; };
    };

    if ((window as any).L) { loadMap(); }
    else {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = loadMap;
      document.body.appendChild(script);
    }
  }, []);

  // ── Círculo de área ─────────────────────────────────────────────────────
  useEffect(() => {
    const L = (window as any).L;
    if (!mapRef.current || !L || !center) return;
    const map = mapRef.current;
    circleRef.current?.remove();
    centerMarkerRef.current?.remove();
    circleRef.current = L.circle([center.lat, center.lng], {
      radius: radiusKm * 1000, color: '#4f46e5', fillColor: '#4f46e5',
      fillOpacity: 0.08, weight: 2, dashArray: '6 4',
    }).addTo(map);
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;background:#4f46e5;border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px #4f46e5;"></div>`,
      iconSize: [14, 14], iconAnchor: [7, 7],
    });
    centerMarkerRef.current = L.marker([center.lat, center.lng], { icon })
      .addTo(map).bindTooltip('Centro de búsqueda', { direction: 'top' });
    map.setView([center.lat, center.lng], map.getZoom());
  }, [center, radiusKm]);

  // ── Marcadores en mapa ──────────────────────────────────────────────────
  const renderMarkers = useCallback((items: MapSearchResult[]) => {
    const L = (window as any).L;
    if (!mapRef.current || !L) return;
    const map = mapRef.current;
    resultMarkersRef.current.forEach(m => m.remove());
    resultMarkersRef.current = [];
    if (items.length === 0) return;
    const bounds: [number, number][] = [];

    items.forEach((item, idx) => {
      let lat = item.lat, lng = item.lng;
      if (!lat || !lng) {
        const angle = (idx / items.length) * 2 * Math.PI;
        const spread = (radiusKm * 0.55) / 111.32;
        const baseLat = lastCenter?.lat ?? center?.lat ?? -33.4489;
        const baseLng = lastCenter?.lng ?? center?.lng ?? -70.6693;
        lat = baseLat + spread * Math.sin(angle);
        lng = baseLng + spread * Math.cos(angle) / Math.cos((baseLat * Math.PI) / 180);
      }
      bounds.push([lat, lng]);

      const status = (crmData[item._id]?.status || item.crm?.status || 'nuevo') as VisitStatus;
      const icon = createResultIcon(idx, status);
      const cfg = STATUS_CONFIG[status];

      const popupContent = `
        <div style="min-width:220px;font-family:system-ui,sans-serif;">
          <div style="background:#4f46e5;color:white;padding:8px 12px;margin:-13px -20px 10px;border-radius:4px 4px 0 0;">
            <div style="font-weight:900;font-size:14px;line-height:1.2;">${item.name}</div>
            <div style="font-size:10px;opacity:0.8;margin-top:2px;">#${idx + 1}</div>
          </div>
          <div style="display:inline-block;background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.border};font-size:10px;font-weight:900;padding:2px 8px;border-radius:20px;margin-bottom:6px;text-transform:uppercase;">${cfg.emoji} ${cfg.label}</div>
          ${item.categoryName ? `<div style="font-size:10px;color:#6366f1;font-weight:700;margin-bottom:4px;">${item.categoryName}</div>` : ''}
          ${item.stars ? `<div style="font-size:11px;color:#b45309;font-weight:700;margin-bottom:4px;">⭐ ${item.stars}</div>` : ''}
          ${item.address ? `<div style="font-size:11px;color:#64748b;margin-bottom:4px;">📍 ${item.address}</div>` : ''}
          ${item.phone && item.phone !== 'No disponible' ? `<div style="font-size:12px;font-weight:800;color:#1e293b;margin-bottom:4px;">📞 ${item.phone}</div>` : ''}
          ${item.aiSummary ? `<div style="font-size:11px;color:#475569;background:#f8fafc;padding:5px 7px;border-radius:6px;margin:5px 0;">${item.aiSummary}</div>` : ''}
          <div style="display:flex;gap:6px;margin-top:8px;border-top:1px solid #f1f5f9;padding-top:8px;">
            <a href="${buildNavLink(item.name, item.address, item.lat, item.lng)}" target="_blank" style="flex:1;text-align:center;background:#dbeafe;color:#2563eb;padding:5px 8px;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none;">🧭 Navegar</a>
            ${item.phone && item.phone !== 'No disponible' ? `<a href="tel:${item.phone}" style="flex:1;text-align:center;background:#dcfce7;color:#16a34a;padding:5px 8px;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none;">📞 Llamar</a>` : ''}
            ${item.website ? `<a href="${item.website}" target="_blank" style="flex:1;text-align:center;background:#eef2ff;color:#4f46e5;padding:5px 8px;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none;">🌐 Web</a>` : ''}
          </div>
        </div>`;

      const marker = L.marker([lat, lng], { icon })
        .addTo(map).bindPopup(popupContent, { maxWidth: 280 });

      marker.on('popupopen', () => {
        setActiveId(item._id);
        setTimeout(() => {
          document.getElementById(`card-${item._id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      });
      marker.on('popupclose', () => setActiveId(null));
      resultMarkersRef.current.push(marker);
    });

    if (bounds.length > 0) {
      try { map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 }); } catch (_) {}
    }
  }, [radiusKm, center, lastCenter, crmData]);

  useEffect(() => { renderMarkers(resultsWithCRM); }, [results, crmData]);

  // ── Ruta optimizada en Google Maps ──────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredResults.map(r => r._id)));
  const clearSelection = () => setSelectedIds(new Set());

  const routeLeads = selectedIds.size > 0
    ? filteredResults.filter(r => selectedIds.has(r._id))
    : filteredResults;

  const openOptimizedRoute = () => {
    const leadsWithCoords = routeLeads.filter(r => r.lat && r.lng);
    if (leadsWithCoords.length < 2) {
      alert('Necesitas al menos 2 leads con coordenadas para trazar una ruta. Prueba enriqueciendo con IA primero.');
      return;
    }
    const waypoints = leadsWithCoords.slice(1, -1).map(r => `${r.lat},${r.lng}`).join('|');
    const origin = `${leadsWithCoords[0].lat},${leadsWithCoords[0].lng}`;
    const destination = `${leadsWithCoords[leadsWithCoords.length - 1].lat},${leadsWithCoords[leadsWithCoords.length - 1].lng}`;
    const url = waypoints
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    window.open(url, '_blank');
  };

  // ── Exportar PDF ────────────────────────────────────────────────────────
  const exportPDF = () => {
    const items = filteredResults;
    if (items.length === 0) return;

    const rows = items.map((r, i) => {
      const cfg = STATUS_CONFIG[r.crm?.status || 'nuevo'];
      return `
        <tr style="border-bottom:1px solid #e2e8f0;${i % 2 === 0 ? 'background:#f8fafc;' : ''}">
          <td style="padding:10px 8px;font-weight:900;color:#1e293b;vertical-align:top;">
            <span style="background:#4f46e5;color:white;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;margin-right:6px;">${i + 1}</span>
            ${r.name}
            ${r.aiScore ? `<br><span style="font-size:9px;color:${scoreColor(r.aiScore)};font-weight:700;">${r.aiScore}</span>` : ''}
          </td>
          <td style="padding:10px 8px;color:#475569;font-size:12px;vertical-align:top;">${r.address || r.fullAddress || '—'}</td>
          <td style="padding:10px 8px;color:#1e293b;font-weight:700;font-size:12px;vertical-align:top;">${r.phone || '—'}</td>
          <td style="padding:10px 8px;font-size:11px;vertical-align:top;">
            <span style="background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.border};padding:2px 7px;border-radius:20px;font-weight:900;font-size:10px;">${cfg.emoji} ${cfg.label}</span>
            ${r.crm?.note ? `<div style="margin-top:4px;color:#64748b;font-size:10px;">${r.crm.note}</div>` : ''}
          </td>
          <td style="padding:10px 8px;width:120px;border-left:1px solid #e2e8f0;vertical-align:top;">
            <div style="height:50px;border-bottom:1px dashed #cbd5e1;"></div>
          </td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Ruta de Visitas - SaaSynetIA</title>
      <style>
        body{font-family:system-ui,sans-serif;margin:0;padding:20px;color:#1e293b;}
        h1{color:#4f46e5;font-size:22px;margin-bottom:4px;}
        .meta{color:#64748b;font-size:12px;margin-bottom:20px;}
        table{width:100%;border-collapse:collapse;font-size:12px;}
        th{background:#4f46e5;color:white;padding:10px 8px;text-align:left;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.5px;}
        @media print{body{padding:10px;}button{display:none;}}
      </style>
    </head><body>
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <div>
          <h1>🗺 Ruta de Visitas</h1>
          <div class="meta">Generado: ${new Date().toLocaleDateString('es-CL', { day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit' })} · ${items.length} establecimientos · Búsqueda: "${lastKeyword || keyword}"</div>
        </div>
        <button onclick="window.print()" style="background:#4f46e5;color:white;border:none;padding:10px 20px;border-radius:12px;font-weight:900;cursor:pointer;font-size:13px;">🖨 Imprimir</button>
      </div>
      <table>
        <thead><tr>
          <th style="width:25%">Establecimiento</th>
          <th style="width:28%">Dirección</th>
          <th style="width:15%">Teléfono</th>
          <th style="width:17%">Estado / Nota</th>
          <th style="width:15%">Notas de visita</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:30px;padding-top:15px;border-top:2px solid #e2e8f0;color:#94a3b8;font-size:10px;text-align:center;">
        Generado por SaaSynetIA · saa-synet-iapro.vercel.app
      </div>
    </body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  // ── Geolocalización ─────────────────────────────────────────────────────
  const geolocate = () => {
    if (!navigator.geolocation) { setError('Tu navegador no soporta geolocalización.'); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        setCenter({ lat, lng });
        mapRef.current?.setView([lat, lng], 14);
      },
      () => setError('No se pudo obtener tu ubicación.')
    );
  };

  // ── Focus marcador desde card ───────────────────────────────────────────
  const focusMarker = (id: string) => {
    const idx = filteredResults.findIndex(r => r._id === id);
    if (idx === -1) return;
    const marker = resultMarkersRef.current[results.findIndex(r => r._id === id)];
    if (marker && mapRef.current) {
      mapRef.current.setView(marker.getLatLng(), 16, { animate: true });
      marker.openPopup();
    }
    setActiveId(id);
  };

  // ── Cargar sesión ──────────────────────────────────────────────────────────
  const handleLoadSession = (leads: SessionLead[]) => {
    const mapped = leads.map(l => ({ ...l } as MapSearchResult));
    setResults(mapped);
    setActiveId(null);
    setSelectedIds(new Set());
  };

  // ── Enriquecer con IA ───────────────────────────────────────────────────
  const handleAIEnrichment = async () => {
    setIsEnriching(true);
    setScrapeStatus('IA analizando prospectos…');
    try {
      const enriched = await enrichLeadsWithAI(results as BusinessData[]);
      const withIds = enriched.map((e, i) => ({ ...e, _id: results[i]?._id || uniqueId() })) as MapSearchResult[];
      setResults(withIds);
    } catch (err) { console.error(err); }
    finally { setIsEnriching(false); setScrapeStatus(''); }
  };

  // ── Búsqueda ────────────────────────────────────────────────────────────
  const handleSearch = async (isLoadMore = false) => {
    const searchCenter = isLoadMore ? lastCenter : center;
    if (!searchCenter) { setError('Haz clic en el mapa para elegir el área.'); return; }
    if (!keyword.trim()) { setError('Escribe qué quieres buscar.'); return; }
    const savedSettings = localStorage.getItem('scraper_settings');
    if (!savedSettings) { setError("Configura tu SerpApi Key en 'Motor API' primero."); return; }
    const { apiKey }: ScraperSettings = JSON.parse(savedSettings);

    setError(null);
    setIsScraping(true);
    setScrapeStatus(isLoadMore ? 'Cargando más…' : 'Consultando Google Maps…');
    if (!isLoadMore) {
      setResults([]); setActiveId(null); setCurrentOffset(0);
      setLastCenter(searchCenter); setLastKeyword(keyword.trim());
    }

    const offsetToUse = isLoadMore ? currentOffset + maxLeads : 0;
    const usedCenter = isLoadMore ? lastCenter! : searchCenter;
    const usedKeyword = isLoadMore ? lastKeyword : keyword.trim();
    const zoom = Math.max(10, Math.min(16, Math.round(15 - Math.log2(radiusKm + 0.5))));
    const ll = `@${usedCenter.lat},${usedCenter.lng},${zoom}z`;

    try {
      const res = await fetch('/api/serp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, q: usedKeyword, ll, num: maxLeads, start: offsetToUse }),
      });
      if (!res.ok) throw new Error(`Error /api/serp (${res.status})`);
      const data = await res.json();
      const local: any[] = Array.isArray(data?.local_results) ? data.local_results : [];
      if (local.length === 0) throw new Error(isLoadMore ? 'No hay más resultados.' : 'Sin resultados. Prueba ampliar el radio o cambia la búsqueda.');

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
        url: r?.place_link || r?.links?.place_link || buildGMapsLink(r?.title || r?.name, r?.address),
        lat: r?.gps_coordinates?.latitude ?? r?.latitude ?? undefined,
        lng: r?.gps_coordinates?.longitude ?? r?.longitude ?? undefined,
      }));

      setResults(prev => isLoadMore ? [...prev, ...normalized] : normalized);
      setCurrentOffset(offsetToUse);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsScraping(false); setScrapeStatus('');
    }
  };

  const deleteResult = (id: string) => {
    const idx = results.findIndex(r => r._id === id);
    if (idx !== -1) { resultMarkersRef.current[idx]?.remove(); resultMarkersRef.current.splice(idx, 1); }
    setResults(prev => prev.filter(r => r._id !== id));
    if (activeId === id) setActiveId(null);
  };

  const clearAll = () => {
    if (!results.length) return;
    if (window.confirm('¿Confirmas limpiar todos los resultados?')) {
      resultMarkersRef.current.forEach(m => m.remove());
      resultMarkersRef.current = [];
      setResults([]); setActiveId(null);
    }
  };

  const exportCSV = () => {
    if (!filteredResults.length) return;
    const headers = ['Nombre','Teléfono','Email','Web','Dirección','Categoría','Score IA','Estado CRM','Nota'];
    const rows = filteredResults.map(r => [
      `"${r.name}"`,`"${r.phone||''}"`,`"${r.email||''}"`,`"${r.website||''}"`,
      `"${r.address||''}"`,`"${r.categoryName||''}"`,`"${r.aiScore||''}"`,
      `"${r.crm?.status||'nuevo'}"`,`"${(r.crm?.note||'').replace(/"/g,"'")}"`
    ]);
    const csv = '\uFEFF' + [headers,...rows].map(r=>r.join(';')).join('\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `leads_mapa_${Date.now()}.csv`; a.click();
  };

  const copyPhone = (phone: string, id: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const hasEnriched = results.some(r => r.aiScore || r.email);

  const crmStats = {
    nuevo: resultsWithCRM.filter(r => (r.crm?.status || 'nuevo') === 'nuevo').length,
    contactado: resultsWithCRM.filter(r => r.crm?.status === 'contactado').length,
    interesado: resultsWithCRM.filter(r => r.crm?.status === 'interesado').length,
    cerrado: resultsWithCRM.filter(r => r.crm?.status === 'cerrado').length,
    rechazado: resultsWithCRM.filter(r => r.crm?.status === 'rechazado').length,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Modo Campo overlay */}
      {fieldMode && (
        <FieldMode
          leads={filteredResults.length > 0 ? filteredResults : resultsWithCRM}
          initialIndex={fieldIndex}
          onClose={() => setFieldMode(false)}
          onUpdateCRM={updateCRM}
        />
      )}

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
            Busca en cualquier área, filtra, enriquece con IA, visita en campo y registra el estado de cada lead.
          </p>
        </div>

        {/* Controles + Mapa */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 flex flex-col gap-5">
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-4">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Search className="w-3.5 h-3.5" /> ¿Qué deseas buscar?
              </p>
              <input type="text"
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-semibold text-slate-700 focus:border-indigo-200 focus:bg-white transition"
                placeholder="Ej: clínica dental, restaurant, farmacia…"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-4">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Radio de búsqueda
              </p>
              <div className="flex items-center gap-3">
                <input type="range" min={0.1} max={20} step={0.1} value={radiusKm}
                  onChange={e => setRadiusKm(parseFloat(e.target.value))}
                  className="flex-1 accent-indigo-600" />
                <span className="text-indigo-600 font-black text-sm w-16 text-right">{radiusKm.toFixed(1)} km</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[0.5,1,2,5,10].map(v => (
                  <button key={v} type="button" onClick={() => setRadiusKm(v)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${radiusKm===v?'bg-indigo-600 text-white shadow':'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
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
                {[5,10,20,30].map(v => (
                  <button key={v} type="button" onClick={() => setMaxLeads(v)}
                    className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${maxLeads===v?'bg-indigo-600 text-white shadow':'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {center && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4">
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Punto seleccionado</p>
                <p className="text-slate-700 font-bold text-sm">{center.lat.toFixed(5)}, {center.lng.toFixed(5)}</p>
              </div>
            )}

            <button type="button" onClick={geolocate}
              className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-700 py-3 rounded-2xl font-black text-sm hover:bg-slate-200 transition">
              <Navigation className="w-4 h-4" /> Usar mi ubicación
            </button>
            <button type="button" onClick={() => setShowSessionManager(true)}
              className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border-2 border-indigo-200 py-3 rounded-2xl font-black text-sm hover:bg-indigo-100 transition">
              <FolderOpen className="w-4 h-4" /> Mis sesiones guardadas
            </button>

            <button type="button" onClick={() => handleSearch(false)}
              disabled={isScraping || isEnriching || !center || !keyword.trim()}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-5 rounded-2xl font-black text-base hover:bg-indigo-600 shadow-xl disabled:opacity-50 transition-all active:scale-95">
              {isScraping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              {isScraping ? scrapeStatus || 'Buscando…' : 'Buscar en esta área'}
            </button>
          </div>

          {/* Mapa */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden relative" style={{ height: '500px' }}>
              {!mapReady && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 gap-3 bg-white z-10">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="font-bold text-sm">Cargando mapa…</span>
                </div>
              )}
              <div ref={mapElRef} style={{ height: '100%', width: '100%', visibility: mapReady ? 'visible' : 'hidden' }} />
            </div>
            {!center && mapReady && (
              <p className="text-center text-xs text-slate-400 font-bold flex items-center justify-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" /> Haz clic en el mapa para seleccionar el área
              </p>
            )}
            {results.length > 0 && (
              <p className="text-center text-xs text-emerald-600 font-bold flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {results.length} marcadores — colores según estado CRM — toca uno para ver info
              </p>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-6 bg-rose-50 border-2 border-rose-100 text-rose-700 rounded-3xl flex items-center gap-4">
            <AlertTriangle className="w-8 h-8 shrink-0" />
            <div><p className="font-black text-sm uppercase">Atención</p><p className="text-xs font-medium">{error}</p></div>
          </div>
        )}

        {/* Resultados */}
        {results.length > 0 && (
          <div className="space-y-6 animate-slideUp">

            {/* CRM Pipeline */}
            <div className="grid grid-cols-5 gap-3">
              {STATUSES.map(s => {
                const cfg = STATUS_CONFIG[s];
                return (
                  <button key={s} onClick={() => setFilterStatus(filterStatus === s ? 'todos' : s)}
                    className="rounded-2xl p-3 text-center border-2 transition-all"
                    style={{
                      background: filterStatus === s ? cfg.color : cfg.bg,
                      borderColor: filterStatus === s ? cfg.color : cfg.border,
                      color: filterStatus === s ? 'white' : cfg.color,
                    }}>
                    <div className="text-lg">{cfg.emoji}</div>
                    <div className="font-black text-xl">{crmStats[s]}</div>
                    <div className="text-[10px] font-black uppercase tracking-wide opacity-80">{cfg.label}</div>
                  </button>
                );
              })}
            </div>

            {/* Barra de acciones */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                {filteredResults.length === results.length ? `${results.length} leads` : `${filteredResults.length} de ${results.length} leads`}
                {hasEnriched && <span className="text-xs font-black text-violet-600 bg-violet-50 px-3 py-1 rounded-xl">IA activa</span>}
              </h3>
              <div className="flex flex-wrap gap-2">
                {/* Modo campo */}
                <button onClick={() => { setFieldIndex(0); setFieldMode(true); }}
                  disabled={filteredResults.length === 0}
                  className="flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-2xl font-black text-sm hover:bg-indigo-600 transition disabled:opacity-50">
                  <Briefcase className="w-4 h-4" /> Modo Campo
                </button>
                {/* Ruta */}
                <button onClick={openOptimizedRoute}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-2xl font-black text-sm hover:bg-blue-500 transition">
                  <Route className="w-4 h-4" />
                  Ruta {selectedIds.size > 0 ? `(${selectedIds.size})` : `(${filteredResults.length})`}
                </button>
                {/* Enriquecer IA */}
                <button onClick={handleAIEnrichment} disabled={isEnriching || isScraping}
                  className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-3 rounded-2xl font-black text-sm disabled:opacity-50 transition hover:shadow-lg">
                  {isEnriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                  {isEnriching ? scrapeStatus || 'Analizando…' : 'IA'}
                </button>
                {/* Filtros */}
                <button onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-sm transition border-2 ${showFilters ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'}`}>
                  <Filter className="w-4 h-4" /> Filtros
                  {(filterPhone||filterWeb||filterNoWeb||filterSearch||filterScore!=='todos'||filterStars>0||filterCategory!=='todos'||filterStatus!=='todos') && (
                    <span className="bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black">!</span>
                  )}
                </button>
                {/* PDF */}
                <button onClick={exportPDF}
                  className="flex items-center gap-2 bg-orange-500 text-white px-4 py-3 rounded-2xl font-black text-sm hover:bg-orange-400 transition">
                  <FileText className="w-4 h-4" /> PDF
                </button>
                <button onClick={() => setShowSessionManager(true)}
                  className="flex items-center gap-2 bg-indigo-50 text-indigo-700 border-2 border-indigo-200 px-4 py-3 rounded-2xl font-black text-sm hover:bg-indigo-100 transition">
                  <Save className="w-4 h-4" /> Guardar sesión
                </button>
                {/* CSV */}
                <button onClick={exportCSV}
                  className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-3 rounded-2xl font-black text-sm hover:shadow-lg transition">
                  <Download className="w-4 h-4" /> CSV
                </button>
                {/* Limpiar */}
                {selectedIds.size > 0
                  ? <button onClick={clearSelection}
                      className="flex items-center gap-2 bg-blue-50 text-blue-600 border border-blue-200 px-4 py-3 rounded-2xl font-black text-sm hover:bg-blue-100 transition">
                      <X className="w-4 h-4" /> Quitar selección ({selectedIds.size})
                    </button>
                  : <button onClick={selectAll}
                      className="flex items-center gap-2 bg-slate-100 text-slate-600 border border-slate-200 px-4 py-3 rounded-2xl font-black text-sm hover:bg-slate-200 transition">
                      <CheckCircle2 className="w-4 h-4" /> Seleccionar todos
                    </button>
                }
                <button onClick={clearAll}
                  className="flex items-center gap-2 bg-rose-50 text-rose-600 border border-rose-200 px-4 py-3 rounded-2xl font-black text-sm hover:bg-rose-100 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Panel de filtros */}
            {showFilters && (
              <div className="bg-white rounded-[2rem] border-2 border-indigo-100 shadow-sm p-6 space-y-5">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-indigo-500" /> Filtros inteligentes
                </p>
                {/* Campo de búsqueda editable */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar en resultados: nombre, dirección, teléfono…"
                      value={filterSearch}
                      onChange={e => setFilterSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-semibold text-slate-700 outline-none focus:border-indigo-200 focus:bg-white transition"
                    />
                    {filterSearch && (
                      <button onClick={() => setFilterSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={filterPhone} onChange={e => setFilterPhone(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
                    <span className="text-xs font-black text-slate-700">Con teléfono</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={filterWeb} onChange={e => setFilterWeb(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
                    <span className="text-xs font-black text-slate-700">Con web</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer bg-orange-50 border-2 border-orange-200 px-3 py-2 rounded-xl transition hover:bg-orange-100" style={{cursor:'pointer'}}>
                    <input type="checkbox" checked={filterNoWeb} onChange={e => { setFilterNoWeb(e.target.checked); if(e.target.checked) setFilterWeb(false); }} className="accent-orange-500 w-4 h-4" />
                    <span className="text-xs font-black text-orange-700">🚫 Sin página web</span>
                  </label>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Score IA</p>
                    <select value={filterScore} onChange={e => setFilterScore(e.target.value)}
                      className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none">
                      <option value="todos">Todos</option>
                      <option value="Premium">Premium</option>
                      <option value="Estándar">Estándar</option>
                      <option value="Bajo">Bajo</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Estrellas mín.</p>
                    <select value={filterStars} onChange={e => setFilterStars(Number(e.target.value))}
                      className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none">
                      <option value={0}>Todas</option>
                      {[3,3.5,4,4.5,5].map(v => <option key={v} value={v}>{v}+</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Categoría</p>
                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                      className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none">
                      {categories.map(c => <option key={c} value={c}>{c === 'todos' ? 'Todas' : c}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Estado CRM</p>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
                      className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none">
                      <option value="todos">Todos</option>
                      {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].emoji} {STATUS_CONFIG[s].label}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={() => { setFilterPhone(false); setFilterWeb(false); setFilterNoWeb(false); setFilterSearch(''); setFilterScore('todos'); setFilterStars(0); setFilterCategory('todos'); setFilterStatus('todos'); }}
                  className="text-xs font-black text-rose-500 hover:text-rose-700 transition">
                  ✕ Limpiar filtros
                </button>
              </div>
            )}

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredResults.map((item, idx) => {
                const crmEntry = item.crm;
                const crmStatus: VisitStatus = crmEntry?.status || 'nuevo';
                const cfg = STATUS_CONFIG[crmStatus];
                return (
                  <div id={`card-${item._id}`} key={item._id}
                    className={`rounded-[2rem] border-2 bg-white transition-all flex flex-col h-full relative group ${
                      activeId === item._id
                        ? 'border-indigo-500 shadow-2xl shadow-indigo-100 ring-4 ring-indigo-50 scale-[1.02]'
                        : 'border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-200'
                    }`}>

                    {/* Franja de color CRM arriba */}
                    <div className="h-1.5 rounded-t-[2rem]" style={{ background: cfg.color }} />

                    <div className="p-6 flex flex-col flex-1">
                      {/* Header card */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {/* Checkbox de selección para ruta */}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleSelect(item._id); }}
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow shrink-0 border-2 transition-all ${
                              selectedIds.has(item._id)
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-400 border-slate-300 hover:border-blue-400'
                            }`}
                            title={selectedIds.has(item._id) ? 'Quitar de ruta' : 'Añadir a ruta'}>
                            {selectedIds.has(item._id) ? <Check className="w-3.5 h-3.5" /> : <span>{idx + 1}</span>}
                          </button>
                          <span className="text-[10px] font-black px-2 py-1 rounded-xl border"
                            style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
                            {cfg.emoji} {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button type="button"
                            onClick={() => { setFieldIndex(results.findIndex(r => r._id === item._id)); setFieldMode(true); }}
                            className="p-2 bg-slate-800 text-white rounded-xl hover:bg-indigo-600 transition text-xs"
                            title="Modo campo">
                            <Briefcase className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => deleteResult(item._id)}
                            className="p-2 bg-rose-50 text-rose-500 hover:text-rose-700 rounded-xl transition border border-rose-100">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Nombre */}
                      <div className="mb-3 cursor-pointer" onClick={() => focusMarker(item._id)}>
                        {item.categoryName && (
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl uppercase tracking-widest">{item.categoryName}</span>
                        )}
                        <h4 className="text-lg font-black text-slate-800 mt-2 leading-tight line-clamp-2">{item.name}</h4>
                        {item.stars && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span className="text-amber-700 font-black text-xs">{item.stars}</span>
                            {item.reviewsCount && <span className="text-slate-400 text-[10px]">({item.reviewsCount})</span>}
                          </div>
                        )}
                        {item.aiScore && (
                          <span className="mt-1 inline-block text-[9px] font-black px-2 py-0.5 rounded-lg text-white" style={{ background: scoreColor(item.aiScore) }}>
                            {item.aiScore}
                          </span>
                        )}
                      </div>

                      {/* Resumen IA */}
                      {item.aiSummary && (
                        <div className="mb-3 p-3 bg-violet-50 border border-violet-100 rounded-2xl">
                          <div className="flex items-center gap-1 mb-1">
                            <Sparkles className="w-3 h-3 text-violet-500" />
                            <span className="text-[9px] font-black text-violet-500 uppercase tracking-widest">IA</span>
                          </div>
                          <p className="text-xs text-violet-800 font-medium leading-relaxed">{item.aiSummary}</p>
                        </div>
                      )}

                      {/* Nota CRM */}
                      {crmEntry?.note && (
                        <div className="mb-3 p-3 bg-amber-50 border border-amber-100 rounded-2xl">
                          <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">📝 Nota</p>
                          <p className="text-xs text-amber-800">{crmEntry.note}</p>
                        </div>
                      )}

                      <div className="space-y-2 flex-grow">
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
                              <a href={`tel:${item.phone}`} className="text-sm font-black text-slate-800 hover:text-indigo-600">{item.phone}</a>
                            </div>
                            <button onClick={() => copyPhone(item.phone!, item._id)} className="p-1.5 text-slate-300 hover:text-indigo-500">
                              {copiedId === item._id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                        {item.email && (
                          <div className="flex items-center gap-2 bg-indigo-50 p-3 rounded-2xl">
                            <Mail className="w-4 h-4 text-indigo-500 shrink-0" />
                            <a href={`mailto:${item.email}`} className="text-xs font-bold text-indigo-600 hover:underline truncate flex-1">{item.email}</a>
                          </div>
                        )}
                      </div>

                      {/* CRM selector inline */}
                      <div className="mt-4 pt-4 border-t border-slate-50">
                        <div className="flex flex-wrap gap-1 mb-3">
                          {STATUSES.map(s => {
                            const c = STATUS_CONFIG[s];
                            return (
                              <button key={s} onClick={() => updateCRM(item._id, { status: s, note: crmEntry?.note || '', updatedAt: Date.now() })}
                                className="px-2 py-1 rounded-lg text-[10px] font-black transition-all border"
                                style={{
                                  background: crmStatus === s ? c.color : 'transparent',
                                  color: crmStatus === s ? 'white' : c.color,
                                  borderColor: c.color,
                                }}>
                                {c.emoji}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          {item.website
                            ? <a href={item.website} target="_blank" rel="noopener noreferrer"
                                className="text-indigo-600 text-[11px] font-black flex items-center gap-1 uppercase hover:underline">
                                <Globe className="w-4 h-4" /> Web
                              </a>
                            : <span className="text-slate-300 text-[10px] font-black uppercase">Sin Web</span>
                          }
                          <button onClick={() => setEmailModalLead(item as BusinessData)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black transition-all ${item.email ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                            <Mail className="w-3.5 h-3.5" />
                            {item.email ? 'Correo' : 'Manual'}
                          </button>
                          <a href={buildNavLink(item.name, item.address, item.lat, item.lng)} target="_blank" rel="noopener noreferrer"
                            className="bg-blue-50 p-2.5 rounded-2xl text-blue-400 hover:text-blue-600 transition hover:bg-blue-100" title="Navegar">
                            <Navigation className="w-4 h-4" />
                          </a>
                          <a href={item.url} target="_blank" rel="noopener noreferrer"
                            className="bg-slate-50 p-2.5 rounded-2xl text-slate-400 hover:text-indigo-600 transition hover:bg-indigo-50">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredResults.length === 0 && results.length > 0 && (
              <div className="text-center py-16 text-slate-400">
                <Filter className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-black text-lg">Sin resultados con estos filtros</p>
                <button onClick={() => { setFilterPhone(false); setFilterWeb(false); setFilterScore('todos'); setFilterStars(0); setFilterCategory('todos'); setFilterStatus('todos'); }}
                  className="mt-3 text-indigo-600 font-black text-sm hover:underline">
                  Limpiar filtros
                </button>
              </div>
            )}

            {/* Cargar más */}
            <div className="flex justify-center pt-8 pb-16">
              <button onClick={() => handleSearch(true)} disabled={isScraping || isEnriching}
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

      {emailModalLead && <EmailModal lead={emailModalLead} onClose={() => setEmailModalLead(null)} />}
      {showSessionManager && (
        <SessionManager
          currentLeads={resultsWithCRM as SessionLead[]}
          currentKeyword={lastKeyword || keyword}
          currentZone={center ? `${center.lat.toFixed(3)}, ${center.lng.toFixed(3)}` : ''}
          onLoadSession={handleLoadSession}
          onClose={() => setShowSessionManager(false)}
        />
      )}
    </>
  );
};

export default MapSearch;
