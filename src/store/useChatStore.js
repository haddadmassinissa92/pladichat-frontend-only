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
  // true s'il existe encore des messages plus anciens à charger dans la conversation actuelle
  hasMoreMessages: true,
  // true pendant le chargement d'une page supplémentaire de messages anciens
  isLoadingMoreMessages: false,
  // Liste des groupes découvrables (dont l'utilisateur n'est pas membre), pour la recherche
  discoverableGroups: [],
  isLoadingDiscoverableGroups: false,

  // Fonction pour récupérer la liste des utilisateurs
  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/users");
      set({ users: res.data });
    } catch (error) {
      console.error(error);
    } finally {
      set({ isUsersLoading: false });
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

      set({ messages: [...get().messages, newMessage] });

      if (selectedUser) {
        get().markAsRead(selectedUser._id);
      }

      if (
        document.hidden &&
        "Notification" in window &&
        Notification.permission === "granted"
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
