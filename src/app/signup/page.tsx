"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";

export default function SignupPage() {
  const signup = useAuthStore((state) => state.signup);

  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Une fois l'inscription réussie, on affiche un message "vérifie ta boîte
  // mail" à la place du formulaire, plutôt que de connecter directement
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signup(form);

    setLoading(false);

    if (result.success) {
      setSuccessMessage(result.message || "Compte créé ! Vérifie ta boîte mail.");
    } else {
      setError(result.message);
    }
  };

  if (successMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm text-center flex flex-col gap-4">
          <h1 className="text-2xl font-bold">Vérifie ta boîte mail 📬</h1>
          <p className="text-sm text-zinc-500">{successMessage}</p>
          <p className="text-xs text-zinc-400">
            Le lien de confirmation expire dans 24 heures. Pense à vérifier
            aussi tes spams si tu ne le vois pas.
          </p>
          <a
            href="/login"
            className="text-indigo-600 font-medium text-sm mt-2"
          >
            Retour à la connexion
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-center mb-4">Inscription</h1>

        <input
          type="text"
          placeholder="Nom d'utilisateur"
          required
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          className="border border-zinc-300 rounded-lg px-4 py-3"
        />
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

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 text-white rounded-lg py-3 font-medium hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {loading ? "Création..." : "S'inscrire"}
        </button>

        <p className="text-sm text-center text-zinc-500">
          Déjà un compte ?{" "}
          <a href="/login" className="text-indigo-600 font-medium">
            Se connecter
          </a>
        </p>
      </form>
    </div>
  );
}