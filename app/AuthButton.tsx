"use client";

import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { User } from "@supabase/supabase-js";

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isRegistering) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setIsOpen(false);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else setIsOpen(false);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline text-xs text-white bg-black/40 px-3 py-2 rounded border-2 border-black font-bold">
          {user.email}
        </span>
        <button
          onClick={handleLogout}
          style={{ fontFamily: "var(--font-retro)" }}
          className="bg-neutral-800 hover:bg-neutral-700 text-white text-xs px-3 py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
        >
          SALIR
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{ fontFamily: "var(--font-retro)" }}
        className="bg-yellow-400 hover:bg-yellow-300 text-black text-xs px-4 py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
      >
        LOGIN
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#DEDEDE] p-4 rounded-lg border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md w-full">
            <div className="bg-[#1a1c19] text-[#e0f8cf] border-4 border-black p-6 space-y-4">
              <div className="flex justify-between items-center border-b-2 border-[#588157] pb-3">
                <h3 style={{ fontFamily: "var(--font-retro)" }} className="text-xs text-yellow-400">
                  {isRegistering ? "NUEVO ENTRENADOR" : "ACCESO POKéDEX"}
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-red-400 hover:text-red-300 font-bold text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <label className="block text-xs text-[#84a98c] uppercase mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#262b25] border-2 border-[#588157] p-2 text-white text-sm focus:border-yellow-400 outline-none"
                    placeholder="ash@pueblo-paleta.com"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#84a98c] uppercase mb-1">Contraseña (mín. 6 caracteres)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#262b25] border-2 border-[#588157] p-2 text-white text-sm focus:border-yellow-400 outline-none"
                    placeholder="••••••"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-400 bg-red-950/50 border border-red-500 p-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{ fontFamily: "var(--font-retro)" }}
                  className="w-full bg-yellow-400 hover:bg-yellow-300 text-black text-xs py-3 border-2 border-black font-bold cursor-pointer disabled:opacity-50"
                >
                  {loading ? "CARGANDO..." : isRegistering ? "REGISTRARSE" : "ENTRAR"}
                </button>
              </form>

              <div className="text-center pt-2 border-t border-[#262b25]">
                <button
                  type="button"
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="text-xs text-[#84a98c] hover:text-yellow-400 underline cursor-pointer"
                >
                  {isRegistering
                    ? "¿Ya tenés cuenta? Iniciá sesión acá"
                    : "¿No tenés cuenta? Registrate acá"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}