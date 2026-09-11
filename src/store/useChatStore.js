// store/useChatStore.js

// importation des bibliothèques nécessaires
import { create } from "zustand";
import { axiosInstance } from "@/lib/axios";
import { useAuthStore } from "@/store/useAuthStore";

// Compteur de requêtes pour la recherche globale : permet d'ignorer une
// réponse arrivée en retard (ex: on clique vite Photos puis Audios, et la
// réponse de "Photos" revient après celle d'"Audios") plutôt que de
// l'appliquer et écraser par erreur le résultat le plus récent
let globalSearchRequestId = 0;

// Création du store de chat avec Zustand
export const useChatStore = create((set, get) => ({
  users: [],
  messages: [],
  groups: [],
  selectedUser: null,
  replyingTo: null,
  selectedGroup: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  // Pagination de la liste des contacts : page actuelle, et s'il en reste d'autres à charger
  usersPage: 1,
  hasMoreUsers: true,
  isLoadingMoreUsers: false,
  // Terme de recherche actuellement appliqué à la liste des contacts (recherche côté serveur)
  usersSearch: "",
  // true s'il existe encore des messages plus anciens à charger dans la conversation actuelle
  hasMoreMessages: true,
  // true pendant le chargement d'une page supplémentaire de messages anciens
  isLoadingMoreMessages: false,
  // Liste des groupes découvrables (dont l'utilisateur n'est pas membre), pour la recherche
  discoverableGroups: [],
  isLoadingDiscoverableGroups: false,
  // Résultats de la recherche dans l'historique de la conversation actuelle
  searchResults: [],
  isSearchingMessages: false,

  // Fonction pour récupérer la première page de la liste des contacts déjà
  // ajoutés par l'utilisateur, avec un terme de recherche optionnel
  // (recherche uniquement parmi ces contacts, pas tout l'annuaire — voir
  // discoverUsers plus bas pour chercher de nouvelles personnes à ajouter)
  getUsers: async (search = "") => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get(
        `/users?page=1&search=${encodeURIComponent(search)}`,
      );
      set({
        users: res.data.users,
        hasMoreUsers: res.data.hasMore,
        usersPage: 1,
        usersSearch: search,
      });
    } catch (error) {
      console.error(error);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  // Fonction pour charger une page supplémentaire de contacts, en conservant
  // le terme de recherche actuellement appliqué (appelée en arrivant en bas
  // de la liste des contacts)
  loadMoreUsers: async () => {
    const { hasMoreUsers, isLoadingMoreUsers, usersPage, users, usersSearch } =
      get();

    if (!hasMoreUsers || isLoadingMoreUsers) return;

    set({ isLoadingMoreUsers: true });
    try {
      const nextPage = usersPage + 1;
      const res = await axiosInstance.get(
        `/users?page=${nextPage}&search=${encodeURIComponent(usersSearch)}`,
      );
      set({
        users: [...users, ...res.data.users],
        hasMoreUsers: res.data.hasMore,
        usersPage: nextPage,
      });
    } catch (error) {
      console.error(error);
    } finally {
      set({ isLoadingMoreUsers: false });
    }
  },

  // Fonction pour récupérer la première page de messages (les plus récents)
  // d'une conversation avec un utilisateur ou un groupe spécifique
  getMessages: async (id, isGroup = false) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${id}?isGroup=${isGroup}`);
      set({
        messages: res.data.messages,
        hasMoreMessages: res.data.hasMore,
        isViewingAroundDate: false,
      });
    } catch (error) {
      console.error(error);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  // Fonction pour charger une page supplémentaire de messages plus anciens
  // (appelée quand l'utilisateur remonte tout en haut de la conversation)
  loadMoreMessages: async (id, isGroup = false) => {
    const { messages, hasMoreMessages, isLoadingMoreMessages } = get();

    // On ne charge pas s'il n'y a plus rien à charger, ou si un chargement est déjà en cours
    if (!hasMoreMessages || isLoadingMoreMessages || messages.length === 0) return;

    set({ isLoadingMoreMessages: true });
    try {
      // On demande les messages antérieurs au plus ancien message actuellement affiché
      const oldestMessage = messages[0];
      const res = await axiosInstance.get(
        `/messages/${id}?isGroup=${isGroup}&before=${oldestMessage.createdAt}`,
      );
      set({
        // Les messages plus anciens viennent se placer AVANT les messages déjà présents
        messages: [...res.data.messages, ...messages],
        hasMoreMessages: res.data.hasMore,
      });
    } catch (error) {
      console.error(error);
    } finally {
      set({ isLoadingMoreMessages: false });
    }
  },

  // "Saute" directement à une date précise de l'historique, sans faire
  // défiler tout ce qu'il y a entre les deux : remplace entièrement les
  // messages actuellement affichés par une fenêtre centrée sur cette date.
  // "isViewingAroundDate" indique qu'on est sorti du fil normal (pour
  // afficher un bandeau "revenir aux messages récents" côté interface).
  isViewingAroundDate: false,
  jumpToDate: async (id, isGroup, dateString) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(
        `/messages/around-date/${id}?isGroup=${isGroup}&date=${dateString}`,
      );
      set({
        messages: res.data.messages,
        hasMoreMessages: res.data.hasMoreBefore,
        isViewingAroundDate: true,
      });
      // Le message à mettre en évidence est celui juste à partir de la date
      // demandée (targetIndex), pas forcément le tout premier de la
      // fenêtre chargée (qui peut être bien plus ancien que la date visée
      // s'il n'y avait pas de message exactement ce jour-là)
      const targetMessage = res.data.messages[res.data.targetIndex] || res.data.messages[res.data.messages.length - 1];
      return { success: true, targetMessageId: targetMessage?._id };
    } catch (error) {
      console.error(error);
      return { success: false };
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  // Revient au fil normal (messages les plus récents) après avoir sauté
  // à une date précise
  returnToRecentMessages: (id, isGroup) => {
    set({ isViewingAroundDate: false });
    get().getMessages(id, isGroup);
  },

  // Recherche un mot ou une expression dans tout l'historique d'une conversation
  // (pas seulement les messages déjà chargés). Renvoie les résultats triés du
  // plus ancien au plus récent, pour permettre une navigation précédent/suivant.
  searchMessages: async (id, isGroup, query) => {
    if (!query || !query.trim()) {
      set({ searchResults: [] });
      return;
    }
    set({ isSearchingMessages: true });
    try {
      const res = await axiosInstance.get(
        `/messages/search/${id}?isGroup=${isGroup}&q=${encodeURIComponent(query)}`,
      );
      set({ searchResults: res.data.results });
    } catch (error) {
      console.error(error);
    } finally {
      set({ isSearchingMessages: false });
    }
  },

  // Efface les résultats de recherche (à la fermeture de la barre de recherche)
  clearSearchResults: () => set({ searchResults: [] }),

  // Recherche un mot dans TOUTES les conversations d'un coup (contacts et
  // groupes), contrairement à searchMessages ci-dessus qui reste sur une
  // seule conversation à la fois
  globalSearchResults: [],
  isGlobalSearching: false,
  searchAllConversations: async (query, type) => {
    // Sans mot-clé, on n'accepte de chercher que si un filtre par type de
    // contenu est actif (ex: "toutes mes photos") ; sinon rien à chercher
    if ((!query || !query.trim()) && !type) {
      globalSearchRequestId += 1; // annule aussi toute requête encore en vol
      set({ globalSearchResults: [] });
      return;
    }
    const requestId = ++globalSearchRequestId;
    set({ isGlobalSearching: true });
    try {
      const params = new URLSearchParams();
      if (query && query.trim()) params.set("q", query.trim());
      if (type) params.set("type", type);
      const res = await axiosInstance.get(
        `/messages/search-all/global?${params.toString()}`,
      );
      // Une recherche plus récente a été lancée entre-temps : cette
      // réponse est périmée, on l'ignore pour ne pas écraser la bonne
      if (requestId !== globalSearchRequestId) return;
      set({ globalSearchResults: res.data.results });
    } catch (error) {
      console.error(error);
    } finally {
      if (requestId === globalSearchRequestId) {
        set({ isGlobalSearching: false });
      }
    }
  },
  clearGlobalSearchResults: () => {
    globalSearchRequestId += 1;
    set({ globalSearchResults: [] });
  },

  // Fonction pour envoyer un message à l'utilisateur sélectionné
  sendMessage: async (data) => {
    const { selectedUser, selectedGroup, messages } = get();
    try {
      const formData = new FormData();
      if (data.text) formData.append("text", data.text);
      if (data.image) formData.append("image", data.image);
      if (data.audio) formData.append("image", data.audio);
      if (data.replyTo) formData.append("replyTo", data.replyTo._id);
      if (selectedGroup) formData.append("groupId", selectedGroup._id);

      const targetId = selectedGroup ? selectedGroup._id : selectedUser._id;

      const res = await axiosInstance.post(
        `/messages/send/${targetId}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      set({ messages: [...messages, res.data], replyingTo: null });
    } catch (error) {
      console.error(error);
    }
  },

  // Programme l'envoi d'un message texte à une date/heure future, pour la
  // conversation actuellement ouverte
  scheduleMessage: async (text, scheduledFor) => {
    const { selectedUser, selectedGroup } = get();
    try {
      const targetId = selectedGroup ? selectedGroup._id : selectedUser._id;
      const body = selectedGroup
        ? { text, scheduledFor, groupId: selectedGroup._id }
        : { text, scheduledFor };

      await axiosInstance.post(`/messages/schedule/${targetId}`, body);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Liste tous les messages programmés en attente de l'utilisateur connecté
  scheduledMessages: [],
  getScheduledMessages: async () => {
    try {
      const res = await axiosInstance.get("/messages/scheduled/mine");
      set({ scheduledMessages: res.data.scheduled });
    } catch (error) {
      console.error(error);
    }
  },

  // Annule un message programmé avant son envoi
  cancelScheduledMessage: async (id) => {
    try {
      await axiosInstance.delete(`/messages/scheduled/${id}`);
      set({
        scheduledMessages: get().scheduledMessages.filter((m) => m._id !== id),
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Récupère l'aperçu (titre, description, image) d'une URL en direct,
  // pendant que l'utilisateur tape, avant même d'avoir envoyé le message
  getLinkPreview: async (url) => {
    try {
      const res = await axiosInstance.get(
        `/messages/link-preview?url=${encodeURIComponent(url)}`,
      );
      return res.data.linkPreview;
    } catch (error) {
      console.error(error);
      return null;
    }
  },

  // Fonction pour définir le message auquel l'utilisateur répond
  setReplyingTo: (message) => set({ replyingTo: message }),

  // Retire de l'affichage les messages éphémères dont l'heure d'expiration
  // est dépassée, sans attendre que MongoDB fasse le ménage de son côté
  // (l'index TTL passe environ toutes les 60 secondes) — appelé
  // périodiquement depuis ChatContainer pendant qu'une conversation est ouverte
  removeExpiredMessages: () => {
    const now = Date.now();
    const messages = get().messages;
    const filtered = messages.filter(
      (m) => !m.expiresAt || new Date(m.expiresAt).getTime() > now,
    );
    if (filtered.length !== messages.length) {
      set({ messages: filtered });
    }
  },

  // Transfère un message existant (texte, image ou audio) vers une autre
  // conversation, sans re-télécharger le fichier (déjà hébergé sur
  // Cloudinary). "target" = { userId } pour un contact, ou { groupId } pour
  // un groupe.
  forwardMessage: async (message, target) => {
    try {
      const formData = new FormData();
      if (message.text) formData.append("text", message.text);
      if (message.image) formData.append("forwardedImage", message.image);
      if (message.audio) formData.append("forwardedAudio", message.audio);
      if (target.groupId) formData.append("groupId", target.groupId);

      const targetId = target.groupId || target.userId;
      const res = await axiosInstance.post(`/messages/send/${targetId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Si la cible est la conversation actuellement ouverte, on affiche le
      // message transféré tout de suite, sans attendre un rechargement
      const { selectedUser, selectedGroup, messages } = get();
      const isCurrentConversation = target.groupId
        ? selectedGroup?._id === target.groupId
        : selectedUser?._id === target.userId;
      if (isCurrentConversation) {
        set({ messages: [...messages, res.data] });
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Récupère les tout derniers messages d'une conversation précise, sans
  // rien changer à la conversation actuellement ouverte (pas de sélection,
  // pas de "messages" écrasés) — utilisé pour la réponse rapide depuis la
  // liste, qui doit pouvoir montrer un peu de contexte sans ouvrir la
  // conversation
  getQuickPreviewMessages: async (id, isGroup) => {
    try {
      const res = await axiosInstance.get(
        `/messages/${id}?isGroup=${isGroup}`,
      );
      return res.data.messages.slice(-3);
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  // Envoie un message texte à une conversation précise depuis la réponse
  // rapide, sans changer la conversation actuellement sélectionnée
  sendQuickReply: async (id, isGroup, text) => {
    try {
      const formData = new FormData();
      formData.append("text", text);
      if (isGroup) formData.append("groupId", id);

      await axiosInstance.post(`/messages/send/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Envoie un message à plusieurs contacts d'un coup (liste de diffusion) :
  // chacun le reçoit comme un message privé normal, sans savoir qui d'autre
  // l'a reçu — contrairement à un groupe, ils ne se voient pas entre eux
  sendBroadcastMessage: async (text, memberIds) => {
    const results = await Promise.allSettled(
      memberIds.map((userId) => {
        const formData = new FormData();
        formData.append("text", text);
        return axiosInstance.post(`/messages/send/${userId}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }),
    );

    const failedCount = results.filter((r) => r.status === "rejected").length;

    // Si l'un des destinataires est la conversation actuellement ouverte,
    // affiche le message tout de suite dedans, sans attendre un rechargement
    const { selectedUser, messages } = get();
    if (selectedUser && memberIds.includes(selectedUser._id)) {
      const matchingResult = results.find(
        (r, i) => r.status === "fulfilled" && memberIds[i] === selectedUser._id,
      );
      if (matchingResult && matchingResult.status === "fulfilled") {
        set({ messages: [...messages, matchingResult.value.data] });
      }
    }

    return {
      success: failedCount === 0,
      sentCount: memberIds.length - failedCount,
      failedCount,
    };
  },

  // Fonction pour supprimer un message
  deleteMessage: async (messageId) => {
    try {
      await axiosInstance.delete(`/messages/${messageId}`);
      set({ messages: get().messages.filter((m) => m._id !== messageId) });
    } catch (error) {
      console.error(error);
    }
  },

  // Vide entièrement la conversation actuelle : supprime TOUS les messages
  // (les siens et ceux de l'autre/des autres), pas seulement les siens
  deleteConversation: async () => {
    const { selectedUser, selectedGroup } = get();
    const conversationId = selectedGroup?._id || selectedUser?._id;
    if (!conversationId) return { success: false };

    try {
      await axiosInstance.delete(`/messages/conversation/${conversationId}`, {
        params: { isGroup: !!selectedGroup },
      });
      set({ messages: [] });
      return { success: true };
    } catch (error) {
      console.error(error);
      return { success: false };
    }
  },

  // Fonction pour modifier un message
  editMessage: async (messageId, newText) => {
    try {
      const res = await axiosInstance.put(`/messages/${messageId}`, {
        text: newText,
      });
      set({
        messages: get().messages.map((m) =>
          m._id === messageId ? res.data : m,
        ),
      });
    } catch (error) {
      console.error(error);
    }
  },

  // Fonction pour ajouter/retirer une réaction (emoji) sur un message
  reactToMessage: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.put(`/messages/react/${messageId}`, {
        emoji,
      });
      set({
        messages: get().messages.map((m) =>
          m._id === messageId ? res.data : m,
        ),
      });
    } catch (error) {
      console.error(error);
    }
  },

  // Fonction pour définir l'utilisateur sélectionné pour la conversation
  setSelectedUser: (user) => set({ selectedUser: user, selectedGroup: null }),

  // Ouvre la conversation d'un groupe découvrable dont on n'est pas encore membre :
  // on ne connaît pas encore ses vrais membres, mais on peut déjà tenter d'y écrire
  // un message de "candidature" (qui restera grisé et invisible aux autres jusqu'à
  // approbation du créateur)
  previewDiscoverableGroup: (group) => {
    set({
      selectedGroup: {
        _id: group._id,
        name: group.name,
        members: [],
        blockedMembers: [],
        joinRequests: [],
        isDiscoverable: true,
        createdBy: group.createdBy,
      },
      selectedUser: null,
    });
  },

  // connecter a un message socket pour recevoir les messages en temps réel
  subscribeToMessages: () => {
    const { selectedUser, selectedGroup } = get();
    if (!selectedUser && !selectedGroup) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on("newMessage", (newMessage) => {
      const isRelevant = selectedGroup
        ? newMessage.group === selectedGroup._id
        : newMessage.sender === selectedUser._id;

      if (!isRelevant) return;

      // Garde-fou : évite un doublon si ce message est déjà présent (peut arriver
      // quand un message en attente d'approbation est révélé après acceptation,
      // puisqu'on l'avait déjà ajouté localement à l'envoi)
      const alreadyPresent = get().messages.some(
        (m) => m._id === newMessage._id,
      );
      if (alreadyPresent) return;

      set({ messages: [...get().messages, newMessage] });

      if (selectedUser) {
        get().markAsRead(selectedUser._id);
      }

      if (
        document.hidden &&
        "Notification" in window &&
        Notification.permission === "granted" &&
        !(useAuthStore.getState().authUser?.mutedConversations || []).includes(
          selectedGroup ? selectedGroup._id : selectedUser._id,
        )
      ) {
        const name = selectedGroup
          ? selectedGroup.name
          : selectedUser?.username;
        new Notification(`Nouveau message de ${name}`, {
          body: newMessage.text || "📎 Pièce jointe",
          icon: "/icon.png",
        });
      }
    });

    // Quelqu'un (nous depuis un autre appareil, ou l'autre participant) a
    // vidé cette conversation : on efface aussi l'affichage local si elle
    // est actuellement ouverte
    socket.on("conversationCleared", ({ senderId, groupId }) => {
      const isRelevantClear = selectedGroup
        ? groupId === selectedGroup._id
        : senderId === selectedUser?._id;
      if (isRelevantClear) {
        set({ messages: [] });
      }
    });

    socket.on("messagesRead", ({ readBy, groupId }) => {
      const myId = useAuthStore.getState().authUser?._id;
      const now = new Date().toISOString();

      if (selectedGroup && groupId === selectedGroup._id) {
        set({
          messages: get().messages.map((msg) =>
            msg.sender === myId
              ? {
                  ...msg,
                  status: "read",
                  readAt: now,
                  readBy: (msg.readBy || []).includes(readBy)
                    ? msg.readBy
                    : [...(msg.readBy || []), readBy],
                }
              : msg,
          ),
        });
      } else if (selectedUser && readBy === selectedUser._id) {
        set({
          messages: get().messages.map((msg) =>
            msg.receiver === readBy
              ? { ...msg, status: "read", readAt: now }
              : msg,
          ),
        });
      }
    });

    socket.on("messageDeleted", ({ messageId }) => {
      set({ messages: get().messages.filter((m) => m._id !== messageId) });
    });

    socket.on("messageEdited", (updatedMessage) => {
      set({
        messages: get().messages.map((m) =>
          m._id === updatedMessage._id ? updatedMessage : m,
        ),
      });
    });

    socket.on("messageReaction", ({ messageId, reactions }) => {
      set({
        messages: get().messages.map((m) =>
          m._id === messageId ? { ...m, reactions } : m,
        ),
      });
    });
  },

  // déconnecter du message socket pour arrêter de recevoir les messages en temps réel
  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket?.off("newMessage");
    socket?.off("conversationCleared");
    socket?.off("messagesRead");
    socket?.off("messageDeleted");
    socket?.off("messageEdited");
    socket?.off("messageReaction");
  },

  // boolean pour indiquer si l'utilisateur sélectionné est en train d'écrire un message
  isTyping: false,
  // Liste des noms des membres actuellement en train d'écrire dans le
  // groupe actuellement ouvert (plusieurs personnes peuvent écrire à la fois)
  typingGroupUsers: [],

  // souscrire aux événements de saisie en temps réel pour la conversation
  // actuellement sélectionnée (privée ou de groupe)
  subscribeToTyping: () => {
    const { selectedUser, selectedGroup } = get();
    if (!selectedUser && !selectedGroup) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    if (selectedUser) {
      socket.on("userTyping", ({ senderId }) => {
        if (senderId === selectedUser._id) {
          set({ isTyping: true });
        }
      });

      socket.on("userStopTyping", ({ senderId }) => {
        if (senderId === selectedUser._id) {
          set({ isTyping: false });
        }
      });
    }

    if (selectedGroup) {
      socket.on("groupUserTyping", ({ groupId, senderId, senderName }) => {
        if (groupId !== selectedGroup._id) return;
        const current = get().typingGroupUsers;
        if (!current.some((u) => u.senderId === senderId)) {
          set({ typingGroupUsers: [...current, { senderId, senderName }] });
        }
      });

      socket.on("groupUserStopTyping", ({ groupId, senderId }) => {
        if (groupId !== selectedGroup._id) return;
        set({
          typingGroupUsers: get().typingGroupUsers.filter((u) => u.senderId !== senderId),
        });
      });
    }
  },

  // se désabonner des événements de saisie en temps réel pour la
  // conversation actuellement sélectionnée
  unsubscribeFromTyping: () => {
    const socket = useAuthStore.getState().socket;
    socket?.off("userTyping");
    socket?.off("userStopTyping");
    socket?.off("groupUserTyping");
    socket?.off("groupUserStopTyping");
    set({ isTyping: false, typingGroupUsers: [] });
  },

  // Liste des contacts actuellement en train d'écrire, tous partout (pas
  // seulement dans la conversation ouverte) — pour l'afficher directement
  // dans la sidebar, à la place de l'aperçu du dernier message
  typingUserIds: [],
  handleGlobalUserTyping: ({ senderId }) => {
    const current = get().typingUserIds;
    if (!current.includes(senderId)) {
      set({ typingUserIds: [...current, senderId] });
    }
  },
  handleGlobalUserStopTyping: ({ senderId }) => {
    set({ typingUserIds: get().typingUserIds.filter((id) => id !== senderId) });
  },

  // Même chose pour les groupes : qui écrit dans quel groupe, pour
  // l'afficher dans la sidebar avec son nom ("testuser en train d'écrire")
  typingGroupSenders: [],
  handleGlobalGroupUserTyping: ({ groupId, senderId, senderName }) => {
    const current = get().typingGroupSenders;
    if (!current.some((t) => t.groupId === groupId && t.senderId === senderId)) {
      set({ typingGroupSenders: [...current, { groupId, senderId, senderName }] });
    }
  },
  handleGlobalGroupUserStopTyping: ({ groupId, senderId }) => {
    set({
      typingGroupSenders: get().typingGroupSenders.filter(
        (t) => !(t.groupId === groupId && t.senderId === senderId),
      ),
    });
  },

  // marquer les messages comme lus pour l'utilisateur sélectionné
  markAsRead: async (id, isGroup = false) => {
    try {
      await axiosInstance.put(`/messages/read/${id}?isGroup=${isGroup}`);
    } catch (error) {
      console.error(error);
    }
  },

  //
  getGroups: async () => {
    try {
      const res = await axiosInstance.get("/groups");
      set({ groups: res.data });
    } catch (error) {
      console.error(error);
    }
  },

  createGroup: async (name, memberIds) => {
    try {
      const res = await axiosInstance.post("/groups", {
        name,
        members: memberIds,
      });
      set({ groups: [...get().groups, res.data] });
      return { success: true };
    } catch (error) {
      console.error(error);
      return { success: false };
    }
  },

  // Invitations de groupe reçues, en attente d'une réponse
  pendingGroupInvites: [],
  getPendingGroupInvites: async () => {
    try {
      const res = await axiosInstance.get("/groups/invites/pending");
      set({ pendingGroupInvites: res.data.invites });
    } catch (error) {
      console.error(error);
    }
  },

  // Accepte ou refuse une invitation à rejoindre un groupe
  respondToGroupInvite: async (groupId, accept) => {
    try {
      const res = await axiosInstance.put(`/groups/invites/${groupId}/respond`, {
        accept,
      });
      set({
        pendingGroupInvites: get().pendingGroupInvites.filter(
          (i) => i.groupId !== groupId,
        ),
      });
      if (accept && res.data.group) {
        set({ groups: [...get().groups, res.data.group] });
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  //
  setSelectedGroup: (group) =>
    set({ selectedGroup: group, selectedUser: null }),

  deleteGroup: async (groupId) => {
    try {
      await axiosInstance.delete(`/groups/${groupId}`);
      set({
        groups: get().groups.filter((g) => g._id !== groupId),
        selectedGroup: null,
      });
    } catch (error) {
      console.error(error);
    }
  },

  // Applique la mise à jour d'un groupe (venant d'une réponse API ou d'un événement
  // socket) à la fois dans la liste des groupes et dans la conversation actuellement
  // ouverte si elle correspond, en conservant les champs comme lastMessage/unreadCount
  // qui ne font pas partie de la réponse du serveur pour ces actions
  applyGroupUpdate: (updatedGroup) => {
    set((state) => ({
      groups: state.groups.map((g) =>
        g._id === updatedGroup._id ? { ...g, ...updatedGroup } : g,
      ),
      selectedGroup:
        state.selectedGroup?._id === updatedGroup._id
          ? { ...state.selectedGroup, ...updatedGroup }
          : state.selectedGroup,
    }));
  },

  // Renomme un groupe (réservé au créateur côté serveur)
  renameGroup: async (groupId, name) => {
    try {
      const res = await axiosInstance.put(`/groups/rename/${groupId}`, {
        name,
      });
      get().applyGroupUpdate(res.data);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Ajoute un ou plusieurs membres à un groupe existant
  addMembersToGroup: async (groupId, memberIds) => {
    try {
      const res = await axiosInstance.put(`/groups/add-members/${groupId}`, {
        members: memberIds,
      });
      get().applyGroupUpdate(res.data);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Retire définitivement un membre d'un groupe
  removeMember: async (groupId, memberId) => {
    try {
      const res = await axiosInstance.put(
        `/groups/remove-member/${groupId}`,
        { memberId },
      );
      get().applyGroupUpdate(res.data);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Bloque ou débloque un membre à l'intérieur d'un groupe (bascule automatique)
  toggleBlockMember: async (groupId, memberId) => {
    try {
      const res = await axiosInstance.put(
        `/groups/block-member/${groupId}`,
        { memberId },
      );
      get().applyGroupUpdate(res.data);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Promeut ou rétrograde un membre comme co-administrateur du groupe
  toggleAdmin: async (groupId, memberId) => {
    try {
      const res = await axiosInstance.put(
        `/groups/toggle-admin/${groupId}`,
        { memberId },
      );
      get().applyGroupUpdate(res.data);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Rend un groupe découvrable ou privé (bascule automatique)
  toggleDiscoverable: async (groupId) => {
    try {
      const res = await axiosInstance.put(
        `/groups/toggle-discoverable/${groupId}`,
      );
      get().applyGroupUpdate(res.data);
      return { success: true, isDiscoverable: res.data.isDiscoverable };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Récupère la liste des groupes découvrables dont on n'est pas déjà membre
  getDiscoverableGroups: async () => {
    set({ isLoadingDiscoverableGroups: true });
    try {
      const res = await axiosInstance.get("/groups/discoverable/list");
      set({ discoverableGroups: res.data });
    } catch (error) {
      console.error(error);
    } finally {
      set({ isLoadingDiscoverableGroups: false });
    }
  },

  // Recherche un profil par nom d'utilisateur EXACT, utilisé par le lien de
  // partage "ajoute-moi" (/add/[username])
  lookupUserByUsername: async (username) => {
    try {
      const res = await axiosInstance.get(`/users/lookup/${encodeURIComponent(username)}`);
      return { success: true, user: res.data.user };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Utilisateur introuvable.",
      };
    }
  },

  // Recherche dans l'annuaire COMPLET des inscrits (pas seulement les
  // contacts déjà ajoutés), pour trouver de nouvelles personnes à ajouter
  discoverResults: [],
  isDiscovering: false,
  discoverUsers: async (search) => {
    if (!search?.trim()) {
      set({ discoverResults: [] });
      return;
    }
    set({ isDiscovering: true });
    try {
      const res = await axiosInstance.get(
        `/users/discover?search=${encodeURIComponent(search)}`,
      );
      set({ discoverResults: res.data.users });
    } catch (error) {
      console.error(error);
    } finally {
      set({ isDiscovering: false });
    }
  },

  // Envoie une demande de contact (ne l'ajoute pas tout de suite : il faut
  // que la personne l'accepte pour que le contact devienne mutuel)
  addContact: async (userId) => {
    try {
      await axiosInstance.post(`/users/contacts/${userId}`);
      set({
        discoverResults: get().discoverResults.filter((u) => u._id !== userId),
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Demandes de contact reçues, en attente d'une réponse
  contactRequests: [],
  getContactRequests: async () => {
    try {
      const res = await axiosInstance.get("/users/contact-requests");
      set({ contactRequests: res.data.requests });
    } catch (error) {
      console.error(error);
    }
  },

  // Accepte une demande reçue : devient un contact mutuel, et rafraîchit
  // sa propre liste pour le faire apparaître tout de suite
  acceptContactRequest: async (userId) => {
    try {
      await axiosInstance.post(`/users/contact-requests/${userId}/accept`);
      set({
        contactRequests: get().contactRequests.filter((u) => u._id !== userId),
      });
      await get().getUsers();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Refuse une demande reçue : la retire simplement de la liste d'attente
  declineContactRequest: async (userId) => {
    try {
      await axiosInstance.post(`/users/contact-requests/${userId}/decline`);
      set({
        contactRequests: get().contactRequests.filter((u) => u._id !== userId),
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Demandes de contact ENVOYÉES, encore en attente d'une réponse
  sentContactRequests: [],
  getSentContactRequests: async () => {
    try {
      const res = await axiosInstance.get("/users/contact-requests/sent");
      set({ sentContactRequests: res.data.requests });
    } catch (error) {
      console.error(error);
    }
  },

  // Annule une demande de contact qu'on a soi-même envoyée
  cancelContactRequest: async (userId) => {
    try {
      await axiosInstance.delete(`/users/contact-requests/${userId}`);
      set({
        sentContactRequests: get().sentContactRequests.filter((u) => u._id !== userId),
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Envoie une demande d'adhésion à un groupe découvrable
  requestToJoinGroup: async (groupId) => {
    try {
      await axiosInstance.post(`/groups/request-join/${groupId}`);
      set({
        discoverableGroups: get().discoverableGroups.map((g) =>
          g._id === groupId ? { ...g, requestPending: true } : g,
        ),
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Accepte la demande d'adhésion d'un utilisateur à l'un de nos groupes
  approveJoinRequest: async (groupId, userId) => {
    try {
      const res = await axiosInstance.put(
        `/groups/approve-join/${groupId}`,
        { userId },
      );
      get().applyGroupUpdate(res.data);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Refuse la demande d'adhésion d'un utilisateur à l'un de nos groupes
  rejectJoinRequest: async (groupId, userId) => {
    try {
      const res = await axiosInstance.put(
        `/groups/reject-join/${groupId}`,
        { userId },
      );
      get().applyGroupUpdate(res.data);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },
}));
