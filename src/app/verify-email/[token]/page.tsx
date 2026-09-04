"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

export default function VerifyEmailPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const verifyEmail = useAuthStore((state) => state.verifyEmail);

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const run = async () => {
      const result = await verifyEmail(params.token);
      if (result.success) {
        setStatus("success");
        // Petite pause pour laisser le message de succès s'afficher, avant
        // d'envoyer directement dans l'application (déjà connecté)
        setTimeout(() => router.push("/"), 1500);
      } else {
        setStatus("error");
        setMessage(result.message);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm text-center flex flex-col gap-4">
        {status === "loading" && (
          <p className="text-zinc-500">Confirmation en cours...</p>
        )}
        {status === "success" && (
          <>
            <h1 className="text-2xl font-bold">Email confirmé ✅</h1>
            <p className="text-sm text-zinc-500">
              Ton compte est activé, tu vas être redirigé...
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="text-2xl font-bold">Lien invalide</h1>
            <p className="text-sm text-red-600">{message}</p>
            <a href="/login" className="text-accent-600 font-medium text-sm mt-2">
              Retour à la connexion
            </a>
          </>
        )}
      </div>
    </div>
  );
}
