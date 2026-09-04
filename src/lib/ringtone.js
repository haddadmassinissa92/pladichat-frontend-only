// lib/ringtone.js
//
// Choix de la sonnerie d'appel, stocké localement (même principe que le
// fond d'écran dans lib/wallpaper.js) : préférence personnelle, propre à
// cet appareil, pas besoin de la synchroniser côté serveur.

export const RINGTONES = [
  { id: "classic", label: "Classique (US)", file: "/ringtone.wav" },
  { id: "european", label: "Européenne", file: "/ringtone-european.wav" },
  { id: "british", label: "Britannique", file: "/ringtone-british.wav" },
  { id: "japanese", label: "Japonaise", file: "/ringtone-japanese.wav" },
  { id: "rotary", label: "Téléphone à cadran", file: "/ringtone-rotary.wav" },
  { id: "digital", label: "Numérique", file: "/ringtone-digital.wav" },
  { id: "siren", label: "Sirène", file: "/ringtone-siren.wav" },
  { id: "bourdon", label: "Bourdon grave", file: "/ringtone-bourdon.wav" },
  { id: "marimba", label: "Marimba", file: "/ringtone-marimba.wav" },
  { id: "chime", label: "Carillon", file: "/ringtone-chime.wav" },
];

export function getRingtone() {
  if (typeof window === "undefined") return "classic";
  return localStorage.getItem("chatRingtone") || "classic";
}

export function getRingtoneFile() {
  const id = getRingtone();
  return RINGTONES.find((r) => r.id === id)?.file || RINGTONES[0].file;
}

export function setRingtone(id) {
  localStorage.setItem("chatRingtone", id);
}
