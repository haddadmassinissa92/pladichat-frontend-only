import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="h-dvh flex flex-col items-center justify-center text-center p-6 bg-white dark:bg-zinc-950">
      <FileQuestion
        size={56}
        strokeWidth={1.5}
        className="text-accent-600 mb-4"
      />
      <h1 className="text-2xl font-bold mb-2">Page introuvable</h1>
      <p className="text-sm text-zinc-500 max-w-sm mb-6">
        Cette page n&apos;existe pas ou plus. Elle a peut-être été déplacée,
        ou l&apos;adresse contient une erreur.
      </p>
      <Link
        href="/"
        className="bg-accent-600 hover:bg-accent-700 transition text-white rounded-full px-6 py-2.5 text-sm font-medium"
      >
        Retour à PladiChat
      </Link>
    </div>
  );
}
