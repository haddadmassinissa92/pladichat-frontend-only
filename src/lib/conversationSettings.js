// Préférences par conversation, stockées localement dans le navigateur
// (même approche que les fonds d'écran dans lib/wallpaper.js) : ne
// nécessitent aucun changement côté backend, mais ne sont donc pas
// synchronisées entre appareils.

function readSet(key) {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function writeSet(key, set) {
  localStorage.setItem(key, JSON.stringify(Array.from(set)));
}

// --- Notifications coupées ---

export function isConversationMuted(conversationId) {
  if (!conversationId) return false;
  return readSet("chatMutedConversations").has(conversationId);
}

export function toggleConversationMuted(conversationId) {
  const set = readSet("chatMutedConversations");
  if (set.has(conversationId)) {
    set.delete(conversationId);
  } else {
    set.add(conversationId);
  }
  writeSet("chatMutedConversations", set);
  return set.has(conversationId);
}

// --- Conversations épinglées ---

export function getPinnedConversations() {
  return readSet("chatPinnedConversations");
}

export function isConversationPinned(conversationId) {
  if (!conversationId) return false;
  return readSet("chatPinnedConversations").has(conversationId);
}

export function toggleConversationPinned(conversationId) {
  const set = readSet("chatPinnedConversations");
  if (set.has(conversationId)) {
    set.delete(conversationId);
  } else {
    set.add(conversationId);
  }
  writeSet("chatPinnedConversations", set);
  return set.has(conversationId);
}

// --- Conversations masquées (« supprimées » de la liste, localement) ---
// Réapparaît automatiquement dès qu'un nouveau message arrive, puisque la
// conversation n'est pas réellement supprimée côté serveur.

export function getHiddenConversations() {
  return readSet("chatHiddenConversations");
}

export function isConversationHidden(conversationId) {
  if (!conversationId) return false;
  return readSet("chatHiddenConversations").has(conversationId);
}

export function hideConversation(conversationId) {
  const set = readSet("chatHiddenConversations");
  set.add(conversationId);
  writeSet("chatHiddenConversations", set);
}

export function unhideConversation(conversationId) {
  const set = readSet("chatHiddenConversations");
  set.delete(conversationId);
  writeSet("chatHiddenConversations", set);
}
