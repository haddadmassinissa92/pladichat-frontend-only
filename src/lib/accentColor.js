// lib/accentColor.js
//
// Couleur d'accent de l'application (boutons, liens, bulles de message...),
// personnalisable et appliquée instantanément à toute l'app via des
// variables CSS (voir app/globals.css) — pas besoin de recharger la page.

export const ACCENT_COLORS = [
  {
    id: "indigo",
    label: "Indigo",
    swatch: "#4f46e5",
    shades: {
      50: "#eef2ff",
      100: "#e0e7ff",
      300: "#a5b4fc",
      400: "#818cf8",
      600: "#4f46e5",
      700: "#4338ca",
      900: "#312e81",
      950: "#1e1b4b",
    },
  },
  {
    id: "rose",
    label: "Rose",
    swatch: "#e11d48",
    shades: {
      50: "#fff1f2",
      100: "#ffe4e6",
      300: "#fda4af",
      400: "#fb7185",
      600: "#e11d48",
      700: "#be123c",
      900: "#881337",
      950: "#4c0519",
    },
  },
  {
    id: "emerald",
    label: "Émeraude",
    swatch: "#059669",
    shades: {
      50: "#ecfdf5",
      100: "#d1fae5",
      300: "#6ee7b7",
      400: "#34d399",
      600: "#059669",
      700: "#047857",
      900: "#064e3b",
      950: "#022c22",
    },
  },
  {
    id: "sky",
    label: "Ciel",
    swatch: "#0284c7",
    shades: {
      50: "#f0f9ff",
      100: "#e0f2fe",
      300: "#7dd3fc",
      400: "#38bdf8",
      600: "#0284c7",
      700: "#0369a1",
      900: "#0c4a6e",
      950: "#082f49",
    },
  },
  {
    id: "amber",
    label: "Ambre",
    swatch: "#d97706",
    shades: {
      50: "#fffbeb",
      100: "#fef3c7",
      300: "#fcd34d",
      400: "#fbbf24",
      600: "#d97706",
      700: "#b45309",
      900: "#78350f",
      950: "#451a03",
    },
  },
  {
    id: "violet",
    label: "Violet",
    swatch: "#7c3aed",
    shades: {
      50: "#f5f3ff",
      100: "#ede9fe",
      300: "#c4b5fd",
      400: "#a78bfa",
      600: "#7c3aed",
      700: "#6d28d9",
      900: "#4c1d95",
      950: "#2e1065",
    },
  },
];

export function getAccentColor() {
  if (typeof window === "undefined") return "indigo";
  return localStorage.getItem("chatAccentColor") || "indigo";
}

// Applique les variables CSS correspondant à la couleur choisie sur
// l'élément racine, ce qui met à jour instantanément toute l'app (aucune
// des classes bg-accent-*/text-accent-* n'a besoin d'être touchée)
export function applyAccentColor(id) {
  if (typeof window === "undefined") return;
  const color = ACCENT_COLORS.find((c) => c.id === id) || ACCENT_COLORS[0];
  const root = document.documentElement;
  Object.entries(color.shades).forEach(([shade, hex]) => {
    root.style.setProperty(`--accent-${shade}`, hex);
  });
}

export function setAccentColor(id) {
  localStorage.setItem("chatAccentColor", id);
  applyAccentColor(id);
}
