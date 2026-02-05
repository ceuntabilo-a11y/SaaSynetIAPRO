
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import AdminPanel from './components/AdminPanel';
import Dashboard from './components/Dashboard';
import { AppView, UserSession } from './types';
import { LayoutDashboard, ShieldCheck, LogOut, Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('login');
  const [session, setSession] = useState<UserSession | null>(null);

  // Efecto para verificar sesión persistente (Simulado)
  useEffect(() => {
    const savedSession = localStorage.getItem('scraper_session');
    if (savedSession) {
      const parsed = JSON.parse(savedSession);
      // Verificar si ha expirado
      if (parsed.expiryDate && Date.now() > parsed.expiryDate && !parsed.isAdmin) {
        handleLogout();
      } else {
        setSession(parsed);
        setView(parsed.isAdmin ? 'admin' : 'dashboard');
      }
    }
  }, []);

  const handleLogin = (userSession: UserSession) => {
    setSession(userSession);
    localStorage.setItem('scraper_session', JSON.stringify(userSession));
    setView(userSession.isAdmin ? 'admin' : 'dashboard');
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('scraper_session');
    setView('login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      {/* Navegación para usuarios autenticados */}
      {session && (
        <nav className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-4 flex justify-between items-center sticky top-0 z-50">
          <div className="flex items-center gap-3 font-black text-2xl tracking-tighter">
            <div className="bg-indigo-600 p-1.5 rounded-xl shadow-lg shadow-indigo-100">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-slate-900">SaaSynetIA <span className="text-indigo-600">Scraper</span></span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="hidden md:flex flex-col items-end leading-none">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Usuario Activo</span>
              <span className="text-slate-800 font-bold">{session.email}</span>
            </div>
            {session.isAdmin && (
              <button 
                onClick={() => setView(view === 'admin' ? 'dashboard' : 'admin')}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-700 rounded-2xl font-black text-xs hover:bg-indigo-100 transition-all active:scale-95"
              >
                <ShieldCheck className="w-4 h-4" />
                {view === 'admin' ? 'VOLVER AL SCRAPER' : 'PANEL CONTROL'}
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-rose-500 font-black text-xs transition-colors group"
            >
              <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              SALIR
            </button>
          </div>
        </nav>
      )}

      <main className="flex-grow">
        {view === 'login' && <Login onLogin={handleLogin} />}
        {view === 'admin' && session?.isAdmin && <AdminPanel />}
        {view === 'dashboard' && session && <Dashboard />}
      </main>

      <footer className="bg-white border-t border-slate-100 py-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-4 text-slate-200">
            <div className="h-[1px] w-12 bg-slate-100"></div>
            <Sparkles className="w-4 h-4" />
            <div className="h-[1px] w-12 bg-slate-100"></div>
          </div>
          <p className="text-slate-400 text-xs font-medium tracking-widest uppercase">
            Desarrollado por <span className="text-indigo-600 font-black">SynetIA</span>
          </p>
          <p className="text-[10px] text-slate-300 font-bold">
            &copy; {new Date().getFullYear()} &bull; Inteligencia en Extracción de Datos
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
