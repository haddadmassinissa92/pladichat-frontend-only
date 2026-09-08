// lib/broadcastLists.js
//
// Listes de diffusion : envoyer le même message à plusieurs contacts d'un
// coup, chacun le recevant comme un message privé normal — personne ne voit
// qui d'autre l'a reçu, contrairement à un groupe. Préférence locale, propre
// à cet appareil (comme le surnom, l'épinglage ou les étiquettes).

function readLists() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("chatBroadcastLists") || "[]");
  } catch {
    return [];
  }
}

function writeLists(lists) {
  localStorage.setItem("chatBroadcastLists", JSON.stringify(lists));
}

export function getBroadcastLists() {
  return readLists();
}

export function saveBroadcastList(name, memberIds, existingId = null) {
  const lists = readLists();
  if (existingId) {
    const index = lists.findIndex((l) => l.id === existingId);
    if (index !== -1) {
      lists[index] = { id: existingId, name, memberIds };
      writeLists(lists);
      return lists[index];
    }
  }
  const newList = { id: `bl_${Date.now()}`, name, memberIds };
  writeLists([...lists, newList]);
  return newList;
}

export function deleteBroadcastList(id) {
  writeLists(readLists().filter((l) => l.id !== id));
}
