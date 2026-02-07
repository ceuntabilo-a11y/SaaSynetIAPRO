import React, { useState } from "react";
import { UserSession } from "../types";
import { KeyRound, Mail, ArrowRight, AlertCircle } from "lucide-react";

interface LoginProps {
  onLogin: (session: UserSession) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      // 🔹 Intentar login ADMIN primero
      const adminRes = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user: username,
          pass: code,
        }),
      });

      const adminData = await adminRes.json();

      if (adminRes.ok && adminData?.ok) {
        localStorage.setItem("admin_token", adminData.token);

        onLogin({
          email: username,
          isAdmin: true,
        } as any);

        return;
      }

      // 🔹 Si no es admin, intentar como usuario normal
      const userRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username,
          code: code,
        }),
      });

      const userData = await userRes.json();

      if (!userRes.ok || !userData?.ok) {
        setError(
          userData?.error ||
            "Credenciales inválidas. Contacta al administrador."
        );
        return;
      }

      localStorage.setItem("user_sessionToken", userData.sessionToken);
      localStorage.setItem("user_session", JSON.stringify(userData.session));

      onLogin({
        email: username,
        isAdmin: false,
        expiryDate: userData.session?.expiresAt,
      } as any);
    } catch (err) {
      setError("Error de conexión. Intenta nuevamente.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-120px)] p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
        <div className="text-center mb-8">
          <div className="bg-indigo-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            Acceso al Software
          </h1>
          <p className="text-slate-500 mt-2">
            Ingresa tus credenciales
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Usuario
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                required
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                placeholder="Ingresa tu usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Código o Clave
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password"
                required
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                placeholder="Código usuario o clave admin"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold text-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
          >
            Entrar
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
