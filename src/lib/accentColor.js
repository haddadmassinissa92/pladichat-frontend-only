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
  {
    id: "blue",
    label: "Bleu",
    swatch: "#2563eb",
    shades: {
      50: "#eff6ff",
      100: "#dbeafe",
      300: "#93c5fd",
      400: "#60a5fa",
      600: "#2563eb",
      700: "#1d4ed8",
      900: "#1e3a8a",
      950: "#172554",
    },
  },
  {
    id: "teal",
    label: "Sarcelle",
    swatch: "#0d9488",
    shades: {
      50: "#f0fdfa",
      100: "#ccfbf1",
      300: "#5eead4",
      400: "#2dd4bf",
      600: "#0d9488",
      700: "#0f766e",
      900: "#134e4a",
      950: "#042f2e",
    },
  },
  {
    id: "purple",
    label: "Pourpre",
    swatch: "#9333ea",
    shades: {
      50: "#faf5ff",
      100: "#f3e8ff",
      300: "#d8b4fe",
      400: "#c084fc",
      600: "#9333ea",
      700: "#7e22ce",
      900: "#581c87",
      950: "#3b0764",
    },
  },
  {
    id: "pink",
    label: "Rose bonbon",
    swatch: "#db2777",
    shades: {
      50: "#fdf2f8",
      100: "#fce7f3",
      300: "#f9a8d4",
      400: "#f472b6",
      600: "#db2777",
      700: "#be185d",
      900: "#831843",
      950: "#500724",
    },
  },
  {
    id: "orange",
    label: "Orange",
    swatch: "#ea580c",
    shades: {
      50: "#fff7ed",
      100: "#ffedd5",
      300: "#fdba74",
      400: "#fb923c",
      600: "#ea580c",
      700: "#c2410c",
      900: "#7c2d12",
      950: "#431407",
    },
  },
  {
    id: "red",
    label: "Rouge",
    swatch: "#dc2626",
    shades: {
      50: "#fef2f2",
      100: "#fee2e2",
      300: "#fca5a5",
      400: "#f87171",
      600: "#dc2626",
      700: "#b91c1c",
      900: "#7f1d1d",
      950: "#450a0a",
    },
  },
  {
    id: "yellow",
    label: "Jaune",
    swatch: "#ca8a04",
    shades: {
      50: "#fefce8",
      100: "#fef9c3",
      300: "#fde047",
      400: "#facc15",
      600: "#ca8a04",
      700: "#a16207",
      900: "#713f12",
      950: "#422006",
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
