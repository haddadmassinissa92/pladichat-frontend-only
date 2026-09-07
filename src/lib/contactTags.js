// lib/contactTags.js
//
// Étiquettes personnalisées par contact ("Famille", "Travail", "Amis"...),
// pour organiser sa liste de contacts. Préférence locale (comme le surnom,
// l'épinglage ou le masquage), propre à cet appareil.

function readTags() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("chatContactTags") || "{}");
  } catch {
    return {};
  }
}

function writeTags(tags) {
  localStorage.setItem("chatContactTags", JSON.stringify(tags));
}

export function getContactTag(contactId) {
  if (!contactId) return "";
  return readTags()[contactId] || "";
}

export function setContactTag(contactId, tag) {
  if (!contactId) return;
  const tags = readTags();
  const trimmed = tag.trim();
  if (trimmed) {
    tags[contactId] = trimmed;
  } else {
    delete tags[contactId];
  }
  writeTags(tags);
}

// Liste des étiquettes déjà utilisées (sans doublon), pour proposer une
// réutilisation rapide plutôt que retaper le même nom à chaque fois
export function getAllUsedTags() {
  const tags = readTags();
  return [...new Set(Object.values(tags))].sort((a, b) => a.localeCompare(b));
}
