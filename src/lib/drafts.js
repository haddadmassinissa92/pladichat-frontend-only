// lib/drafts.js
//
// Sauvegarde locale du texte en cours de rédaction, par conversation : si on
// commence à écrire un message et qu'on change de conversation sans l'envoyer,
// le texte reste en attente au lieu de se perdre (comme sur WhatsApp).

function readDrafts() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("chatDrafts") || "{}");
  } catch {
    return {};
  }
}

function writeDrafts(drafts) {
  localStorage.setItem("chatDrafts", JSON.stringify(drafts));
}

export function getDraft(conversationId) {
  if (!conversationId) return "";
  return readDrafts()[conversationId] || "";
}

export function saveDraft(conversationId, text) {
  if (!conversationId) return;
  const drafts = readDrafts();
  if (text && text.trim()) {
    drafts[conversationId] = text;
  } else {
    delete drafts[conversationId];
  }
  writeDrafts(drafts);
}

export function clearDraft(conversationId) {
  if (!conversationId) return;
  const drafts = readDrafts();
  delete drafts[conversationId];
  writeDrafts(drafts);
}
