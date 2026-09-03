"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";

export default function ForgotPasswordPage() {
  const forgotPassword = useAuthStore((state) => state.forgotPassword);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await forgotPassword(email);
    setLoading(false);
    setMessage(result.message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-center mb-2">
          Mot de passe oublié
        </h1>
        <p className="text-sm text-zinc-500 text-center mb-2">
          Indique ton adresse email, on t&apos;envoie un lien pour en choisir
          un nouveau.
        </p>

        {message ? (
          <p className="text-sm text-center text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3">
            {message}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-zinc-300 rounded-lg px-4 py-3"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 text-white rounded-lg py-3 font-medium hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? "Envoi..." : "Envoyer le lien"}
            </button>
          </form>
        )}

        <p className="text-sm text-center text-zinc-500">
          <a href="/login" className="text-indigo-600 font-medium">
            Retour à la connexion
          </a>
        </p>
      </div>
    </div>
  );
}
