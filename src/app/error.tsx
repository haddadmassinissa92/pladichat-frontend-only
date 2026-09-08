"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="h-dvh flex flex-col items-center justify-center text-center p-6 bg-white dark:bg-zinc-950">
      <AlertTriangle
        size={56}
        strokeWidth={1.5}
        className="text-red-600 mb-4"
      />
      <h1 className="text-2xl font-bold mb-2">Une erreur est survenue</h1>
      <p className="text-sm text-zinc-500 max-w-sm mb-6">
        Quelque chose s&apos;est mal passé. Tu peux réessayer, ou recharger
        la page si le problème persiste.
      </p>
      <button
        onClick={reset}
        className="bg-accent-600 hover:bg-accent-700 transition text-white rounded-full px-6 py-2.5 text-sm font-medium"
      >
        Réessayer
      </button>
    </div>
  );
}
