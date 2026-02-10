import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  MapPin,
  Loader2,
  Download,
  Phone,
  Globe,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  BrainCircuit,
  Star,
  History,
  X,
  Copy,
  Check,
  Edit2,
  List,
  Database,
  FilterX,
  PlusCircle,
  Trash2
} from 'lucide-react';
import { BusinessData, ScraperSettings } from '../types';
import { getSerpApiAccountInfo } from '../lib/scraper';
import { enrichLeadsWithAI } from '../lib/ai';
import { searchWithSerp } from "../lib/scraper";

const NICHES_DATA: Record<string, string[]> = {
  "Médico": ["Odontólogo", "Pediatra", "Cirujano", "Dermatólogo", "Clínica Dental", "Veterinaria", "Urólogo", "Ginecólogo"],
  "Construcción": ["Reformas", "Arquitecto", "Inmobiliaria", "Fontanero", "Electricista", "Pintor", "Carpintería"],
  "Legal y Asesoría": ["Abogado", "Gestoría", "Marketing", "Notaría", "Asesor Fiscal", "Contador"],
  "Gastronomía": ["Restaurante", "Pizzería", "Cafetería", "Panadería", "Sushi", "Hamburguesería"],
  "Bienestar": ["Gimnasio", "Peluquería", "Estética", "Spa", "Yoga", "Fisioterapia"],
  "Servicios Motor": ["Taller Mecánico", "Concesionario", "Lavadero", "Venta de Repuestos"],
  "Educación": ["Academia de Idiomas", "Escuela Infantil", "Centro de Formación", "Autoescuela"]
};

const COUNTRIES_CITIES: Record<string, string[]> = {
  "España": ["Madrid", "Barcelona"],
  "Estados Unidos": ["Washington D.C.", "New York"],
  "México": ["Ciudad de México", "Toluca","Monterrey"],
  "Argentina": ["Buenos Aires", "Córdoba"],
  "Colombia": ["Bogotá", "Medellín"],
  "Chile": ["Santiago", "Rancagua","Machali","Concepción"],
  "Perú": ["Lima", "Arequipa"],
  "Reino Unido": ["Londres", "Manchester"],
  "Francia": ["París", "Lyon"],
  "Alemania": ["Berlín", "Múnich"],
  "Italia": ["Roma", "Milán"],
  "Canadá": ["Ottawa", "Toronto"],
  "Brasil": ["Brasilia", "São Paulo"]
};

// ✅ Coordenadas (lat,lng) por ciudad.
// Esto evita el error: "Unsupported location" en SerpApi.
const CITY_LL: Record<string, string> = {
  "España|Madrid": "40.4168,-3.7038",
  "España|Barcelona": "41.3851,2.1734",

  "Estados Unidos|Washington D.C.": "38.9072,-77.0369",
  "Estados Unidos|New York": "40.7128,-74.0060",

  "México|Ciudad de México": "19.4326,-99.1332",
  "México|Monterrey": "25.6866,-100.3161",

  "Argentina|Buenos Aires": "-34.6037,-58.3816",
  "Argentina|Córdoba": "-31.4201,-64.1888",

  "Colombia|Bogotá": "4.7110,-74.0721",
  "Colombia|Medellín": "6.2442,-75.5812",

  "Chile|Santiago": "-33.4489,-70.6693",
  "Chile|Concepción": "-36.8201,-73.0444",

  "Perú|Lima": "-12.0464,-77.0428",
  "Perú|Arequipa": "-16.4090,-71.5375",

  "Reino Unido|Londres": "51.5074,-0.1278",
  "Reino Unido|Manchester": "53.4808,-2.2426",

  "Francia|París": "48.8566,2.3522",
  "Francia|Lyon": "45.7640,4.8357",

  "Alemania|Berlín": "52.5200,13.4050",
  "Alemania|Múnich": "48.1351,11.5820",

  "Italia|Roma": "41.9028,12.4964",
  "Italia|Milán": "45.4642,9.1900",

  "Canadá|Ottawa": "45.4215,-75.6972",
  "Canadá|Toronto": "43.6532,-79.3832",

  "Brasil|Brasilia": "-15.7939,-47.8828",
  "Brasil|São Paulo": "-23.5505,-46.6333",
};

const Dashboard: React.FC = () => {
  const [selectedNiche, setSelectedNiche] = useState<string>('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('');
  const [country, setCountry] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [maxLeads, setMaxLeads] = useState<number>(20);

  // Motor API (SerpApi Key) - ahora también para usuario
  const [motorApiKey, setMotorApiKey] = useState<string>('');
  const [motorSavedOk, setMotorSavedOk] = useState<boolean>(false);

  // Paginación y Memoria
  const [currentOffset, setCurrentOffset] = useState<number>(0);
  const [lastQuery, setLastQuery] = useState<string>('');
  const [sessionLeadsHistory, setSessionLeadsHistory] = useState<Set<string>>(new Set());
  const [filteredCount, setFilteredCount] = useState<number>(0);

  const [accountBalance, setAccountBalance] = useState<{ left: number, total: number } | null>(null);

  const [isManualNiche, setIsManualNiche] = useState(false);
  const [isManualSpecialty, setIsManualSpecialty] = useState(false);
  const [isManualCountry, setIsManualCountry] = useState(false);
  const [isManualCity, setIsManualCity] = useState(false);

  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isScraping, setIsScraping] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState<string>('');
  const [results, setResults] = useState<BusinessData[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Estado para la selección por doble clic
  const [selectedLeadIndex, setSelectedLeadIndex] = useState<number | null>(null);

  const specialties = useMemo(() => selectedNiche ? NICHES_DATA[selectedNiche] || [] : [], [selectedNiche]);
  const availableCities = useMemo(() => country ? COUNTRIES_CITIES[country] || [] : [], [country]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('search_history');
    if (savedHistory) setSearchHistory(JSON.parse(savedHistory));

    // ✅ Cargar API Key del usuario desde localStorage
    const savedSettings = localStorage.getItem('scraper_settings');
    if (savedSettings) {
      try {
        const parsed: ScraperSettings = JSON.parse(savedSettings);
        if (parsed?.apiKey) setMotorApiKey(parsed.apiKey);
      } catch { /* ignore */ }
    }

    fetchBalance();
  }, []);

  // Listener para la tecla Suprimir
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Suprimir') && selectedLeadIndex !== null) {
        deleteIndividualLead(selectedLeadIndex);
        setSelectedLeadIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLeadIndex, results]);

  const fetchBalance = async () => {
    const savedSettings = localStorage.getItem('scraper_settings');
    if (savedSettings) {
      const { apiKey }: ScraperSettings = JSON.parse(savedSettings);
      const info = await getSerpApiAccountInfo(apiKey);
      if (info) {
        setAccountBalance({ left: info.planSearchesLeft, total: info.searchesPerMonth });
      }
    }
  };

  const saveMotorApiKey = async () => {
    setMotorSavedOk(false);
    setError(null);

    const key = (motorApiKey || '').trim();
    if (!key) {
      setError("Debes pegar tu SerpApi Key antes de guardar.");
      return;
    }

    const settings: ScraperSettings = { apiKey: key };
    localStorage.setItem('scraper_settings', JSON.stringify(settings));
    setMotorSavedOk(true);

    await fetchBalance();
    setTimeout(() => setMotorSavedOk(false), 2000);
  };

  const saveToHistory = (query: string) => {
    const newHistory = [query, ...searchHistory.filter(h => h !== query)].slice(0, 5);
    setSearchHistory(newHistory);
    localStorage.setItem('search_history', JSON.stringify(newHistory));
  };

  const handleCopyPhone = (phone: string, id: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getLeadIdentifier = (lead: BusinessData) => {
    const name = (lead.name || '').toLowerCase().trim();
    const phone = (lead.phone || '').toLowerCase().trim();
    const address = (lead.address || lead.fullAddress || '').toLowerCase().trim();
    return `${name}|${phone}|${address}`;
  };

  // Si no viene un link directo desde SerpApi, armamos uno de Google Maps
  const buildGoogleMapsLink = (name?: string, address?: string) => {
    const q = `${name || ''} ${address || ''}`.trim();
    if (!q) return 'https://www.google.com/maps';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  };

  // Convertimos la respuesta de SerpApi (google_maps) a tu BusinessData[]
  const normalizeSerpToBusinessData = (serpResponse: any): BusinessData[] => {
    const local = Array.isArray(serpResponse?.local_results) ? serpResponse.local_results : [];
    const out: BusinessData[] = local.map((r: any) => {
      const name = r?.title || r?.name || '';
      const address = r?.address || r?.full_address || '';
      const phone = r?.phone || r?.phone_number || '';
      const website = r?.website || r?.website_link || '';
      const rating = r?.rating ?? r?.stars ?? null;
      const reviews = r?.reviews ?? r?.reviews_count ?? null;

      const url =
        r?.place_link ||
        r?.links?.place_link ||
        buildGoogleMapsLink(name, address);

      const categoryName = r?.type || r?.category || r?.categoryName || '';

      return {
        name,
        phone: phone || '',
        website: website || '',
        address: address || '',
        fullAddress: address || '',
        categoryName: categoryName || '',
        url: url || buildGoogleMapsLink(name, address),
        stars: rating != null ? String(rating) : undefined,
        reviewsCount: reviews != null ? String(reviews) : undefined,
      } as BusinessData;
    });

    return out.filter(x => (x.name || '').trim().length > 0);
  };

  // Si el usuario usa historial ("X en Y"), lo separamos en q y location
  const splitQueryIfContainsEn = (text: string) => {
    const marker = ' en ';
    const idx = text.toLowerCase().lastIndexOf(marker);
    if (idx === -1) return { q: text.trim(), location: '' };
    const q = text.slice(0, idx).trim();
    const location = text.slice(idx + marker.length).trim();
    return { q, location };
  };

  const handleScrape = async (e?: React.FormEvent, customQuery?: string, isLoadMore: boolean = false) => {
    if (e) e.preventDefault();

    const nichePart = selectedSpecialty || selectedNiche;
    const locationPart = city && country ? `${city}, ${country}` : (city || country);
    const finalQuery = customQuery || `${nichePart} en ${locationPart}`;

    setError(null);
    if (!isLoadMore) {
      setResults([]);
      setCurrentOffset(0);
      setFilteredCount(0);
      setSelectedLeadIndex(null);
    }

    setIsScraping(true);
    setLastQuery(finalQuery);
    if (!isLoadMore) saveToHistory(finalQuery);

    const offsetToUse = isLoadMore ? currentOffset + maxLeads : 0;

    try {
      const savedSettings = localStorage.getItem('scraper_settings');
      if (!savedSettings) throw new Error("Configura tu SerpApi Key en el panel 'Motor API' (arriba) y guarda.");
      const { apiKey }: ScraperSettings = JSON.parse(savedSettings);

      setScrapeStatus(isLoadMore ? "Cargando más resultados..." : "Consultando Google Maps...");

      // Para SerpApi, preferimos separar q/location
      let qToUse = nichePart;
      let locationToUse = locationPart;

      if (customQuery) {
        const split = splitQueryIfContainsEn(customQuery);
        qToUse = split.q || nichePart;
        locationToUse = split.location || locationPart;
      }

      if (!qToUse || !qToUse.trim()) throw new Error("Debes seleccionar un sector o escribir uno manualmente.");
      if (!locationToUse || !locationToUse.trim()) throw new Error("Debes seleccionar una ciudad/país o escribirlo manualmente.");

      // ✅ Enviamos ll cuando tenemos ciudad+país de la lista (evita “Unsupported location”)
      const llKey = `${country}|${city}`;
      const ll = CITY_LL[llKey] || "";

      // ✅ ESTA ES LA LLAMADA ÚNICA: frontend -> /api/serp
      const serpResponse = await searchWithSerp({
        apiKey,
        q: qToUse,
        location: locationToUse,
        num: maxLeads,
        start: offsetToUse,
        // @ts-ignore (si tu tipo no incluye ll aún, esto evita error)
        ll,
      });

      const rawData = normalizeSerpToBusinessData(serpResponse);

      if (rawData.length === 0) {
        if (isLoadMore) throw new Error("No hay más resultados disponibles para esta búsqueda.");
        else throw new Error("No se encontraron resultados.");
      }

      const newLeadsBatch: BusinessData[] = [];
      let duplicatesFound = 0;
      const updatedHistory = new Set(sessionLeadsHistory);

      rawData.forEach(lead => {
        const id = getLeadIdentifier(lead);
        if (!updatedHistory.has(id)) {
          updatedHistory.add(id);
          newLeadsBatch.push(lead);
        } else {
          duplicatesFound++;
        }
      });

      if (newLeadsBatch.length === 0 && !isLoadMore) {
        throw new Error("Todos los prospectos encontrados ya estaban en tu lista de sesión. Prueba 'Extraer más' o cambia el área.");
      }

      setSessionLeadsHistory(updatedHistory);
      setFilteredCount(prev => isLoadMore ? prev + duplicatesFound : duplicatesFound);
      setResults(prev => isLoadMore ? [...prev, ...newLeadsBatch] : newLeadsBatch);
      setCurrentOffset(offsetToUse);
      fetchBalance();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsScraping(false);
      setScrapeStatus('');
    }
  };

  const handleAIEnrichment = async () => {
    setIsEnriching(true);
    setScrapeStatus("Gemini IA analizando prospectos...");
    try {
      const enrichedData = await enrichLeadsWithAI(results);
      setResults(enrichedData);
    } catch (err) { console.error(err); }
    finally { setIsEnriching(false); setScrapeStatus(""); }
  };

  // Función para eliminar un lead individualmente de la vista activa por su índice (Sin confirmación para mayor agilidad)
  const deleteIndividualLead = (index: number) => {
    setResults(prev => prev.filter((_, i) => i !== index));
    if (selectedLeadIndex === index) setSelectedLeadIndex(null);
  };

  // Función para limpiar todos los resultados de la vista
  const clearResults = () => {
    if (results.length === 0) return;
    if (window.confirm("¿Confirmas limpiar toda la pantalla de resultados? (El sistema recordará estos leads para no repetirlos en nuevas búsquedas de esta sesión)")) {
      setResults([]);
      setSelectedLeadIndex(null);
    }
  };

  const exportToExcel = () => {
    if (results.length === 0) return;
    const headers = ["Nombre", "Teléfono", "Web", "Dirección", "Categoría", "IA Score", "Análisis IA"];
    const rows = results.map(item => [
      `"${item.name}"`, `"${item.phone || ''}"`, `"${item.website || ''}"`,
      `"${item.address || ''}"`, `"${item.categoryName || ''}"`,
      `"${item.aiScore || 'N/A'}"`, `"${item.aiSummary || 'N/A'}"`
    ]);
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `leads_saasynetia_${new Date().getTime()}.csv`;
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 animate-fadeIn">

      {/* ✅ MOTOR API PARA USUARIO (SerpApi Key) */}
      <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
        <div className="p-10 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-800">Configuración del Motor</h2>
            <p className="text-slate-500 font-medium">Estamos usando SerpApi por su velocidad y gratuidad.</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SerpApi Key</label>
            <input
              type="password"
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-semibold text-slate-700 focus:border-indigo-200 focus:bg-white transition"
              placeholder="Pega tu SerpApi Key aquí"
              value={motorApiKey}
              onChange={(e) => setMotorApiKey(e.target.value)}
              autoComplete="off"
            />
            <a
              href="https://serpapi.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-indigo-600 text-[11px] font-black hover:underline"
            >
              Obtén tu clave gratis aquí <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <button
            type="button"
            onClick={saveMotorApiKey}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm transition-all hover:shadow-lg hover:bg-indigo-600 active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {motorSavedOk ? (
              <>
                <CheckCircle2 className="w-5 h-5" /> Guardado
              </>
            ) : (
              <>
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
        <div className="text-center md:text-left space-y-2">
          <h1 className="text-4xl font-black text-slate-800 tracking-tight flex items-center justify-center md:justify-start gap-3">
            <div className="bg-indigo-600 p-2 rounded-2xl shadow-lg shadow-indigo-200">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            SaaSynetIA <span className="text-indigo-600">Scraper</span>
          </h1>
          <p className="text-slate-500 font-medium">Motor de extracción ultra-rápido impulsado por SerpApi e IA</p>
          {scrapeStatus && <p className="text-xs font-black text-indigo-600">{scrapeStatus}</p>}
        </div>

        {accountBalance && (
          <div className="bg-white px-6 py-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="bg-emerald-50 p-2.5 rounded-2xl text-emerald-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Búsquedas Disponibles</p>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-slate-800">{accountBalance.left}</span>
                <span className="text-slate-300 font-bold">/</span>
                <span className="text-sm font-bold text-slate-400">{accountBalance.total}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
        <form onSubmit={(e) => handleScrape(e)} className="p-10 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Sector</label>
                <button type="button" onClick={() => setIsManualNiche(!isManualNiche)} className="text-indigo-500 hover:text-indigo-700 p-1">
                  {isManualNiche ? <List className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                </button>
              </div>
              {isManualNiche ? (
                <input type="text" className="w-full p-4 bg-slate-50 border-2 border-indigo-100 rounded-2xl outline-none font-semibold text-slate-700" placeholder="Escribe el sector..." value={selectedNiche} onChange={(e) => setSelectedNiche(e.target.value)} />
              ) : (
                <select className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-semibold text-slate-700" value={selectedNiche} onChange={(e) => setSelectedNiche(e.target.value)}>
                  <option value="">Selecciona Nicho</option>
                  {Object.keys(NICHES_DATA).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Especialidad</label>
                <button type="button" onClick={() => setIsManualSpecialty(!isManualSpecialty)} className="text-indigo-500 hover:text-indigo-700 p-1">
                  {isManualSpecialty ? <List className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                </button>
              </div>
              {isManualSpecialty ? (
                <input type="text" className="w-full p-4 bg-slate-50 border-2 border-indigo-100 rounded-2xl outline-none font-semibold text-slate-700" placeholder="Escribe especialidad..." value={selectedSpecialty} onChange={(e) => setSelectedSpecialty(e.target.value)} />
              ) : (
                <select className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-semibold text-slate-700 disabled:opacity-40" value={selectedSpecialty} onChange={(e) => setSelectedSpecialty(e.target.value)} disabled={!selectedNiche}>
                  <option value="">Todo el sector</option>
                  {specialties.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">País</label>
                <button type="button" onClick={() => setIsManualCountry(!isManualCountry)} className="text-indigo-500 hover:text-indigo-700 p-1">
                  {isManualCountry ? <List className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                </button>
              </div>
              {isManualCountry ? (
                <input type="text" className="w-full p-4 bg-slate-50 border-2 border-indigo-100 rounded-2xl outline-none font-semibold text-slate-700" placeholder="Escribe el país..." value={country} onChange={(e) => setCountry(e.target.value)} />
              ) : (
                <select className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-semibold text-slate-700" value={country} onChange={(e) => setCountry(e.target.value)}>
                  <option value="">Selecciona País</option>
                  {Object.keys(COUNTRIES_CITIES).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Ciudad</label>
                <button type="button" onClick={() => setIsManualCity(!isManualCity)} className="text-indigo-500 hover:text-indigo-700 p-1">
                  {isManualCity ? <List className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                </button>
              </div>
              {isManualCity ? (
                <input type="text" className="w-full p-4 bg-slate-50 border-2 border-indigo-100 rounded-2xl outline-none font-semibold text-slate-700" placeholder="Escribe la ciudad..." value={city} onChange={(e) => setCity(e.target.value)} />
              ) : (
                <select className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-semibold text-slate-700 disabled:opacity-40" value={city} onChange={(e) => setCity(e.target.value)} disabled={!country}>
                  <option value="">Selecciona Ciudad</option>
                  {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-6 pt-4">
            <div className="flex flex-col items-center gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cantidad por página</label>
              <div className="flex items-center bg-slate-100 rounded-2xl p-1 gap-1">
                {[10, 20].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMaxLeads(val)}
                    className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${maxLeads === val ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white'}`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isScraping || isEnriching || (!selectedNiche && !isManualNiche) || (!city && !isManualCity)}
              className="group relative bg-slate-900 text-white px-16 py-5 rounded-2xl font-black text-lg flex items-center gap-4 hover:bg-indigo-600 shadow-2xl disabled:opacity-50 transition-all active:scale-95"
            >
              {isScraping ? <Loader2 className="w-6 h-6 animate-spin text-indigo-400" /> : <Search className="w-6 h-6 group-hover:scale-110 transition" />}
              <span>{isScraping ? "Extrayendo..." : "Iniciar Extracción Única"}</span>
            </button>
          </div>

          {searchHistory.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-slate-50">
              <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"> <History className="w-3 h-3" /> Recientes: </span>
              {searchHistory.map((q, i) => (
                <button key={i} type="button" onClick={() => handleScrape(undefined, q)} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold hover:bg-indigo-100 transition"> {q.split(' en ')[0]}... </button>
              ))}
            </div>
          )}
        </form>
      </div>

      {error && (
        <div className="p-6 bg-rose-50 border-2 border-rose-100 text-rose-700 rounded-3xl flex items-center gap-4 animate-shake">
          <AlertTriangle className="w-8 h-8 shrink-0" />
          <div>
            <p className="font-black text-sm uppercase">Atención</p>
            <p className="text-xs font-medium">{error}</p>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-8 animate-slideUp">
          <div className="flex flex-col md:flex-row justify-between items-end gap-6">
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" /> Base de Leads ({results.length})
              </h3>
              <div className="flex items-center gap-4">
                <p className="text-slate-500 text-sm font-medium">Prospectos acumulados en esta sesión. Doble clic para seleccionar y Suprimir para borrar.</p>
                {filteredCount > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase border border-amber-100">
                    <FilterX className="w-3 h-3" /> {filteredCount} duplicados omitidos
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 w-full md:w-auto">
              <button onClick={handleAIEnrichment} disabled={isEnriching || isScraping} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-4 rounded-2xl font-black text-sm disabled:opacity-50 transition-all hover:shadow-lg">
                <BrainCircuit className="w-5 h-5" /> {isEnriching ? "IA Pensando..." : "Enriquecer con IA"}
              </button>
              <button onClick={exportToExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-500 text-white px-6 py-4 rounded-2xl font-black text-sm transition-all hover:shadow-lg">
                <Download className="w-5 h-5" /> Exportar
              </button>

              <button
                type="button"
                onClick={clearResults}
                disabled={results.length === 0 || isScraping}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed border border-rose-200 px-6 py-4 rounded-2xl font-black text-sm transition-all active:scale-95 shadow-sm"
              >
                <Trash2 className="w-5 h-5" /> Borrar Vista
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {results.map((item, idx) => {
              const leadUniqueId = getLeadIdentifier(item);
              const cardId = `lead-card-${idx}`;
              const cardKey = `${leadUniqueId}-${idx}`;
              const isSelected = selectedLeadIndex === idx;

              return (
                <div
                  key={cardKey}
                  onDoubleClick={() => setSelectedLeadIndex(isSelected ? null : idx)}
                  className={`p-8 rounded-[2rem] border-2 transition-all group relative flex flex-col h-full overflow-hidden cursor-pointer ${isSelected ? 'bg-indigo-50/30 border-indigo-500 shadow-2xl ring-4 ring-indigo-100 scale-[1.02]' : 'bg-white border-slate-100 shadow-sm hover:shadow-xl'}`}
                >
                  {/* Botón X Individual Habilitado e Inmediato */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      deleteIndividualLead(idx);
                    }}
                    className="absolute top-4 right-4 p-2 bg-rose-50 text-rose-500 hover:text-rose-700 rounded-xl transition-all z-30 opacity-100 md:opacity-0 md:group-hover:opacity-100 flex items-center justify-center border border-rose-100"
                    title="Eliminar este lead de la vista"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {item.aiScore && (
                    <div className={`absolute top-0 left-0 px-5 py-2 text-[10px] font-black uppercase rounded-tl-[2rem] rounded-br-2xl ${item.aiScore === 'Premium' ? 'bg-amber-400 text-white' : 'bg-slate-800 text-white'}`}> {item.aiScore} Lead </div>
                  )}
                  <div className="mb-6 pt-4">
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl uppercase tracking-widest"> {item.categoryName} </span>
                    <h4 className="text-xl font-black text-slate-800 line-clamp-2 mt-4 leading-tight">{item.name}</h4>
                    {item.stars && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span className="text-amber-700 font-black text-xs">{item.stars}</span>
                        <span className="text-slate-400 text-[10px] font-bold">({item.reviewsCount} reseñas)</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4 text-sm flex-grow">
                    <div className="flex items-start gap-3 text-slate-500">
                      <MapPin className="w-5 h-5 shrink-0 text-slate-300" />
                      <span className="text-xs font-medium">{item.address || item.fullAddress}</span>
                    </div>
                    {item.phone && item.phone !== "No disponible" && (
                      <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-transparent hover:border-indigo-100 hover:bg-white transition-all group/phone">
                        <div className="flex items-center gap-3">
                          <Phone className="w-4 h-4 text-indigo-500" />
                          <a href={`tel:${item.phone}`} className="text-sm font-black tracking-tight text-slate-800 hover:text-indigo-600 transition-colors">
                            {item.phone}
                          </a>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleCopyPhone(item.phone || '', cardId); }} className="p-2 text-slate-300 hover:text-indigo-500 transition-colors">
                          {copiedId === cardId ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </div>
                  {item.aiSummary && (
                    <div className="mt-6 bg-violet-50 p-5 rounded-3xl border border-violet-100">
                      <p className="text-[10px] font-black text-violet-600 uppercase mb-2"> Análisis Gemini </p>
                      <p className="text-xs text-violet-900 italic font-bold">"{item.aiSummary}"</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-50">
                    {item.website ? (
                      <a href={item.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-indigo-600 text-[11px] font-black flex items-center gap-2 uppercase hover:underline"> <Globe className="w-4 h-4" /> Visitar Web </a>
                    ) : <span className="text-slate-300 text-[10px] font-black uppercase">Sin Sitio Web</span>}
                    <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="bg-slate-50 p-3 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all hover:bg-indigo-50"> <ExternalLink className="w-5 h-5" /> </a>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-center pt-12 pb-24">
            <button
              onClick={() => handleScrape(undefined, lastQuery, true)}
              disabled={isScraping || results.length === 0}
              className="group flex flex-col items-center gap-4 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <div className="bg-slate-900 text-white w-20 h-20 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-200 group-hover:bg-indigo-600 transition-colors">
                {isScraping ? <Loader2 className="w-8 h-8 animate-spin" /> : <PlusCircle className="w-10 h-10" />}
              </div>
              <div className="text-center">
                <p className="font-black text-slate-800 uppercase tracking-tighter">Extraer más leads frescos</p>
                <p className="text-[10px] font-bold text-slate-400 italic">Siguiente página de Google Maps (20+ resultados)</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;