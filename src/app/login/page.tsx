"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const resendVerification = useAuthStore((state) => state.resendVerification);

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Affiché uniquement si la connexion échoue parce que l'email n'a pas
  // encore été confirmé, pour proposer directement de le renvoyer
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResendMessage("");
    setNeedsVerification(false);
    setLoading(true);

    const result = await login(form);

    setLoading(false);

    if (result.success) {
      router.push("/");
    } else {
      setError(result.message);
      setNeedsVerification(!!result.needsVerification);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    const result = await resendVerification(form.email);
    setLoading(false);
    setResendMessage(result.message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-center mb-4">Connexion</h1>

        <input
          type="email"
          placeholder="Email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="border border-zinc-300 rounded-lg px-4 py-3"
        />
        <input
          type="password"
          placeholder="Mot de passe"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="border border-zinc-300 rounded-lg px-4 py-3"
        />

        <a
          href="/forgot-password"
          className="text-accent-600 text-sm font-medium self-end -mt-2"
        >
          Mot de passe oublié ?
        </a>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {needsVerification && (
          <div className="text-sm bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded-lg p-3">
            {resendMessage || "Ton email n'est pas encore confirmé."}
            {!resendMessage && (
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="block mt-1 font-medium underline disabled:opacity-50"
              >
                Renvoyer l&apos;email de confirmation
              </button>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-accent-600 text-white rounded-lg py-3 font-medium hover:bg-accent-700 transition disabled:opacity-50"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>

        <p className="text-sm text-center text-zinc-500">
          Pas encore de compte ?{" "}
          <a href="/signup" className="text-accent-600 font-medium">
            S&apos;inscrire
          </a>
        </p>
      </form>
    </div>
  );
}