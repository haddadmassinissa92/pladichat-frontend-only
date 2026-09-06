// lib/notificationSound.js
//
// Son joué à la réception d'un nouveau message, personnalisable par
// conversation (pour reconnaître qui écrit rien qu'au son), avec un choix
// par défaut appliqué à tous les contacts/groupes sans réglage spécifique.
// Stocké localement (même principe que les fonds d'écran) : propre à cet
// appareil, pas besoin de changement côté serveur.

export const NOTIFICATION_SOUNDS = [
  { id: "ding", label: "Ding", file: "/notif-ding.wav" },
  { id: "pop", label: "Pop", file: "/notif-pop.wav" },
  { id: "marimba", label: "Marimba douce", file: "/notif-marimba.wav" },
  { id: "bell", label: "Clochette", file: "/notif-bell.wav" },
  { id: "subtle", label: "Discret", file: "/notif-subtle.wav" },
];

export function getDefaultNotificationSound() {
  if (typeof window === "undefined") return "ding";
  return localStorage.getItem("chatDefaultNotificationSound") || "ding";
}

export function setDefaultNotificationSound(id) {
  localStorage.setItem("chatDefaultNotificationSound", id);
}

// Son propre à une conversation précise, s'il a été choisi ; sinon on
// retombe sur le son par défaut (une chaîne vide signifie explicitement
// "utiliser le son par défaut", pour pouvoir revenir en arrière)
export function getConversationNotificationSound(conversationId) {
  if (typeof window === "undefined" || !conversationId) {
    return getDefaultNotificationSound();
  }
  const specific = localStorage.getItem(`chatNotificationSound:${conversationId}`);
  return specific || getDefaultNotificationSound();
}

export function setConversationNotificationSound(conversationId, id) {
  if (!id) {
    localStorage.removeItem(`chatNotificationSound:${conversationId}`);
  } else {
    localStorage.setItem(`chatNotificationSound:${conversationId}`, id);
  }
}

export function getNotificationSoundFile(soundId) {
  return NOTIFICATION_SOUNDS.find((s) => s.id === soundId)?.file || NOTIFICATION_SOUNDS[0].file;
}

// Joue le son configuré pour cette conversation précise
export function playNotificationSound(conversationId) {
  if (typeof window === "undefined") return;
  const soundId = getConversationNotificationSound(conversationId);
  const audio = new Audio(getNotificationSoundFile(soundId));
  audio.play().catch(() => {});
}
