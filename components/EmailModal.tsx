import React, { useState, useEffect } from "react";
import { X, Send, Loader2, CheckCircle2, Mail, Sparkles } from "lucide-react";
import { BusinessData } from "../types";

interface EmailModalProps {
  lead: BusinessData;
  onClose: () => void;
}

// ─── Genera el HTML del email (lo que Resend envía) ──────────────────────────
function buildEmailHtml(subject: string, body: string): string {
  // Convierte saltos de línea en párrafos HTML para el email
  const paragraphs = body
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => `<p style="margin:0 0 16px;line-height:1.7;color:#1e293b;">${l}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:48px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:#0a0a0f;padding:32px 40px;text-align:left;">
            <span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
              Synet<span style="color:#6366f1;">IA</span>
            </span>
            <p style="margin:6px 0 0;font-size:11px;color:#6b7280;letter-spacing:2px;text-transform:uppercase;">Estudio de Diseño Web · LATAM</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            ${paragraphs}
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 40px 40px;">
            <a href="https://synetia-demos.vercel.app" 
               style="display:inline-block;background:#6366f1;color:#ffffff;font-weight:800;font-size:14px;padding:14px 28px;border-radius:10px;text-decoration:none;letter-spacing:-0.2px;">
              Ver nuestro portafolio →
            </a>
          </td>
        </tr>

        <!-- Demos strip -->
        <tr>
          <td style="background:#f1f5f9;padding:24px 40px;border-top:1px solid #e2e8f0;">
            <p style="margin:0 0 12px;font-size:10px;font-weight:800;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;">Demos en vivo</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:16px;">
                  <a href="https://synetia-demos.vercel.app/demo-landing/index.html" style="font-size:12px;color:#6366f1;font-weight:700;text-decoration:none;">Landing · Brillia Dental →</a>
                </td>
                <td style="padding-right:16px;">
                  <a href="https://synetia-demos.vercel.app/demo-corporativa/index.html" style="font-size:12px;color:#6366f1;font-weight:700;text-decoration:none;">Corporativa · Mirum →</a>
                </td>
                <td>
                  <a href="https://synetia-demos.vercel.app/demo-ecommerce/index.html" style="font-size:12px;color:#6366f1;font-weight:700;text-decoration:none;">E-commerce · GBless →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #e2e8f0;text-align:left;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">© 2026 SynetIA · <a href="mailto:hola@synetia.site" style="color:#94a3b8;">hola@synetia.site</a></p>
            <p style="margin:4px 0 0;font-size:10px;color:#cbd5e1;">Si no deseas recibir más correos, responde con "No gracias" y te eliminamos de inmediato.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Genera el texto base del email según datos del lead ─────────────────────
function buildDefaultBody(lead: BusinessData): string {
  const name = lead.name || "equipo";
  const category = lead.categoryName || "negocio";
  const summary = lead.aiSummary || "";
  const services = lead.aiServices?.slice(0, 2).join(" y ") || "";

  // Párrafo de contexto basado en análisis IA si existe
  const contextLine = summary
    ? `Analizando su presencia online noté que ${summary.toLowerCase()}.`
    : `Revisando negocios del rubro ${category} en su zona, encontré ${name}.`;

  const servicesLine = services
    ? `En particular, creo que podrían beneficiarse de: ${services}.`
    : "";

  return `Hola, mi nombre es Orlando y trabajo con SynetIA, un estudio de diseño web enfocado en negocios de LATAM.

${contextLine} ${servicesLine}

Diseñamos landing pages, sitios corporativos y tiendas online que están hechos a mano — sin plantillas, sin shortcuts. El resultado es una web que refleja la calidad real de su negocio y convierte visitas en clientes.

Pueden ver tres demos en vivo en: synetia-demos.vercel.app

Si les interesa conversar 30 minutos sin compromiso para ver si tiene sentido trabajar juntos, estaré encantado.

Saludos,
Orlando
SynetIA · hola@synetia.site`;
}

// ─── Componente Modal ────────────────────────────────────────────────────────
const EmailModal: React.FC<EmailModalProps> = ({ lead, onClose }) => {
  const defaultSubject = `Propuesta web para ${lead.name}`;
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(() => buildDefaultBody(lead));
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cierra con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSend = async () => {
    if (!lead.email) return;
    setIsSending(true);
    setError(null);

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: lead.email,
          subject,
          html: buildEmailHtml(subject, body),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || "Error al enviar.");
        setIsSending(false);
        return;
      }

      setSent(true);
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
      setIsSending(false);
    }
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
          <div>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Enviar Propuesta</p>
            <h2 className="text-lg font-black text-slate-800 leading-tight">{lead.name}</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-1">
              <Mail className="w-3 h-3" /> {lead.email}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {sent ? (
          // ── Estado enviado ──
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-12 text-center">
            <div className="bg-emerald-50 p-5 rounded-full">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            </div>
            <h3 className="text-xl font-black text-slate-800">¡Email enviado!</h3>
            <p className="text-slate-500 text-sm max-w-xs">
              El correo llegó a <strong>{lead.email}</strong> desde <strong>hola@synetia.site</strong>.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-indigo-600 transition"
            >
              Cerrar
            </button>
          </div>
        ) : (
          // ── Formulario ──
          <>
            <div className="flex-1 overflow-y-auto p-8 space-y-5">

              {/* Asunto */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asunto</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none text-sm font-semibold text-slate-800 focus:border-indigo-300 transition"
                />
              </div>

              {/* Cuerpo */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mensaje</label>
                  <span className="text-[10px] text-indigo-400 font-bold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Prellenado con datos IA del lead
                  </span>
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none text-sm text-slate-700 font-medium resize-none focus:border-indigo-300 transition leading-relaxed"
                />
                <p className="text-[10px] text-slate-400">
                  Este texto es el cuerpo del email. Edítalo antes de enviar. Los saltos de línea se respetan en el email.
                </p>
              </div>

              {/* Datos del análisis IA como referencia */}
              {lead.aiSummary && (
                <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
                  <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-2">Contexto IA del lead</p>
                  <p className="text-xs text-violet-800 italic">"{lead.aiSummary}"</p>
                  {lead.aiServices && lead.aiServices.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {lead.aiServices.map((s, i) => (
                        <p key={i} className="text-[11px] text-violet-600 font-medium">→ {s}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl p-4 text-sm font-medium">
                  {error}
                </div>
              )}
            </div>

            {/* Footer con botón enviar */}
            <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
              <div className="text-[10px] text-slate-400 font-medium leading-relaxed">
                <span className="font-black text-slate-600">Desde:</span> hola@synetia.site<br />
                <span className="font-black text-slate-600">Para:</span> {lead.email}
              </div>
              <button
                onClick={handleSend}
                disabled={isSending || !subject.trim() || !body.trim()}
                className="flex items-center gap-2.5 bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-indigo-200"
              >
                {isSending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="w-4 h-4" /> Enviar Email</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmailModal;
