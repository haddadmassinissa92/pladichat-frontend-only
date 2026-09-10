// Chaque fond appartient à une catégorie ("category"), utilisée pour les
// regrouper visuellement dans le menu "Thème" avec des petits titres de
// section, plutôt que de tout mélanger dans une seule longue liste plate
export const WALLPAPERS = [
  { id: "default", label: "Par défaut", className: "", category: "solid" },
  { id: "dots", label: "Points", className: "bg-wallpaper-dots", category: "solid" },
  { id: "warm", label: "Chaleureux", className: "bg-amber-50 dark:bg-amber-950", category: "solid" },
  { id: "cool", label: "Frais", className: "bg-sky-50 dark:bg-sky-950", category: "solid" },
  { id: "green", label: "Nature", className: "bg-emerald-50 dark:bg-emerald-950", category: "solid" },
  { id: "rose", label: "Rose", className: "bg-rose-50 dark:bg-rose-950", category: "solid" },
  { id: "violet", label: "Violet", className: "bg-violet-50 dark:bg-violet-950", category: "solid" },
  { id: "orange", label: "Coucher de soleil", className: "bg-orange-50 dark:bg-orange-950", category: "solid" },
  { id: "teal", label: "Turquoise", className: "bg-teal-50 dark:bg-teal-950", category: "solid" },
  { id: "slate", label: "Ardoise", className: "bg-slate-100 dark:bg-slate-900", category: "solid" },
  { id: "yellow", label: "Soleil", className: "bg-yellow-50 dark:bg-yellow-950", category: "solid" },
  { id: "indigo", label: "Nuit indigo", className: "bg-indigo-50 dark:bg-indigo-950", category: "solid" },
  // Dégradés statiques
  {
    id: "gradient-sunset",
    label: "Coucher de soleil",
    className: "bg-gradient-to-br from-orange-300 via-pink-400 to-purple-500",
    category: "gradient",
  },
  {
    id: "gradient-ocean",
    label: "Océan",
    className: "bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600",
    category: "gradient",
  },
  {
    id: "gradient-aurora",
    label: "Aurore",
    className: "bg-gradient-to-br from-emerald-300 via-teal-400 to-cyan-500",
    category: "gradient",
  },
  {
    id: "gradient-berry",
    label: "Baies",
    className: "bg-gradient-to-br from-pink-400 via-rose-500 to-red-500",
    category: "gradient",
  },
  {
    id: "gradient-forest",
    label: "Forêt",
    className: "bg-gradient-to-br from-lime-300 via-green-500 to-emerald-700",
    category: "gradient",
  },
  {
    id: "gradient-midnight",
    label: "Minuit",
    className: "bg-gradient-to-br from-slate-700 via-purple-800 to-slate-900",
    category: "gradient",
  },
  // Dégradés animés (les couleurs se déplacent doucement en continu)
  {
    id: "gradient-animated-warm",
    label: "Chaud",
    className: "bg-wallpaper-animated-warm",
    category: "animated",
  },
  {
    id: "gradient-animated-cool",
    label: "Froid",
    className: "bg-wallpaper-animated-cool",
    category: "animated",
  },
  { id: "custom", label: "Image personnalisée", className: "", category: "solid" },
];

// Libellés affichés au-dessus de chaque groupe dans le menu "Thème"
export const WALLPAPER_CATEGORY_LABELS = {
  solid: "Couleurs unies",
  gradient: "Dégradés",
  animated: "Animés",
};

// Fond par défaut, appliqué à toutes les conversations qui n'ont pas de fond personnalisé
export function getGlobalWallpaper() {
  if (typeof window === "undefined") return "default";
  return localStorage.getItem("chatWallpaper:global") || "default";
}

export function getGlobalWallpaperImage() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("chatWallpaperImage:global");
}

export function setGlobalWallpaper(id) {
  localStorage.setItem("chatWallpaper:global", id);
}

export function setGlobalWallpaperImage(dataUrl) {
  localStorage.setItem("chatWallpaperImage:global", dataUrl);
}

// Fond spécifique à une conversation précise (prend le dessus sur le fond global)
export function getConversationWallpaper(conversationId) {
  if (typeof window === "undefined" || !conversationId) return null;
  return localStorage.getItem(`chatWallpaper:${conversationId}`);
}

export function getConversationWallpaperImage(conversationId) {
  if (typeof window === "undefined" || !conversationId) return null;
  return localStorage.getItem(`chatWallpaperImage:${conversationId}`);
}

export function setConversationWallpaper(conversationId, id) {
  localStorage.setItem(`chatWallpaper:${conversationId}`, id);
}

export function setConversationWallpaperImage(conversationId, dataUrl) {
  localStorage.setItem(`chatWallpaperImage:${conversationId}`, dataUrl);
}

export function clearConversationWallpaper(conversationId) {
  localStorage.removeItem(`chatWallpaper:${conversationId}`);
  localStorage.removeItem(`chatWallpaperImage:${conversationId}`);
}

// Résout le fond à afficher pour une conversation : priorité au fond spécifique, sinon le fond global
export function resolveWallpaper(conversationId) {
  const perChat = getConversationWallpaper(conversationId);
  if (perChat) {
    return {
      id: perChat,
      image:
        perChat === "custom" ? getConversationWallpaperImage(conversationId) : null,
    };
  }
  const global = getGlobalWallpaper();
  return {
    id: global,
    image: global === "custom" ? getGlobalWallpaperImage() : null,
  };
}
