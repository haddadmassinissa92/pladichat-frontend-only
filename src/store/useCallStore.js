// store/useCallStore.js

import { create } from "zustand";
import { useAuthStore } from "@/store/useAuthStore";

// Serveur STUN public (gratuit, sans inscription) : aide les navigateurs à
// se joindre directement, même derrière un routeur/NAT. Limitation connue :
// sans serveur TURN (payant), l'appel peut échouer sur certains réseaux très
// restrictifs (grandes entreprises, certains réseaux mobiles).
const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export const useCallStore = create((set, get) => ({
  // 'idle' | 'calling' (appel privé sortant) | 'ringing' (appel entrant,
  // privé ou groupe) | 'active' (en communication)
  callStatus: "idle",
  callMode: null, // 'private' | 'group'
  callType: null, // 'audio' | 'video'
  groupId: null, // uniquement en mode groupe
  groupName: null,

  // --- Mode privé ---
  remoteUser: null, // { _id, username, avatar } de l'autre participant
  peerConnection: null,
  pendingCandidates: [],
  incomingOfferData: null,

  // --- Mode groupe ---
  // Un participant par entrée : { [userId]: { username, avatar, stream, peerConnection, pendingCandidates } }
  participants: {},
  incomingGroupCallData: null, // { groupId, groupName, callType, callerName, callerAvatar, callerId }

  // --- Commun aux deux modes ---
  localStream: null,
  isMuted: false,
  isCameraOff: false,

  // Crée une connexion peer-to-peer générique, avec ses gestionnaires
  // d'événements. `onIceCandidate` et `onTrack` sont fournis par l'appelant
  // pour brancher le bon comportement selon le mode (privé ou groupe)
  createPeerConnection: (onIceCandidate, onTrack) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pc.onicecandidate = (event) => {
      if (event.candidate) onIceCandidate(event.candidate);
    };
    pc.ontrack = (event) => onTrack(event.streams[0]);
    return pc;
  },

  // ============================================================
  // APPELS PRIVÉS (1-à-1)
  // ============================================================

  startCall: async (targetUser, callType) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });

      const socket = useAuthStore.getState().socket;
      const pc = get().createPeerConnection(
        (candidate) => socket?.emit("iceCandidate", { to: targetUser._id, candidate }),
        (remoteStream) => set({ remoteStream }),
      );
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const authUser = useAuthStore.getState().authUser;
      socket?.emit("callUser", {
        to: targetUser._id,
        from: authUser._id,
        offer,
        callType,
        callerName: authUser.username,
        callerAvatar: authUser.avatar,
      });

      set({
        callStatus: "calling",
        callMode: "private",
        callType,
        remoteUser: targetUser,
        localStream: stream,
        peerConnection: pc,
      });
    } catch (error) {
      console.error(error);
      alert("Impossible d'accéder au micro/caméra.");
    }
  },

  handleIncomingCall: (data) => {
    if (get().callStatus !== "idle") return;
    set({
      callStatus: "ringing",
      callMode: "private",
      callType: data.callType,
      remoteUser: { _id: data.from, username: data.callerName, avatar: data.callerAvatar },
      incomingOfferData: data,
    });
  },

  acceptCall: async () => {
    const { incomingOfferData, callType } = get();
    if (!incomingOfferData) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });

      const socket = useAuthStore.getState().socket;
      const pc = get().createPeerConnection(
        (candidate) => socket?.emit("iceCandidate", { to: incomingOfferData.from, candidate }),
        (remoteStream) => set({ remoteStream }),
      );
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferData.offer));

      for (const candidate of get().pendingCandidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error(e);
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket?.emit("answerCall", { to: incomingOfferData.from, answer });

      set({
        callStatus: "active",
        localStream: stream,
        peerConnection: pc,
        pendingCandidates: [],
        incomingOfferData: null,
      });
    } catch (error) {
      console.error(error);
      get().resetCallState();
    }
  },

  rejectCall: () => {
    const { remoteUser } = get();
    const socket = useAuthStore.getState().socket;
    if (remoteUser) socket?.emit("rejectCall", { to: remoteUser._id });
    get().resetCallState();
  },

  handleCallAccepted: async ({ answer }) => {
    const { peerConnection, pendingCandidates } = get();
    if (!peerConnection) return;

    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    for (const candidate of pendingCandidates) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error(e);
      }
    }
    set({ callStatus: "active", pendingCandidates: [] });
  },

  handleIceCandidate: async ({ candidate }) => {
    const pc = get().peerConnection;
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error(e);
      }
    } else {
      set({ pendingCandidates: [...get().pendingCandidates, candidate] });
    }
  },

  handleCallRejected: () => get().resetCallState(),
  handleCallEnded: () => get().resetCallState(),
  handleCallUnavailable: () => {
    get().resetCallState();
    alert("Cette personne n'est pas disponible actuellement.");
  },

  endCall: () => {
    const { callMode, remoteUser } = get();
    if (callMode === "group") {
      get().leaveGroupCall();
      return;
    }
    const socket = useAuthStore.getState().socket;
    if (remoteUser) socket?.emit("endCall", { to: remoteUser._id });
    get().resetCallState();
  },

  // Ajoute une ou plusieurs personnes à l'appel en cours (comme sur
  // WhatsApp/Messenger). Si l'appel était encore privé (1-à-1), il est
  // d'abord converti en appel de groupe : le partenaire actuel est prévenu
  // pour qu'il rejoigne lui aussi la nouvelle "salle" d'appel.
  addParticipantsToCall: (newUsers) => {
    const state = get();
    const authUser = useAuthStore.getState().authUser;
    const socket = useAuthStore.getState().socket;
    let { groupId, callType } = state;

    if (state.callMode === "private" && state.remoteUser) {
      // Conversion : le partenaire actuel devient le premier "participant"
      // d'un appel de groupe, en réutilisant sa connexion déjà établie
      groupId = crypto.randomUUID();
      const previousPartner = state.remoteUser;

      set({
        callMode: "group",
        groupId,
        groupName: [authUser.username, previousPartner.username, ...newUsers.map((u) => u.username)].join(", "),
        participants: {
          [previousPartner._id]: {
            username: previousPartner.username,
            avatar: previousPartner.avatar,
            stream: state.remoteStream,
            peerConnection: state.peerConnection,
            pendingCandidates: [],
          },
        },
        remoteUser: null,
        remoteStream: null,
        peerConnection: null,
      });

      // On rejoint la nouvelle salle nous-même, et on prévient l'ancien
      // partenaire qu'il doit la rejoindre aussi (sans casser sa connexion actuelle)
      socket?.emit("joinGroupCall", {
        groupId,
        userId: authUser._id,
        username: authUser.username,
        avatar: authUser.avatar,
      });
      socket?.emit("callUpgradedToGroup", {
        to: previousPartner._id,
        groupId,
        groupName: get().groupName,
      });
    }

    // Invite les nouvelles personnes à rejoindre cette salle
    socket?.emit("startGroupCall", {
      groupId,
      targetUserIds: newUsers.map((u) => u._id),
      callType,
      callerName: authUser.username,
      callerAvatar: authUser.avatar,
      callerId: authUser._id,
    });
  },

  // Reçu par le partenaire d'un appel privé quand l'autre personne vient
  // d'ajouter quelqu'un : on rejoint la même salle nous aussi, en gardant
  // notre connexion déjà établie (sans la recréer)
  handleCallUpgradedToGroup: ({ groupId, groupName }) => {
    const state = get();
    if (state.callMode !== "private" || !state.remoteUser) return;

    const authUser = useAuthStore.getState().authUser;
    const socket = useAuthStore.getState().socket;
    const previousPartner = state.remoteUser;

    set({
      callMode: "group",
      groupId,
      groupName: groupName || null,
      participants: {
        [previousPartner._id]: {
          username: previousPartner.username,
          avatar: previousPartner.avatar,
          stream: state.remoteStream,
          peerConnection: state.peerConnection,
          pendingCandidates: [],
        },
      },
      remoteUser: null,
      remoteStream: null,
      peerConnection: null,
    });

    socket?.emit("joinGroupCall", {
      groupId,
      userId: authUser._id,
      username: authUser.username,
      avatar: authUser.avatar,
    });
  },

  // ============================================================
  // APPELS DE GROUPE (mesh : une connexion directe par paire)
  // ============================================================

  // Lance un appel de groupe : rejoint immédiatement la salle (seul pour
  // l'instant), et invite uniquement les membres sélectionnés (targetUserIds)
  startGroupCall: async (group, callType, targetUserIds) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });

      const authUser = useAuthStore.getState().authUser;
      const socket = useAuthStore.getState().socket;

      set({
        callStatus: "active",
        callMode: "group",
        callType,
        groupId: group._id,
        groupName: group.name,
        localStream: stream,
        participants: {},
      });

      socket?.emit("joinGroupCall", {
        groupId: group._id,
        userId: authUser._id,
        username: authUser.username,
        avatar: authUser.avatar,
      });

      socket?.emit("startGroupCall", {
        groupId: group._id,
        targetUserIds,
        callType,
        callerName: authUser.username,
        callerAvatar: authUser.avatar,
        callerId: authUser._id,
      });
    } catch (error) {
      console.error(error);
      alert("Impossible d'accéder au micro/caméra.");
    }
  },

  // Reçoit une invitation à un appel de groupe déjà en cours
  handleIncomingGroupCall: (data) => {
    if (get().callStatus !== "idle") return;
    set({
      callStatus: "ringing",
      callMode: "group",
      callType: data.callType,
      groupId: data.groupId,
      groupName: null,
      incomingGroupCallData: data,
    });
  },

  // Accepte l'invitation : rejoint la salle, ce qui déclenchera la création
  // d'une connexion directe vers chaque participant déjà présent
  acceptGroupCall: async () => {
    const { incomingGroupCallData, callType } = get();
    if (!incomingGroupCallData) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });

      const authUser = useAuthStore.getState().authUser;
      const socket = useAuthStore.getState().socket;

      set({
        callStatus: "active",
        localStream: stream,
        participants: {},
        incomingGroupCallData: null,
      });

      socket?.emit("joinGroupCall", {
        groupId: incomingGroupCallData.groupId,
        userId: authUser._id,
        username: authUser.username,
        avatar: authUser.avatar,
      });
    } catch (error) {
      console.error(error);
      get().resetCallState();
    }
  },

  rejectGroupCall: () => {
    get().resetCallState();
  },

  // Reçoit la liste de ceux déjà présents dans la salle : on initie une
  // connexion (offre) vers chacun d'eux, sauf si on est déjà connecté à
  // cette personne (cas d'une conversion d'appel privé en appel de groupe)
  handleGroupCallParticipants: async ({ participants }) => {
    const { localStream, groupId } = get();
    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;

    for (const p of participants) {
      if (get().participants[p.userId]) continue;

      const pc = get().createPeerConnection(
        (candidate) =>
          socket?.emit("groupIceCandidate", { to: p.userId, from: authUser._id, candidate }),
        (remoteStream) => {
          set((state) => ({
            participants: {
              ...state.participants,
              [p.userId]: { ...state.participants[p.userId], stream: remoteStream },
            },
          }));
        },
      );
      localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      set((state) => ({
        participants: {
          ...state.participants,
          [p.userId]: {
            username: p.username,
            avatar: p.avatar,
            stream: null,
            peerConnection: pc,
            pendingCandidates: [],
          },
        },
      }));

      socket?.emit("groupCallOffer", {
        to: p.userId,
        from: authUser._id,
        offer,
        groupId,
        fromUsername: authUser.username,
        fromAvatar: authUser.avatar,
      });
    }
  },

  // Un nouveau participant nous envoie une offre : on crée notre connexion
  // vers lui et on répond
  handleGroupCallOffer: async ({ from, offer, fromUsername, fromAvatar }) => {
    const { localStream } = get();
    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;

    const pc = get().createPeerConnection(
      (candidate) => socket?.emit("groupIceCandidate", { to: from, from: authUser._id, candidate }),
      (remoteStream) => {
        set((state) => ({
          participants: {
            ...state.participants,
            [from]: { ...state.participants[from], stream: remoteStream },
          },
        }));
      },
    );
    localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));
    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    set((state) => ({
      participants: {
        ...state.participants,
        [from]: {
          username: fromUsername,
          avatar: fromAvatar,
          stream: null,
          peerConnection: pc,
          pendingCandidates: [],
        },
      },
    }));

    socket?.emit("groupCallAnswer", { to: from, from: authUser._id, answer });
  },

  // Réponse reçue à notre offre envoyée à un participant déjà présent
  handleGroupCallAnswer: async ({ from, answer }) => {
    const participant = get().participants[from];
    if (!participant?.peerConnection) return;

    await participant.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    for (const candidate of participant.pendingCandidates) {
      try {
        await participant.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error(e);
      }
    }
    set((state) => ({
      participants: {
        ...state.participants,
        [from]: { ...state.participants[from], pendingCandidates: [] },
      },
    }));
  },

  handleGroupIceCandidate: async ({ from, candidate }) => {
    const participant = get().participants[from];
    if (!participant) return;

    if (participant.peerConnection?.remoteDescription) {
      try {
        await participant.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error(e);
      }
    } else {
      set((state) => ({
        participants: {
          ...state.participants,
          [from]: {
            ...state.participants[from],
            pendingCandidates: [...state.participants[from].pendingCandidates, candidate],
          },
        },
      }));
    }
  },

  // Quelqu'un a rejoint la salle (information, la vraie connexion se fait
  // via l'échange d'offre qui suit séparément)
  handleUserJoinedGroupCall: () => {},

  // Un participant a quitté : on ferme sa connexion et on le retire de l'affichage
  handleUserLeftGroupCall: ({ userId }) => {
    const participant = get().participants[userId];
    participant?.peerConnection?.close();
    set((state) => {
      const updated = { ...state.participants };
      delete updated[userId];
      return { participants: updated };
    });
  },

  // Quitte volontairement l'appel de groupe
  leaveGroupCall: () => {
    const { groupId, participants } = get();
    const authUser = useAuthStore.getState().authUser;
    const socket = useAuthStore.getState().socket;

    if (groupId && authUser) {
      socket?.emit("leaveGroupCall", { groupId, userId: authUser._id });
    }
    Object.values(participants).forEach((p) => p.peerConnection?.close());
    get().resetCallState();
  },

  // ============================================================
  // COMMUN
  // ============================================================

  resetCallState: () => {
    const { localStream, peerConnection } = get();
    localStream?.getTracks().forEach((track) => track.stop());
    peerConnection?.close();

    set({
      callStatus: "idle",
      callMode: null,
      callType: null,
      groupId: null,
      groupName: null,
      remoteUser: null,
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      pendingCandidates: [],
      incomingOfferData: null,
      participants: {},
      incomingGroupCallData: null,
      isMuted: false,
      isCameraOff: false,
    });
  },

  toggleMute: () => {
    const { localStream, isMuted } = get();
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = isMuted;
    });
    set({ isMuted: !isMuted });
  },

  toggleCamera: () => {
    const { localStream, isCameraOff } = get();
    localStream?.getVideoTracks().forEach((track) => {
      track.enabled = isCameraOff;
    });
    set({ isCameraOff: !isCameraOff });
  },
}));
