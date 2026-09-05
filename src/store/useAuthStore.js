// store/useAuthStore.js

// importation des bibliothèques nécessaires
import { create } from "zustand";
import { axiosInstance } from "@/lib/axios";
import { io } from "socket.io-client";

// Définition de l'URL du socket à partir des variables d'environnement
const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL;

// Création du store d'authentification avec Zustand
export const useAuthStore = create((set, get) => ({
  onlineUsers: [],
  authUser: null,
  socket: null,
  onlinePollInterval: null,
  isCheckingAuth: true,

  // Fonction pour vérifier l'authentification de l'utilisateur
  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/me");
      set({ authUser: res.data, isCheckingAuth: false });
      get().connectSocket();
    } catch {
      set({ authUser: null, isCheckingAuth: false });
    }
  },

  // Fonction pour inscrire un nouvel utilisateur (connexion immédiate ;
  // voir la note dans auth.controller.js sur la vérification d'email
  // temporairement désactivée)
  signup: async (data) => {
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      get().connectSocket();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Fonction pour connecter un utilisateur existant
  login: async (data) => {
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
        needsVerification: error.response?.data?.needsVerification || false,
      };
    }
  },

  // Confirme l'adresse email via le jeton reçu par lien, et connecte
  // directement l'utilisateur si c'est valide
  verifyEmail: async (token) => {
    try {
      const res = await axiosInstance.get(`/auth/verify-email/${token}`);
      set({ authUser: res.data });
      get().connectSocket();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Redemande un email de confirmation (compte créé mais email jamais reçu)
  resendVerification: async (email) => {
    try {
      const res = await axiosInstance.post("/auth/resend-verification", { email });
      return { success: true, message: res.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Demande l'envoi d'un email de réinitialisation de mot de passe
  forgotPassword: async (email) => {
    try {
      const res = await axiosInstance.post("/auth/forgot-password", { email });
      return { success: true, message: res.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Définit le nouveau mot de passe via le jeton reçu par lien
  resetPassword: async (token, password) => {
    try {
      const res = await axiosInstance.post(`/auth/reset-password/${token}`, { password });
      return { success: true, message: res.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Fonction pour déconnecter l'utilisateur
  logout: async () => {
    await axiosInstance.post("/auth/logout");
    get().disconnectSocket();
    set({ authUser: null });
  },

  // Déconnecte tous les appareils connectés à ce compte (y compris celui-ci)
  logoutAllDevices: async () => {
    try {
      await axiosInstance.post("/auth/logout-all-devices");
      get().disconnectSocket();
      set({ authUser: null });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Fonction pour demander la permission de notification à l'utilisateur
  requestNotificationPermission: () => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  },

  // Fonction pour connecter le socket de l'utilisateur
  connectSocket: () => {
    const { authUser, socket } = get();
    if (!authUser || socket?.connected) return;

    const newSocket = io(SOCKET_URL, {
      query: { userId: authUser._id },
    });

    newSocket.connect();
    set({ socket: newSocket });

    get().requestNotificationPermission();

    newSocket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });

    // Filet de sécurité : revérifie qui est en ligne toutes les 10s
    const interval = setInterval(async () => {
      try {
        const res = await axiosInstance.get("/users/online");
        set({ onlineUsers: res.data });
      } catch {
        // ignore les erreurs de sondage silencieusement
      }
    }, 10000);
    set({ onlinePollInterval: interval });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        const { socket } = get();
        if (!socket || !socket.connected) {
          get().disconnectSocket();
          get().connectSocket();
        }
      }
    });
  },

  // Fonction pour déconnecter le socket de l'utilisateur
  disconnectSocket: () => {
    if (get().socket?.connected) get().socket.disconnect();
    const interval = get().onlinePollInterval;
    if (interval) clearInterval(interval);
    set({ onlinePollInterval: null });
  },

  // Fonction pour mettre à jour la photo de profil
  updateProfile: async (file) => {
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await axiosInstance.put("/users/profile", formData);
      set({ authUser: res.data });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Fonction pour changer le mot de passe
  changePassword: async (currentPassword, newPassword) => {
    try {
      await axiosInstance.put("/users/change-password", {
        currentPassword,
        newPassword,
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Fonction pour supprimer définitivement le compte
  deleteAccount: async (password) => {
    try {
      await axiosInstance.delete("/users/account", { data: { password } });
      get().disconnectSocket();
      set({ authUser: null });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Fonction pour bloquer ou débloquer un utilisateur (bascule automatique)
  toggleBlockUser: async (userId) => {
    try {
      const res = await axiosInstance.put(`/users/block/${userId}`);
      set({
        authUser: {
          ...get().authUser,
          blockedUsers: res.data.blockedUsers,
        },
        // Si on débloque depuis la page de profil, on retire aussi
        // l'entrée de la liste détaillée affichée là-bas
        blockedUsersList: res.data.blocked
          ? get().blockedUsersList
          : get().blockedUsersList.filter((u) => u._id !== userId),
      });
      return { success: true, blocked: res.data.blocked };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Coupe ou réactive les notifications push pour une conversation précise
  // (id d'un contact ou d'un groupe). Stocké côté serveur, car c'est le
  // serveur qui décide d'envoyer ou non une notification push.
  toggleMuteConversation: async (conversationId) => {
    try {
      const res = await axiosInstance.put(`/users/mute/${conversationId}`);
      const current = get().authUser?.mutedConversations || [];
      set({
        authUser: {
          ...get().authUser,
          mutedConversations: res.data.muted
            ? [...current, conversationId]
            : current.filter((id) => id !== conversationId),
        },
      });
      return res.data.muted;
    } catch (error) {
      console.error(error);
      return get().authUser?.mutedConversations?.includes(conversationId) || false;
    }
  },

  // Change le nom d'utilisateur du compte connecté
  updateUsername: async (username) => {
    try {
      const res = await axiosInstance.put("/users/username", { username });
      set({ authUser: res.data });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Change l'adresse email du compte connecté
  updateEmail: async (email) => {
    try {
      const res = await axiosInstance.put("/users/email", { email });
      set({ authUser: res.data });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Règle (ou désactive avec 0) la durée d'autodestruction des messages
  // qu'on envoie soi-même dans une conversation précise
  setDisappearingTimer: async (conversationId, seconds) => {
    try {
      const res = await axiosInstance.put(`/users/disappearing-timer/${conversationId}`, {
        seconds,
      });
      set({
        authUser: {
          ...get().authUser,
          disappearingTimers: res.data.disappearingTimers,
        },
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Erreur",
      };
    }
  },

  // Liste détaillée des utilisateurs bloqués, pour la page de profil
  blockedUsersList: [],
  getBlockedUsersList: async () => {
    try {
      const res = await axiosInstance.get("/users/blocked-list");
      set({ blockedUsersList: res.data.blockedUsers });
    } catch (error) {
      console.error(error);
    }
  },
}));
