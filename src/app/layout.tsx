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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
