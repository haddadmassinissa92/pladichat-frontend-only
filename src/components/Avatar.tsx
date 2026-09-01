"use client";

import Image from "next/image";

// Composant Avatar réutilisable : affiche la photo de profil si elle existe,
// sinon un rond coloré avec une initiale en guise de repli. Utilisé pour les
// contacts, les groupes et le profil de l'utilisateur connecté, dans la
// sidebar comme dans l'en-tête de conversation.
export default function Avatar({
  src,
  fallback,
  colorClass,
  size = "w-10 h-10",
}: {
  src?: string;
  fallback: string;
  colorClass: string;
  size?: string;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={fallback}
        width={40}
        height={40}
        className={`${size} rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      className={`${size} rounded-full ${colorClass} text-white flex items-center justify-center font-semibold shrink-0`}
    >
      {fallback}
    </div>
  );
}
