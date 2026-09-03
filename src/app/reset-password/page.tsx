"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const resetPassword = useAuthStore((state) => state.resetPassword);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const result = await resetPassword(params.token, password);
    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-center mb-2">
          Nouveau mot de passe
        </h1>

        {success ? (
          <p className="text-sm text-center text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3">
            Mot de passe réinitialisé ! Redirection vers la connexion...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="Nouveau mot de passe"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-zinc-300 rounded-lg px-4 py-3"
            />
            <input
              type="password"
              placeholder="Confirme le mot de passe"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="border border-zinc-300 rounded-lg px-4 py-3"
            />

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 text-white rounded-lg py-3 font-medium hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? "Enregistrement..." : "Réinitialiser le mot de passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
