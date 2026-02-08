import React, { useEffect, useState } from "react";
import { AccessCode, ScraperSettings } from "../types";
import { Trash2, Settings, Key, ExternalLink } from "lucide-react";

const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"codes" | "settings">("codes");
  const [codes, setCodes] = useState<AccessCode[]>([]);

  // UI actual usa horas (24 / 168 / 720)
  const [durationHours, setDurationHours] = useState(24);

  // Configuración de Scraper (lo mantengo igual)
  const [apiKey, setApiKey] = useState("");
  const [maxResults, setMaxResults] = useState(20);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const savedCodes = localStorage.getItem("access_codes");
    if (savedCodes) setCodes(JSON.parse(savedCodes));

    const savedSettings = localStorage.getItem("scraper_settings");
    if (savedSettings) {
      const settings: ScraperSettings = JSON.parse(savedSettings);
      setApiKey(settings.apiKey || "");
      setMaxResults(settings.maxResults || 20);
    }
  }, []);

  const saveCodes = (newCodes: AccessCode[]) => {
    setCodes(newCodes);
    localStorage.setItem("access_codes", JSON.stringify(newCodes));
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const settings: ScraperSettings = {
      apiKey: apiKey.trim(),
      maxResults: Number(maxResults),
    };
    localStorage.setItem("scraper_settings", JSON.stringify(settings));
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setIsSaving(false);
    }, 2000);
  };

  function hoursToDays(h: number): 1 | 7 | 30 {
    if (h === 24) return 1;
    if (h === 168) return 7;
    return 30; // 720
  }

  const generateCode = async () => {
    const adminToken = localStorage.getItem("admin_token");
    if (!adminToken) {
      alert("No hay sesión admin. Sal y vuelve a entrar como administrador.");
      return;
    }

    try {
      const durationDays = hoursToDays(durationHours);

      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          durationDays,
          // No amarramos a username (tu caso: el usuario lo inventa)
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok || !data?.record?.code) {
        alert(data?.error || "No se pudo generar el código.");
        return;
      }

      // Convertimos el record del backend a tu tipo AccessCode (front)
      const rec = data.record;

      const newCode: AccessCode = {
        id: rec.codeKey || rec.code, // algo único
        code: rec.code,
        durationHours: durationDays === 1 ? 24 : durationDays === 7 ? 168 : 720,
        createdAt: rec.createdAt,
        expiresAt: rec.expiresAt,
        isActive: true,
      };

      saveCodes([newCode, ...codes]);
    } catch (e) {
      alert("Error de conexión generando código.");
    }
  };

  const deleteCode = (id: string) => {
    if (window.confirm("¿Eliminar este acceso (solo de la lista local)?")) {
      saveCodes(codes.filter((c) => c.id !== id));
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 animate-fadeIn">
      <div className="flex border-b border-slate-200 mb-8">
        <button
          onClick={() => setActiveTab("codes")}
          className={`px-6 py-4 font-bold text-sm flex items-center gap-2 transition ${
            activeTab === "codes"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-slate-400"
          }`}
        >
          <Key className="w-4 h-4" /> Accesos
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-6 py-4 font-bold text-sm flex items-center gap-2 transition ${
            activeTab === "settings"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-slate-400"
          }`}
        >
          <Settings className="w-4 h-4" /> Motor API
        </button>
      </div>

      {activeTab === "codes" ? (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-800">
                Licencias del SaaS
              </h1>
              <p className="text-slate-500 text-sm">
                Genera códigos válidos (guardados en Vercel KV) para que funcionen en PC y móvil.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
              <select
                className="bg-slate-50 p-2 rounded-xl text-xs font-bold outline-none"
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
              >
                <option value={24}>24 Horas</option>
                <option value={168}>1 Semana</option>
                <option value={720}>1 Mes</option>
              </select>

              <button
                onClick={generateCode}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition"
              >
                + Crear Código
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <tr>
                  <th className="px-8 py-4">Código</th>
                  <th className="px-8 py-4">Expiración</th>
                  <th className="px-8 py-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {codes.map((c) => (
                  <tr key={c.id} className="text-sm font-medium text-slate-600">
                    <td className="px-8 py-4 font-mono font-bold text-indigo-600">
                      {c.code}
                    </td>
                    <td className="px-8 py-4 text-xs">
                      {new Date(c.expiresAt).toLocaleString()}
                    </td>
                    <td className="px-8 py-4 text-right">
                      <button
                        onClick={() => deleteCode(c.id)}
                        className="text-slate-300 hover:text-red-500 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {codes.length === 0 && (
                  <tr>
                    <td className="px-8 py-6 text-sm text-slate-400" colSpan={3}>
                      Aún no hay códigos en la lista local. Crea uno.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="max-w-xl bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
          <h2 className="text-2xl font-black text-slate-800 mb-2">
            Configuración del Motor
          </h2>
          <p className="text-slate-500 text-sm mb-8">
            Estamos usando SerpApi por su velocidad y gratuidad.
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                SerpApi Key
              </label>
              <input
                type="password"
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-600 transition"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Pega tu API Key de serpapi.com"
                required
              />
              <a
                href="https://serpapi.com/dashboard"
                target="_blank"
                className="text-[10px] text-indigo-500 font-bold flex items-center gap-1 mt-1"
              >
                Obtén tu clave gratis aquí <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className={`w-full py-4 rounded-2xl font-black text-sm transition ${
                saveSuccess
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-900 text-white"
              }`}
            >
              {saveSuccess
                ? "¡Configuración Guardada!"
                : isSaving
                ? "Guardando..."
                : "Guardar Cambios"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;