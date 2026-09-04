// store/useChatStore.js

// importation des bibliothèques nécessaires
import { create } from "zustand";
import { axiosInstance } from "@/lib/axios";
import { useAuthStore } from "@/store/useAuthStore";

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

  // Fonction pour définir le message auquel l'utilisateur répond
  setReplyingTo: (message) => set({ replyingTo: message }),

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
            msg.sender === myId && msg.status !== "read"
              ? { ...msg, status: "read", readAt: now }
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

  // souscrire aux événements de saisie en temps réel pour l'utilisateur sélectionné
  subscribeToTyping: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) return;

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
  },

  // se désabonner des événements de saisie en temps réel pour l'utilisateur sélectionné
  unsubscribeFromTyping: () => {
    const socket = useAuthStore.getState().socket;
    socket?.off("userTyping");
    socket?.off("userStopTyping");
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

  // Ajoute un profil trouvé dans l'annuaire à ses propres contacts (le fait
  // apparaître dans sa liste de conversations), et rafraîchit cette liste
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
