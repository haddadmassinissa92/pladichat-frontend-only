import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://pladine-chat.vercel.app"),
  title: "PladiChat",
  description: "Application de chat en temps réel",
  manifest: "/manifest.json",
  openGraph: {
    title: "PladiChat",
    description: "Messagerie instantanée en temps réel — messages privés, groupes, appels et bien plus.",
    url: "https://pladine-chat.vercel.app",
    siteName: "PladiChat",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PladiChat - Messagerie instantanée en temps réel",
      },
    ],
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PladiChat",
    description: "Messagerie instantanée en temps réel — messages privés, groupes, appels et bien plus.",
    images: ["/og-image.png"],
  },
  // Balises spécifiques à iOS : Safari ne lit pas bien manifest.json tout
  // seul, ces réglages permettent "Ajouter à l'écran d'accueil" avec une
  // vraie icône et un affichage plein écran (sans barre d'adresse)
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PladiChat",
  },
};

// Couleur de la barre d'adresse/barre de statut du navigateur quand l'app
// est installée (correspond à l'indigo utilisé dans le reste de l'interface)
export const viewport: Viewport = {
  themeColor: "#4f46e5",
};

const themeScript = `
  (function() {
    try {
      var stored = localStorage.getItem("theme");
      var isDark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
      if (isDark) document.documentElement.classList.add("dark");
    } catch (e) {}
  })();
`;

// Applique la couleur d'accent choisie avant l'affichage de la page, pour
// éviter un flash de l'indigo par défaut suivi d'un changement de couleur
// (même principe que themeScript ci-dessus pour le mode sombre). La liste
// des couleurs est dupliquée ici volontairement (voir lib/accentColor.js
// pour la version "source de vérité") : ce script tourne avant que React
// et ses imports ne soient disponibles, il ne peut rien importer.
const accentScript = `
  (function() {
    try {
      var colors = {
        indigo: { 50:"#eef2ff",100:"#e0e7ff",300:"#a5b4fc",400:"#818cf8",600:"#4f46e5",700:"#4338ca",900:"#312e81",950:"#1e1b4b" },
        rose: { 50:"#fff1f2",100:"#ffe4e6",300:"#fda4af",400:"#fb7185",600:"#e11d48",700:"#be123c",900:"#881337",950:"#4c0519" },
        emerald: { 50:"#ecfdf5",100:"#d1fae5",300:"#6ee7b7",400:"#34d399",600:"#059669",700:"#047857",900:"#064e3b",950:"#022c22" },
        sky: { 50:"#f0f9ff",100:"#e0f2fe",300:"#7dd3fc",400:"#38bdf8",600:"#0284c7",700:"#0369a1",900:"#0c4a6e",950:"#082f49" },
        amber: { 50:"#fffbeb",100:"#fef3c7",300:"#fcd34d",400:"#fbbf24",600:"#d97706",700:"#b45309",900:"#78350f",950:"#451a03" },
        violet: { 50:"#f5f3ff",100:"#ede9fe",300:"#c4b5fd",400:"#a78bfa",600:"#7c3aed",700:"#6d28d9",900:"#4c1d95",950:"#2e1065" },
        blue: { 50:"#eff6ff",100:"#dbeafe",300:"#93c5fd",400:"#60a5fa",600:"#2563eb",700:"#1d4ed8",900:"#1e3a8a",950:"#172554" },
        teal: { 50:"#f0fdfa",100:"#ccfbf1",300:"#5eead4",400:"#2dd4bf",600:"#0d9488",700:"#0f766e",900:"#134e4a",950:"#042f2e" },
        purple: { 50:"#faf5ff",100:"#f3e8ff",300:"#d8b4fe",400:"#c084fc",600:"#9333ea",700:"#7e22ce",900:"#581c87",950:"#3b0764" },
        pink: { 50:"#fdf2f8",100:"#fce7f3",300:"#f9a8d4",400:"#f472b6",600:"#db2777",700:"#be185d",900:"#831843",950:"#500724" },
        orange: { 50:"#fff7ed",100:"#ffedd5",300:"#fdba74",400:"#fb923c",600:"#ea580c",700:"#c2410c",900:"#7c2d12",950:"#431407" },
        red: { 50:"#fef2f2",100:"#fee2e2",300:"#fca5a5",400:"#f87171",600:"#dc2626",700:"#b91c1c",900:"#7f1d1d",950:"#450a0a" },
        yellow: { 50:"#fefce8",100:"#fef9c3",300:"#fde047",400:"#facc15",600:"#ca8a04",700:"#a16207",900:"#713f12",950:"#422006" }
      };
      var stored = localStorage.getItem("chatAccentColor") || "indigo";
      var shades = colors[stored] || colors.indigo;
      var root = document.documentElement;
      for (var shade in shades) {
        root.style.setProperty("--accent-" + shade, shades[shade]);
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: accentScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
