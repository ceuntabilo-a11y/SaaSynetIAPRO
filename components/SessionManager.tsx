import React, { useState, useEffect } from 'react';
import {
  FolderOpen, Plus, Trash2, Edit2, Check, X,
  Users, Clock, Sparkles, ChevronRight, Download,
  Upload, Circle, Save,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface SessionLead {
  _id: string;
  name: string;
  phone?: string;
  website?: string;
  address?: string;
  fullAddress?: string;
  categoryName?: string;
  stars?: number | string;
  reviewsCount?: number | string;
  url?: string;
  email?: string;
  aiScore?: string;
  aiSummary?: string;
  lat?: number;
  lng?: number;
  crm?: { status: string; note: string; updatedAt: number };
}

export interface Session {
  id: string;
  name: string;
  color: string;
  leads: SessionLead[];
  keyword: string;
  zone: string;
  createdAt: number;
  updatedAt: number;
  enriched: boolean;
}

const STORAGE_KEY = 'saasynet_sessions_v1';
const SESSION_COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#7c3aed', '#db2777', '#0284c7',
];

const COLOR_NAMES: Record<string, string> = {
  '#4f46e5': 'Índigo', '#0891b2': 'Cian', '#059669': 'Verde',
  '#d97706': 'Ámbar', '#dc2626': 'Rojo', '#7c3aed': 'Violeta',
  '#db2777': 'Rosa', '#0284c7': 'Azul',
};

export const loadSessions = (): Session[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
};

export const saveSessions = (sessions: Session[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
};

const uniqueId = () => Math.random().toString(36).slice(2, 9);

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ─── Props ────────────────────────────────────────────────────────────────────
interface SessionManagerProps {
  currentLeads: SessionLead[];
  currentKeyword: string;
  currentZone: string;
  onLoadSession: (leads: SessionLead[]) => void;
  onClose: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────
const SessionManager: React.FC<SessionManagerProps> = ({
  currentLeads, currentKeyword, currentZone, onLoadSession, onClose,
}) => {
  const [sessions, setSessions] = useState<Session[]>(loadSessions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(SESSION_COLORS[0]);
  const [editZone, setEditZone] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sessions' | 'save'>('sessions');
  const [newName, setNewName] = useState(currentKeyword || 'Nueva sesión');
  const [newColor, setNewColor] = useState(SESSION_COLORS[0]);
  const [newZone, setNewZone] = useState(currentZone || '');
  const [flash, setFlash] = useState('');

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  };

  const persist = (updated: Session[]) => {
    setSessions(updated);
    saveSessions(updated);
  };

  // ── Guardar sesión nueva ──────────────────────────────────────────────────
  const saveNew = () => {
    if (!newName.trim()) return;
    if (currentLeads.length === 0) { showFlash('No hay leads para guardar.'); return; }
    const session: Session = {
      id: uniqueId(),
      name: newName.trim(),
      color: newColor,
      leads: currentLeads,
      keyword: currentKeyword,
      zone: newZone.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enriched: currentLeads.some(l => l.aiScore || l.email),
    };
    persist([session, ...sessions]);
    showFlash(`✅ Sesión "${session.name}" guardada con ${session.leads.length} leads`);
    setActiveTab('sessions');
  };

  // ── Cargar sesión ─────────────────────────────────────────────────────────
  const loadSession = (s: Session) => {
    onLoadSession(s.leads);
    onClose();
  };

  // ── Fusionar leads actuales en sesión existente ───────────────────────────
  const mergeInto = (sessionId: string) => {
    if (currentLeads.length === 0) { showFlash('No hay leads nuevos para agregar.'); return; }
    const updated = sessions.map(s => {
      if (s.id !== sessionId) return s;
      // Deduplicar por nombre+dirección
      const existingKeys = new Set(s.leads.map(l => `${l.name}|${l.address}`));
      const newLeads = currentLeads.filter(l => !existingKeys.has(`${l.name}|${l.address}`));
      return {
        ...s,
        leads: [...s.leads, ...newLeads],
        updatedAt: Date.now(),
        enriched: s.enriched || newLeads.some(l => l.aiScore || l.email),
      };
    });
    persist(updated);
    setMergeTargetId(null);
    const target = sessions.find(s => s.id === sessionId);
    showFlash(`✅ ${currentLeads.length} leads agregados a "${target?.name}"`);
  };

  // ── Eliminar lead individual de sesión ────────────────────────────────────
  const deleteLead = (sessionId: string, leadId: string) => {
    const updated = sessions.map(s => {
      if (s.id !== sessionId) return s;
      return { ...s, leads: s.leads.filter(l => l._id !== leadId), updatedAt: Date.now() };
    });
    persist(updated);
  };

  // ── Eliminar sesión completa ──────────────────────────────────────────────
  const deleteSession = (id: string) => {
    persist(sessions.filter(s => s.id !== id));
    setConfirmDelete(null);
  };

  // ── Editar nombre/color/zona ──────────────────────────────────────────────
  const startEdit = (s: Session) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditColor(s.color);
    setEditZone(s.zone);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const updated = sessions.map(s =>
      s.id === editingId ? { ...s, name: editName.trim(), color: editColor, zone: editZone.trim(), updatedAt: Date.now() } : s
    );
    persist(updated);
    setEditingId(null);
  };

  // ── Exportar sesión como JSON ─────────────────────────────────────────────
  const exportSession = (s: Session) => {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sesion_${s.name.replace(/\s+/g, '_')}_${Date.now()}.json`;
    a.click();
  };

  // ── Importar sesión desde JSON ────────────────────────────────────────────
  const importSession = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string) as Session;
          if (!data.leads || !data.name) throw new Error('Formato inválido');
          const imported: Session = { ...data, id: uniqueId(), createdAt: Date.now(), updatedAt: Date.now() };
          persist([imported, ...sessions]);
          showFlash(`✅ Sesión "${imported.name}" importada con ${imported.leads.length} leads`);
        } catch { showFlash('❌ Archivo inválido.'); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  // Suppress leaflet z-index while modal is open
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'session-modal-fix';
    style.textContent = `.leaflet-pane, .leaflet-top, .leaflet-bottom { z-index: 1 !important; }`;
    document.head.appendChild(style);
    return () => { document.getElementById('session-modal-fix')?.remove(); };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-6 px-4 pb-4 overflow-y-auto">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl">

        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-200">
              <FolderOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">Sesiones Guardadas</h2>
              <p className="text-xs text-slate-400 font-medium">Se guardan en tu dispositivo · no se pierden al cerrar</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition rounded-xl hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Flash */}
        {flash && (
          <div className="mx-8 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-sm font-bold text-center">
            {flash}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mx-8 mt-5 bg-slate-100 p-1 rounded-2xl">
          <button onClick={() => setActiveTab('sessions')}
            className={`flex-1 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === 'sessions' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            📁 Mis sesiones ({sessions.length})
          </button>
          <button onClick={() => setActiveTab('save')}
            className={`flex-1 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === 'save' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            💾 Guardar sesión actual {currentLeads.length > 0 ? `(${currentLeads.length} leads)` : ''}
          </button>
        </div>

        <div className="px-8 py-6 space-y-4 max-h-[65vh] overflow-y-auto">

          {/* ── Tab: Guardar ── */}
          {activeTab === 'save' && (
            <div className="space-y-5">
              {currentLeads.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <Save className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="font-black">No hay leads en el área actual para guardar</p>
                  <p className="text-xs mt-1">Realiza una búsqueda primero</p>
                </div>
              )}
              {currentLeads.length > 0 && (
                <>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center gap-3">
                    <Users className="w-5 h-5 text-indigo-600 shrink-0" />
                    <div>
                      <p className="font-black text-indigo-800">{currentLeads.length} leads listos para guardar</p>
                      <p className="text-xs text-indigo-600">
                        {currentLeads.filter(l => l.aiScore || l.email).length > 0 ? '✨ Incluye leads enriquecidos con IA' : 'Sin enriquecer aún'}
                        {currentLeads.filter(l => !l.website).length > 0 && ` · ${currentLeads.filter(l => !l.website).length} sin web`}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Nombre de la sesión</label>
                    <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                      placeholder="Ej: Clínicas Caracas Norte, Restaurantes Providencia…"
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-semibold text-slate-700 outline-none focus:border-indigo-200 focus:bg-white transition" />
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Zona / Ciudad</label>
                    <input type="text" value={newZone} onChange={e => setNewZone(e.target.value)}
                      placeholder="Ej: Caracas, Santiago Centro, Providencia…"
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-semibold text-slate-700 outline-none focus:border-indigo-200 focus:bg-white transition" />
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-3">Color de la sesión</label>
                    <div className="flex flex-wrap gap-3">
                      {SESSION_COLORS.map(c => (
                        <button key={c} onClick={() => setNewColor(c)}
                          className="w-9 h-9 rounded-full border-4 transition-all hover:scale-110"
                          style={{ background: c, borderColor: newColor === c ? '#1e293b' : 'transparent' }}
                          title={COLOR_NAMES[c]} />
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-2 font-medium">Color seleccionado: <span className="font-black" style={{ color: newColor }}>{COLOR_NAMES[newColor]}</span></p>
                  </div>

                  <button onClick={saveNew}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-base hover:bg-indigo-600 transition shadow-xl active:scale-95 flex items-center justify-center gap-2">
                    <Save className="w-5 h-5" /> Guardar sesión
                  </button>

                  {/* Agregar a sesión existente */}
                  {sessions.length > 0 && (
                    <div className="pt-4 border-t border-slate-100">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">O agregar estos leads a una sesión existente</p>
                      <div className="space-y-2">
                        {sessions.map(s => (
                          <div key={s.id} className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100">
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
                              <div>
                                <p className="font-black text-slate-800 text-sm">{s.name}</p>
                                <p className="text-[10px] text-slate-400">{s.leads.length} leads · {s.zone || 'Sin zona'}</p>
                              </div>
                            </div>
                            {mergeTargetId === s.id ? (
                              <div className="flex gap-2">
                                <button onClick={() => mergeInto(s.id)}
                                  className="px-3 py-1.5 bg-emerald-500 text-white rounded-xl font-black text-xs hover:bg-emerald-400 transition">
                                  ✅ Confirmar
                                </button>
                                <button onClick={() => setMergeTargetId(null)}
                                  className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-xl font-black text-xs">
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setMergeTargetId(s.id)}
                                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl font-black text-xs hover:bg-indigo-100 transition flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Agregar
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Tab: Sesiones ── */}
          {activeTab === 'sessions' && (
            <div className="space-y-4">
              {/* Importar */}
              <div className="flex justify-end">
                <button onClick={importSession}
                  className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-black text-xs hover:bg-slate-200 transition">
                  <Upload className="w-3.5 h-3.5" /> Importar JSON
                </button>
              </div>

              {sessions.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                  <FolderOpen className="w-14 h-14 mx-auto mb-3 opacity-20" />
                  <p className="font-black text-lg">Sin sesiones guardadas</p>
                  <p className="text-sm mt-1">Haz una búsqueda y guárdala desde la pestaña "Guardar sesión"</p>
                </div>
              )}

              {sessions.map(s => (
                <div key={s.id} className="border-2 border-slate-100 rounded-[1.5rem] overflow-hidden hover:border-slate-200 transition">

                  {/* Franja de color */}
                  <div className="h-1.5" style={{ background: s.color }} />

                  <div className="p-5">
                    {/* Editar */}
                    {editingId === s.id ? (
                      <div className="space-y-3 mb-4">
                        <input value={editName} onChange={e => setEditName(e.target.value)}
                          className="w-full p-3 bg-slate-50 border-2 border-indigo-200 rounded-2xl font-black text-slate-800 outline-none text-sm" />
                        <input value={editZone} onChange={e => setEditZone(e.target.value)}
                          placeholder="Zona / Ciudad"
                          className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-semibold text-slate-700 outline-none text-sm focus:border-indigo-200" />
                        <div className="flex flex-wrap gap-2">
                          {SESSION_COLORS.map(c => (
                            <button key={c} onClick={() => setEditColor(c)}
                              className="w-7 h-7 rounded-full border-4 transition-all hover:scale-110"
                              style={{ background: c, borderColor: editColor === c ? '#1e293b' : 'transparent' }} />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={saveEdit}
                            className="flex-1 py-2 bg-emerald-500 text-white rounded-xl font-black text-xs hover:bg-emerald-400 transition flex items-center justify-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Guardar
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl font-black text-xs hover:bg-slate-200 transition">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: s.color + '20' }}>
                            <Circle className="w-5 h-5" style={{ color: s.color }} />
                          </div>
                          <div>
                            <h3 className="font-black text-slate-800 text-base leading-tight">{s.name}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {s.zone && <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">📍 {s.zone}</span>}
                              {s.keyword && <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-lg">🔍 {s.keyword}</span>}
                              {s.enriched && <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-2 py-0.5 rounded-lg">✨ IA</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEdit(s)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-indigo-50 transition">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => exportSession(s)} className="p-2 text-slate-400 hover:text-emerald-600 rounded-xl hover:bg-emerald-50 transition" title="Exportar JSON">
                            <Download className="w-4 h-4" />
                          </button>
                          {confirmDelete === s.id ? (
                            <div className="flex gap-1">
                              <button onClick={() => deleteSession(s.id)}
                                className="px-2 py-1 bg-red-500 text-white rounded-lg font-black text-[10px]">Borrar</button>
                              <button onClick={() => setConfirmDelete(null)}
                                className="px-2 py-1 bg-slate-200 text-slate-600 rounded-lg font-black text-[10px]">No</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(s.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                        <p className="font-black text-slate-800 text-lg leading-none">{s.leads.length}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Leads</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                        <p className="font-black text-slate-800 text-lg leading-none">{s.leads.filter(l => !l.website).length}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Sin web</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                        <p className="font-black text-slate-800 text-lg leading-none">{s.leads.filter(l => l.crm && l.crm.status !== 'nuevo').length}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Gestionados</p>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400 font-medium mb-4 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Actualizado: {formatDate(s.updatedAt)}
                    </p>

                    {/* Preview leads */}
                    <div className="space-y-1.5 mb-4 max-h-40 overflow-y-auto">
                      {s.leads.map(l => (
                        <div key={l._id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 group/lead">
                          <div className="flex items-center gap-2 min-w-0">
                            {l.aiScore && (
                              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md text-white shrink-0"
                                style={{ background: l.aiScore === 'Premium' ? '#7c3aed' : l.aiScore === 'Estándar' ? '#0891b2' : '#64748b' }}>
                                {l.aiScore}
                              </span>
                            )}
                            <span className="text-xs font-bold text-slate-700 truncate">{l.name}</span>
                            {!l.website && <span className="text-[9px] text-orange-500 font-black shrink-0">SIN WEB</span>}
                          </div>
                          <button onClick={() => deleteLead(s.id, l._id)}
                            className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover/lead:opacity-100 transition rounded-lg shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Botón cargar */}
                    <button onClick={() => loadSession(s)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm transition active:scale-95 text-white hover:opacity-90"
                      style={{ background: s.color }}>
                      <ChevronRight className="w-4 h-4" /> Cargar esta sesión
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionManager;
