export const WALLPAPERS = [
  { id: "default", label: "Par défaut", className: "" },
  { id: "dots", label: "Points", className: "bg-wallpaper-dots" },
  { id: "warm", label: "Chaleureux", className: "bg-amber-50 dark:bg-amber-950" },
  { id: "cool", label: "Frais", className: "bg-sky-50 dark:bg-sky-950" },
  { id: "green", label: "Nature", className: "bg-emerald-50 dark:bg-emerald-950" },
  { id: "rose", label: "Rose", className: "bg-rose-50 dark:bg-rose-950" },
  { id: "violet", label: "Violet", className: "bg-violet-50 dark:bg-violet-950" },
  { id: "orange", label: "Coucher de soleil", className: "bg-orange-50 dark:bg-orange-950" },
  { id: "teal", label: "Turquoise", className: "bg-teal-50 dark:bg-teal-950" },
  { id: "slate", label: "Ardoise", className: "bg-slate-100 dark:bg-slate-900" },
  { id: "yellow", label: "Soleil", className: "bg-yellow-50 dark:bg-yellow-950" },
  { id: "indigo", label: "Nuit indigo", className: "bg-indigo-50 dark:bg-indigo-950" },
  { id: "custom", label: "Image personnalisée", className: "" },
];

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
