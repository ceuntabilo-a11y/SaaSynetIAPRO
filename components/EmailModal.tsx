import React, { useState, useEffect } from "react";
import { X, Send, Loader2, CheckCircle2, Mail, Sparkles } from "lucide-react";
import { BusinessData } from "../types";

interface EmailModalProps {
  lead: BusinessData;
  onClose: () => void;
}

const WA_NUMBER = "56995012907";
const LINKEDIN_URL = "https://www.linkedin.com/in/orlando-mu%C3%B1oz-251a25284/";

// Convierte URLs en <a> clickeables y da estilo a listas numeradas
function textToHtmlParagraphs(text: string): string {
  return text
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => {
      const withLinks = l.replace(
        /(https?:\/\/[^\s)]+)/g,
        '<a href="$1" target="_blank" style="color:#1B4FD8;text-decoration:underline;">$1</a>'
      );
      if (/^\d+\./.test(l.trim())) {
        return `<p style="margin:0 0 10px;line-height:1.7;color:#1E293B;padding-left:12px;">${withLinks}</p>`;
      }
      return `<p style="margin:0 0 16px;line-height:1.7;color:#1E293B;">${withLinks}</p>`;
    })
    .join("");
}

function buildEmailHtml(body: string, senderName: string, leadName: string): string {
  const paragraphs = textToHtmlParagraphs(body);

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="UTF-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>SynetIA</title></head>
<body style="margin:0;padding:0;background-color:#ECEEF2;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ECEEF2">
<tr><td align="center" style="padding:32px 0 48px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;">

  <tr><td height="4" bgcolor="#1B4FD8" style="font-size:0;line-height:0;">&nbsp;</td></tr>

  <tr>
    <td bgcolor="#FFFFFF" style="padding:20px 32px;border-left:1px solid #E4E7EF;border-right:1px solid #E4E7EF;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="50%" valign="middle" style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#1B4FD8;">Synet<span style="color:#16A34A;">IA</span></td>
        <td width="50%" valign="middle" align="right" style="font-family:Arial,sans-serif;font-size:10px;color:#94A3B8;letter-spacing:2px;text-transform:uppercase;">SYNETIA.SITE</td>
      </tr></table>
    </td>
  </tr>

  <tr>
    <td bgcolor="#1B4FD8" style="padding:44px 32px 40px;">
      <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;"><tr>
        <td bgcolor="#2563EB" style="padding:7px 16px;border-radius:999px;">
          <table cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="6" height="6" bgcolor="#4ADE80" style="border-radius:50%;font-size:0;">&nbsp;</td>
            <td style="padding-left:8px;font-family:Arial,sans-serif;font-size:10px;color:#BFDBFE;letter-spacing:2px;text-transform:uppercase;">PROPUESTA DE SERVICIOS DIGITALES</td>
          </tr></table>
        </td>
      </tr></table>
      <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:34px;font-weight:bold;font-style:italic;color:#FFFFFF;line-height:1.15;">Tecnolog&iacute;a que impulsa<br>tu negocio.</p>
      <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#BFDBFE;line-height:1.75;">Presencia digital profesional, automatizaci&oacute;n con inteligencia artificial<br>y herramientas a medida &mdash; para cualquier negocio, en cualquier parte del mundo.</p>
    </td>
  </tr>

  <tr>
    <td bgcolor="#1E3A8A" style="padding:0;border-left:1px solid #1B4FD8;border-right:1px solid #1B4FD8;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="148" align="center" style="padding:18px 8px;">
          <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:17px;font-style:italic;color:#FFFFFF;">Web</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:9px;color:#93C5FD;letter-spacing:1px;text-transform:uppercase;">Dise&ntilde;o &amp; Dev</p>
        </td>
        <td width="1" bgcolor="#3B5BA5" style="font-size:0;">&nbsp;</td>
        <td width="148" align="center" style="padding:18px 8px;">
          <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:17px;font-style:italic;color:#FFFFFF;">IA</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:9px;color:#93C5FD;letter-spacing:1px;text-transform:uppercase;">Agentes 24/7</p>
        </td>
        <td width="1" bgcolor="#3B5BA5" style="font-size:0;">&nbsp;</td>
        <td width="148" align="center" style="padding:18px 8px;">
          <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:17px;font-style:italic;color:#FFFFFF;">Global</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:9px;color:#93C5FD;letter-spacing:1px;text-transform:uppercase;">Alcance mundial</p>
        </td>
        <td width="1" bgcolor="#3B5BA5" style="font-size:0;">&nbsp;</td>
        <td width="148" align="center" style="padding:18px 8px;">
          <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:17px;font-style:italic;color:#FFFFFF;">E-com</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:9px;color:#93C5FD;letter-spacing:1px;text-transform:uppercase;">Tiendas online</p>
        </td>
      </tr></table>
    </td>
  </tr>

  <tr>
    <td bgcolor="#FFFFFF" style="padding:36px 32px 20px;border-left:1px solid #E4E7EF;border-right:1px solid #E4E7EF;">
      <p style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:15px;color:#1E293B;">Estimado/a <strong style="color:#1B4FD8;">${leadName}</strong>,</p>
      ${paragraphs}
    </td>
  </tr>

  <tr>
    <td bgcolor="#FFFFFF" style="padding:0 32px 16px;border-left:1px solid #E4E7EF;border-right:1px solid #E4E7EF;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="3" bgcolor="#1B4FD8" style="font-size:0;">&nbsp;</td>
        <td bgcolor="#F0F4FF" style="padding:22px 24px;">
          <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:9px;color:#1B4FD8;letter-spacing:2px;text-transform:uppercase;font-weight:bold;">Presencia Digital</p>
          <p style="margin:0 0 10px;font-family:Georgia,serif;font-size:18px;font-style:italic;color:#1E293B;">P&aacute;ginas web, Landing Pages &amp; E-commerce</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#475569;line-height:1.78;">Dise&ntilde;o moderno, carga r&aacute;pida y posicionado en Google desde el primer d&iacute;a. Para tiendas, restaurantes, cl&iacute;nicas, startups &mdash; cualquier negocio que quiera <strong style="color:#1E293B;">captar m&aacute;s clientes y aumentar ventas</strong>.</p>
        </td>
      </tr></table>
    </td>
  </tr>

  <tr>
    <td bgcolor="#FFFFFF" style="padding:0 32px 32px;border-left:1px solid #E4E7EF;border-right:1px solid #E4E7EF;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="3" bgcolor="#16A34A" style="font-size:0;">&nbsp;</td>
        <td bgcolor="#F0FDF4" style="padding:22px 24px;">
          <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:9px;color:#16A34A;letter-spacing:2px;text-transform:uppercase;font-weight:bold;">Automatizaci&oacute;n Inteligente</p>
          <p style="margin:0 0 10px;font-family:Georgia,serif;font-size:18px;font-style:italic;color:#1E293B;">Agentes de IA &amp; Dashboards de Gesti&oacute;n</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#475569;line-height:1.78;">Agentes en WhatsApp que agendan citas, confirman asistencia y responden dudas las 24 horas &mdash; m&aacute;s dashboards conectados a su calendario. <strong style="color:#1E293B;">Sin intervenci&oacute;n manual.</strong></p>
        </td>
      </tr></table>
    </td>
  </tr>

  <tr>
    <td bgcolor="#EEF2FF" style="padding:22px 32px;border-left:1px solid #E4E7EF;border-right:1px solid #E4E7EF;border-top:1px solid #C7D2FE;border-bottom:1px solid #C7D2FE;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="middle" style="padding-right:20px;">
          <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:9px;color:#4F46E5;letter-spacing:2px;text-transform:uppercase;font-weight:bold;">Demos en vivo</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#475569;line-height:1.7;">Visita nuestra web para ver ejemplos reales: landing pages, corporativas y e-commerce.</p>
        </td>
        <td valign="middle" align="right" style="white-space:nowrap;">
          <table cellpadding="0" cellspacing="0" border="0"><tr>
            <td bgcolor="#4F46E5" style="border-radius:999px;padding:0;">
              <a href="https://synetia-demos.vercel.app/" target="_blank" style="display:inline-block;padding:11px 22px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;color:#FFFFFF;text-decoration:none;">Ver demos</a>
            </td>
          </tr></table>
        </td>
      </tr></table>
    </td>
  </tr>

  <tr>
    <td bgcolor="#FFFFFF" align="center" style="padding:30px 32px 36px;border-left:1px solid #E4E7EF;border-right:1px solid #E4E7EF;">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="#1E293B" style="border-radius:999px;">
          <a href="https://www.synetia.site" target="_blank" style="display:inline-block;padding:13px 26px;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:#FFFFFF;text-decoration:none;">Visitar synetia.site</a>
        </td>
        <td width="12">&nbsp;</td>
        <td style="border:2px solid #CBD5E1;border-radius:999px;">
          <a href="https://wa.me/${WA_NUMBER}" target="_blank" style="display:inline-block;padding:11px 26px;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:#1E293B;text-decoration:none;">Contactar por WhatsApp</a>
        </td>
      </tr></table>
    </td>
  </tr>

  <tr>
    <td bgcolor="#FFFFFF" style="padding:0 32px;border-left:1px solid #E4E7EF;border-right:1px solid #E4E7EF;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="#E4E7EF" style="font-size:0;">&nbsp;</td></tr></table>
    </td>
  </tr>

  <tr>
    <td bgcolor="#F8FAFC" style="padding:26px 32px;border-left:1px solid #E4E7EF;border-right:1px solid #E4E7EF;">
      <table cellpadding="0" cellspacing="0" border="0"><tr><td valign="top">
        <p style="margin:0 0 2px;font-family:Georgia,serif;font-size:15px;font-style:italic;color:#1E293B;">${senderName} &mdash; SynetIA</p>
        <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:9px;color:#94A3B8;letter-spacing:2px;text-transform:uppercase;">Soluciones Digitales &amp; IA</p>
        <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:12px;color:#64748B;line-height:1.9;">
          <a href="mailto:agencia@synetia.cloud" style="color:#1B4FD8;text-decoration:none;">agencia@synetia.cloud</a>
          &nbsp;&middot;&nbsp;
          <a href="https://www.synetia.site" style="color:#64748B;text-decoration:none;">www.synetia.site</a>
        </p>
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:8px;">
            <a href="${LINKEDIN_URL}" target="_blank" style="display:inline-block;padding:5px 14px;border:1px solid #CBD5E1;border-radius:999px;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;color:#475569;text-decoration:none;">LinkedIn</a>
          </td>
          <td>
            <a href="https://wa.me/${WA_NUMBER}" target="_blank" style="display:inline-block;padding:5px 14px;border:1px solid #CBD5E1;border-radius:999px;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;color:#475569;text-decoration:none;">WhatsApp</a>
          </td>
        </tr></table>
      </td></tr></table>
    </td>
  </tr>

  <tr>
    <td bgcolor="#F1F5F9" align="center" style="padding:18px 32px;border:1px solid #E4E7EF;border-top:none;">
      <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;color:#94A3B8;letter-spacing:1px;text-transform:uppercase;">&copy; 2026 SynetIA &nbsp;&middot;&nbsp; synetia.site &nbsp;&middot;&nbsp; agencia@synetia.cloud</p>
      <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;"><a href="#" style="color:#CBD5E1;text-decoration:underline;">Cancelar suscripci&oacute;n</a></p>
    </td>
  </tr>
  <tr><td height="32" bgcolor="#ECEEF2" style="font-size:0;">&nbsp;</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildDefaultBody(lead: BusinessData): string {
  const category = lead.categoryName || "su sector";

  return `Qué gusto saludarlo. He estado siguiendo de cerca su perfil y su liderazgo en ${category}, y se me ocurrió una iniciativa que creo que podría interesarle.

Formo parte de un estudio de diseño web enfocado en soluciones de alto nivel y, como nos interesa mucho conectar con CEOs que lideran proyectos con gran potencial, tenemos un pequeño obsequio para usted: nos gustaría diseñarle una propuesta de página web DEMO completamente a medida para su empresa, de forma gratuita y sin ningún tipo de compromiso.

No trabajamos con plantillas genéricas de plataformas como Wix o WordPress; todo nuestro desarrollo se realiza desde cero, adaptándonos por completo a los requerimientos y la identidad de quienes confían en nosotros.

Para poder armar esta propuesta visual y enviársela para que la revise con su equipo, solo necesitaría que me ayude respondiendo estas tres rápidas preguntas:

1. ¿A qué se dedica exactamente su negocio y cuál considera que es el principal punto de diferenciación de su empresa?
2. ¿Tienen colores corporativos definidos o un logotipo? (Si cuenta con los códigos hexadecimales de los colores o el logo, sería excelente. Si no, ¿con qué palabra describiría el estilo que busca para su marca: lujosa, moderna, seria, elegante, etc.?)
3. ¿Qué le gustaría que sienta un usuario al ingresar a su web por primera vez? (confianza, exclusividad, frescura, profesionalismo, seguridad, etc.)

Con estos tres detalles tendremos todo lo necesario para ponernos manos a la obra.

Mientras preparamos su propuesta, lo invito cordialmente a visitar nuestro sitio web (https://synetia-demos.vercel.app/), donde podrá explorar con más detalle otros servicios adicionales, activos y el tipo de estructuras que desarrollamos para potenciar la presencia digital de marcas competitivas.

Quedo muy atento a sus comentarios para comenzar a trabajar en su diseño.

Un saludo afectuoso,`;
}

const EmailModal: React.FC<EmailModalProps> = ({ lead, onClose }) => {
  const [toEmail, setToEmail] = useState(lead.email || "");
  const [senderName, setSenderName] = useState("Orlando");
  const [subject, setSubject] = useState(
    `Una propuesta exclusiva para ${lead.name || "usted"} (un obsequio a medida)`
  );
  const [body, setBody] = useState(() => buildDefaultBody(lead));
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeDicom, setIncludeDicom] = useState(!!lead.aiDicom);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSend = async () => {
    if (!toEmail) return;
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toEmail,
          subject,
          html: buildEmailHtml(body, senderName, lead.name || "equipo"),
          includeDicom,
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
          <div>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Enviar Propuesta</p>
            <h2 className="text-lg font-black text-slate-800 leading-tight">{lead.name}</h2>
            {lead.email ? (
              <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                <Mail className="w-3 h-3" /> {lead.email}
              </p>
            ) : (
              <p className="text-xs text-amber-500 font-bold mt-0.5">Sin email detectado — ingrésalo manualmente</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {sent ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-12 text-center">
            <div className="bg-emerald-50 p-5 rounded-full">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            </div>
            <h3 className="text-xl font-black text-slate-800">¡Email enviado!</h3>
            <p className="text-slate-500 text-sm max-w-xs">
              El correo llegó a <strong>{toEmail}</strong>.
            </p>
            <button onClick={onClose} className="mt-4 px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-indigo-600 transition">
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-8 space-y-4">

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Para</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    placeholder="correo@empresa.com"
                    className={`w-full pl-10 pr-4 py-3.5 bg-slate-50 border-2 rounded-2xl outline-none text-sm font-semibold text-slate-800 focus:border-indigo-300 transition ${!toEmail ? "border-amber-200" : "border-slate-100"}`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tu nombre en la firma</label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Orlando"
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none text-sm font-semibold text-slate-800 focus:border-indigo-300 transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asunto</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none text-sm font-semibold text-slate-800 focus:border-indigo-300 transition"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mensaje</label>
                  <span className="text-[10px] text-indigo-400 font-bold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Prellenado con datos del lead
                  </span>
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none text-sm text-slate-700 font-medium resize-none focus:border-indigo-300 transition leading-relaxed"
                />
                <p className="text-[10px] text-slate-400">Los saltos de línea y URLs se convierten automáticamente en el email.</p>
              </div>

              {/* DICOM checkbox — solo visible si el lead es candidato */}
              {lead.aiDicom && (
                <div
                  onClick={() => setIncludeDicom(!includeDicom)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${includeDicom ? "bg-blue-50 border-blue-300" : "bg-slate-50 border-slate-100"}`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${includeDicom ? "bg-blue-600 border-blue-600" : "border-slate-300"}`}>
                    {includeDicom && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <div>
                    <p className={`text-sm font-black ${includeDicom ? "text-blue-700" : "text-slate-600"}`}>
                      📎 Adjuntar Brochure + Manual DICOM
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Este lead es candidato DICOM — se adjuntarán 2 PDFs de SynetIA DICOM Relay
                    </p>
                  </div>
                </div>
              )}

              {lead.aiSummary && (
                <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
                  <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-2">Análisis IA del lead</p>
                  <p className="text-xs text-violet-800 italic">"{lead.aiSummary}"</p>
                </div>
              )}

              {error && (
                <div className="bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl p-4 text-sm font-medium">
                  {error}
                </div>
              )}
            </div>

            <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
              <div className="text-[10px] text-slate-400 font-medium leading-relaxed">
                <span className="font-black text-slate-600">Desde:</span> hola@synetia.site<br />
                <span className="font-black text-slate-600">Para:</span> {toEmail || <span className="text-amber-500">sin correo aún</span>}
              </div>
              <button
                onClick={handleSend}
                disabled={isSending || !subject.trim() || !body.trim() || !toEmail.trim()}
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
