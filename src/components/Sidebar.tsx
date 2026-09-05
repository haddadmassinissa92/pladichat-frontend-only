"use client";

type User = {
  _id: string;
  username: string;
  email: string;
  avatar: string;
  lastMessage?: {
    text?: string;
    image?: string;
    audio?: string;
    createdAt: string;
    sender: string;
  } | null;
  unreadCount?: number;
};

type Group = {
  _id: string;
  name: string;
  members: User[];
  lastMessage?: {
    text?: string;
    image?: string;
    audio?: string;
    createdAt: string;
    sender: { _id: string; username: string } | string;
  } | null;
  unreadCount?: number;
};

type DiscoverableGroup = {
  _id: string;
  name: string;
  memberCount: number;
  requestPending: boolean;
  createdBy: string;
};

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Search, Plus, Palette, Camera, Moon, Bell, BellOff, Lock, LogOut, Trash2, UserPlus, X, Music, Volume2, UserCheck, Pencil, Ban, Link as LinkIcon, EyeOff, QrCode, Compass } from "lucide-react";
import imageCompression from "browser-image-compression";
import { useChatStore } from "@/store/useChatStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useCallStore } from "@/store/useCallStore";
import Avatar from "./Avatar";
import CallModal from "./CallModal";
import {
  WALLPAPERS,
  getGlobalWallpaper,
  setGlobalWallpaper,
  setGlobalWallpaperImage,
} from "@/lib/wallpaper";
import { RINGTONES, getRingtone, setRingtone } from "@/lib/ringtone";
import { ACCENT_COLORS, getAccentColor, setAccentColor } from "@/lib/accentColor";
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  isPushSubscribed,
} from "@/lib/push";
import {
  isConversationHidden,
  isConversationPinned,
  unhideConversation,
  getNickname,
  isConversationManuallyUnread,
  clearManuallyUnread,
} from "@/lib/conversationSettings";

function formatLastMessage(
  msg:
    | {
        text?: string;
        image?: string;
        audio?: string;
      }
    | null
    | undefined,
): string {
  if (!msg) return "";
  if (msg.image) return "📷 Photo";
  if (msg.audio) return "🎤 Message vocal";
  return msg.text || "";
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function toggleTheme(): boolean {
  const html = document.documentElement;
  const isDark = html.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  return isDark;
}

export default function Sidebar() {
  const {
    users,
    getUsers,
    hasMoreUsers,
    isLoadingMoreUsers,
    loadMoreUsers,
    selectedUser,
    setSelectedUser,
    isUsersLoading,
    groups,
    getGroups,
    selectedGroup,
    setSelectedGroup,
    createGroup,
    discoverableGroups,
    isLoadingDiscoverableGroups,
    getDiscoverableGroups,
    requestToJoinGroup,
    discoverResults,
    isDiscovering,
    discoverUsers,
    addContact,
    contactRequests,
    getContactRequests,
    acceptContactRequest,
    declineContactRequest,
    sentContactRequests,
    typingUserIds,
    handleGlobalUserTyping,
    handleGlobalUserStopTyping,
    typingGroupSenders,
    handleGlobalGroupUserTyping,
    handleGlobalGroupUserStopTyping,
    globalSearchResults,
    isGlobalSearching,
    searchAllConversations,
    clearGlobalSearchResults,
    getSentContactRequests,
    cancelContactRequest,
    previewDiscoverableGroup,
  } = useChatStore();
  const {
    onlineUsers,
    authUser,
    logout,
    logoutAllDevices,
    updateProfile,
    socket,
    changePassword,
    deleteAccount,
    updateUsername,
    updateEmail,
    blockedUsersList,
    getBlockedUsersList,
    toggleBlockUser,
    toggleMuteConversation,
  } = useAuthStore();
  const {
    handleIncomingCall,
    handleCallAccepted,
    handleIceCandidate,
    handleCallRejected,
    handleCallEnded,
    handleRemoteCameraToggled,
    handleGroupCameraToggled,
    handleCallUnavailable,
    handleIncomingGroupCall,
    handleGroupCallParticipants,
    handleGroupCallOffer,
    handleGroupCallAnswer,
    handleGroupIceCandidate,
    handleUserJoinedGroupCall,
    handleUserLeftGroupCall,
    handleCallUpgradedToGroup,
  } = useCallStore();

  const [search, setSearch] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showMyProfileZoom, setShowMyProfileZoom] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [showQrCodeOnly, setShowQrCodeOnly] = useState(false);
  const [showLogoutAllConfirm, setShowLogoutAllConfirm] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const handleLogoutAllDevices = async () => {
    setIsLoggingOutAll(true);
    await logoutAllDevices();
    setIsLoggingOutAll(false);
    setShowLogoutAllConfirm(false);
  };
  const [showMutedList, setShowMutedList] = useState(false);
  const [showSentRequests, setShowSentRequests] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailError, setEmailError] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  const handleSaveUsername = async () => {
    const result = await updateUsername(usernameDraft);
    if (result.success) {
      setIsEditingUsername(false);
      setUsernameError("");
    } else {
      setUsernameError(result.message);
    }
  };

  const handleSaveEmail = async () => {
    const result = await updateEmail(emailDraft);
    if (result.success) {
      setIsEditingEmail(false);
      setEmailError("");
    } else {
      setEmailError(result.message);
    }
  };

  const shareLink = authUser?.username
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/add/${authUser.username}`
    : "";

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };
  const [showRingtoneMenu, setShowRingtoneMenu] = useState(false);
  const [showHiddenConversations, setShowHiddenConversations] = useState(false);
  const [selectedRingtone, setSelectedRingtone] = useState("classic");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedRingtone(getRingtone());
  }, []);
  const handleRingtoneChange = (id: string) => {
    setRingtone(id);
    setSelectedRingtone(id);
  };
  const [selectedAccent, setSelectedAccent] = useState("indigo");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedAccent(getAccentColor());
  }, []);
  const handleAccentChange = (id: string) => {
    setAccentColor(id);
    setSelectedAccent(id);
  };
  const [uploading, setUploading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // État des notifications push : vérifie au chargement si on est déjà abonné
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    isPushSubscribed().then(setPushEnabled);
  }, []);

  const handleTogglePush = async () => {
    setPushLoading(true);
    if (pushEnabled) {
      const result = await unsubscribeFromPushNotifications();
      if (result.success) setPushEnabled(false);
    } else {
      const result = await subscribeToPushNotifications();
      if (result.success) {
        setPushEnabled(true);
      } else if (result.message) {
        alert(result.message);
      }
    }
    setPushLoading(false);
  };

  // Découverte de groupes publics et demandes d'adhésion
  const [showDiscoverGroups, setShowDiscoverGroups] = useState(false);

  // Déclenche une recherche côté serveur (sur toute la base) à chaque
  // changement du champ, avec un léger délai pour ne pas spammer l'API
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      getUsers(value);
    }, 300);
  };

  // Recherche dans l'annuaire complet (modale "Ajouter un contact"), avec le
  // même principe de délai que la recherche dans ses propres contacts
  const [showAddContact, setShowAddContact] = useState(false);
  const [addContactSearch, setAddContactSearch] = useState("");
  const addContactDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleAddContactSearchChange = (value: string) => {
    setAddContactSearch(value);
    if (addContactDebounceRef.current) clearTimeout(addContactDebounceRef.current);
    addContactDebounceRef.current = setTimeout(() => {
      discoverUsers(value);
    }, 300);
  };
  const handleAddContact = async (userId: string) => {
    await addContact(userId);
  };

  // Recherche globale dans toutes les conversations à la fois
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const globalSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleGlobalSearchChange = (value: string) => {
    setGlobalSearchQuery(value);
    if (globalSearchDebounceRef.current) clearTimeout(globalSearchDebounceRef.current);
    globalSearchDebounceRef.current = setTimeout(() => {
      searchAllConversations(value);
    }, 300);
  };
  const handleGlobalSearchResultClick = (result: {
    sender: { _id: string };
    receiver?: { _id: string };
    group?: { _id: string };
  }) => {
    if (result.group) {
      const fullGroup = groups.find((g: Group) => g._id === result.group?._id);
      if (fullGroup) {
        setSelectedUser(null);
        setSelectedGroup(fullGroup);
      }
    } else {
      const otherId = result.sender._id === authUser?._id ? result.receiver?._id : result.sender._id;
      const fullUser = users.find((u: User) => u._id === otherId);
      if (fullUser) {
        setSelectedGroup(null);
        setSelectedUser(fullUser);
      }
    }
    setShowGlobalSearch(false);
    setGlobalSearchQuery("");
    clearGlobalSearchResults();
  };

  const handleOpenDiscoverGroups = () => {
    setShowDiscoverGroups(true);
    getDiscoverableGroups();
  };

  const handleRequestToJoin = async (groupId: string) => {
    await requestToJoinGroup(groupId);
  };

  // Détecte l'arrivée en bas de la liste des contacts/groupes, pour charger
  // automatiquement la page de contacts suivante (défilement infini)
  const handleContactsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 100 && hasMoreUsers && !isLoadingMoreUsers) {
      loadMoreUsers();
    }
  };

  // Ouvre la conversation d'un groupe découvrable (aperçu, sans en être membre) :
  // permet d'écrire un message de candidature, en refermant la modale de découverte
  const handlePreviewGroup = (group: DiscoverableGroup) => {
    previewDiscoverableGroup(group);
    setShowDiscoverGroups(false);
  };

  // Thème de fond par défaut, appliqué à toutes les discussions sans réglage propre
  const [globalWallpaper, setGlobalWallpaperState] = useState(() =>
    getGlobalWallpaper(),
  );
  const [showGlobalWallpaperMenu, setShowGlobalWallpaperMenu] = useState(false);
  const globalWallpaperFileInputRef = useRef<HTMLInputElement>(null);

  const handleGlobalWallpaperChange = (id: string) => {
    setGlobalWallpaperState(id);
    setGlobalWallpaper(id);
    setShowGlobalWallpaperMenu(false);
  };

  const handleGlobalWallpaperImageSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      });
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setGlobalWallpaperImage(dataUrl);
        handleGlobalWallpaperChange("custom");
      };
      reader.readAsDataURL(compressed);
    } catch (error) {
      console.error("Erreur de compression du fond:", error);
    }
  };

  useEffect(() => {
    getUsers();
    getGroups();
    getContactRequests();
  }, [getUsers, getGroups, getContactRequests]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      getUsers();
      getGroups();
    };
    const handleNewMessage = (msg: { sender?: string; group?: string }) => {
      refresh();
      // Une conversation "supprimée" localement réapparaît dès qu'un
      // nouveau message y arrive, comme sur WhatsApp
      unhideConversation(msg.group || msg.sender || "");
    };
    socket.on("newMessage", handleNewMessage);
    socket.on("conversationCleared", refresh);
    socket.on("messagesRead", refresh);

    // Un groupe a été renommé, ou des membres y ont été ajoutés/retirés/bloqués :
    // on rafraîchit la liste pour refléter le changement (utile même quand ce
    // groupe n'est pas la conversation actuellement ouverte)
    socket.on("groupUpdated", refresh);

    // On a été retiré d'un groupe : on rafraîchit la liste (il disparaîtra),
    // et si on avait cette conversation ouverte, on la referme
    const handleRemovedFromGroup = ({ groupId }: { groupId: string }) => {
      refresh();
      if (selectedGroup?._id === groupId) {
        setSelectedGroup(null);
      }
    };
    socket.on("removedFromGroup", handleRemovedFromGroup);

    // Une demande d'adhésion à l'un de nos groupes vient d'arriver : on
    // rafraîchit la liste (elle contient déjà les demandes en attente) et on
    // notifie si l'onglet est en arrière-plan
    const handleJoinRequestReceived = ({
      groupName,
    }: {
      groupId: string;
      groupName: string;
    }) => {
      refresh();
      if (
        document.hidden &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification("Nouvelle demande d'adhésion", {
          body: `Quelqu'un souhaite rejoindre "${groupName}"`,
        });
      }
    };
    socket.on("joinRequestReceived", handleJoinRequestReceived);

    // Notre demande d'adhésion a été acceptée : le groupe apparaît dans notre liste,
    // et si on avait l'aperçu de ce groupe ouvert, on bascule vers la vraie
    // conversation (avec les vrais membres, messages, etc.)
    const handleJoinRequestApproved = ({
      group,
    }: {
      group: Group & { _id: string };
    }) => {
      refresh();
      if (selectedGroup?._id === group._id) {
        setSelectedGroup(group);
      }
    };
    socket.on("joinRequestApproved", handleJoinRequestApproved);

    // Notre demande d'adhésion a été refusée : simple information
    const handleJoinRequestRejected = ({
      groupName,
    }: {
      groupId: string;
      groupName: string;
    }) => {
      if (
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification("Demande refusée", {
          body: `Ta demande pour rejoindre "${groupName}" a été refusée.`,
        });
      }
    };
    socket.on("joinRequestRejected", handleJoinRequestRejected);

    // --- Écouteurs d'appel privé (1-à-1) ---
    socket.on("incomingCall", handleIncomingCall);
    socket.on("callAccepted", handleCallAccepted);
    socket.on("iceCandidate", handleIceCandidate);
    socket.on("callRejected", handleCallRejected);
    socket.on("callEnded", handleCallEnded);
    socket.on("callUnavailable", handleCallUnavailable);
    socket.on("cameraToggled", handleRemoteCameraToggled);
    socket.on("groupCameraToggled", handleGroupCameraToggled);
    socket.on("userTyping", handleGlobalUserTyping);
    socket.on("userStopTyping", handleGlobalUserStopTyping);
    socket.on("groupUserTyping", handleGlobalGroupUserTyping);
    socket.on("groupUserStopTyping", handleGlobalGroupUserStopTyping);
    socket.on("contactRequestReceived", getContactRequests);
    socket.on("contactRequestAccepted", refresh);

    // --- Écouteurs d'appel de groupe ---
    socket.on("incomingGroupCall", handleIncomingGroupCall);
    socket.on("groupCallParticipants", handleGroupCallParticipants);
    socket.on("incomingGroupCallOffer", handleGroupCallOffer);
    socket.on("groupCallAnswerReceived", handleGroupCallAnswer);
    socket.on("groupIceCandidate", handleGroupIceCandidate);
    socket.on("userJoinedGroupCall", handleUserJoinedGroupCall);
    socket.on("userLeftGroupCall", handleUserLeftGroupCall);
    socket.on("callUpgradedToGroup", handleCallUpgradedToGroup);

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("conversationCleared", refresh);
      socket.off("messagesRead", refresh);
      socket.off("groupUpdated", refresh);
      socket.off("removedFromGroup", handleRemovedFromGroup);
      socket.off("joinRequestReceived", handleJoinRequestReceived);
      socket.off("joinRequestApproved", handleJoinRequestApproved);
      socket.off("joinRequestRejected", handleJoinRequestRejected);
      socket.off("incomingCall", handleIncomingCall);
      socket.off("callAccepted", handleCallAccepted);
      socket.off("iceCandidate", handleIceCandidate);
      socket.off("callRejected", handleCallRejected);
      socket.off("callEnded", handleCallEnded);
      socket.off("callUnavailable", handleCallUnavailable);
      socket.off("cameraToggled", handleRemoteCameraToggled);
      socket.off("groupCameraToggled", handleGroupCameraToggled);
      socket.off("userTyping", handleGlobalUserTyping);
      socket.off("userStopTyping", handleGlobalUserStopTyping);
      socket.off("groupUserTyping", handleGlobalGroupUserTyping);
      socket.off("groupUserStopTyping", handleGlobalGroupUserStopTyping);
      socket.off("contactRequestReceived", getContactRequests);
      socket.off("contactRequestAccepted", refresh);
      socket.off("incomingGroupCall", handleIncomingGroupCall);
      socket.off("groupCallParticipants", handleGroupCallParticipants);
      socket.off("incomingGroupCallOffer", handleGroupCallOffer);
      socket.off("groupCallAnswerReceived", handleGroupCallAnswer);
      socket.off("groupIceCandidate", handleGroupIceCandidate);
      socket.off("userJoinedGroupCall", handleUserJoinedGroupCall);
      socket.off("userLeftGroupCall", handleUserLeftGroupCall);
      socket.off("callUpgradedToGroup", handleCallUpgradedToGroup);
    };
  }, [
    socket,
    getUsers,
    getGroups,
    selectedGroup,
    setSelectedGroup,
    handleIncomingCall,
    handleCallAccepted,
    handleIceCandidate,
    handleCallRejected,
    handleCallEnded,
    handleCallUnavailable,
    handleRemoteCameraToggled,
    handleGroupCameraToggled,
    handleGlobalUserTyping,
    handleGlobalUserStopTyping,
    handleGlobalGroupUserTyping,
    handleGlobalGroupUserStopTyping,
    getContactRequests,
    handleIncomingGroupCall,
    handleGroupCallParticipants,
    handleGroupCallOffer,
    handleGroupCallAnswer,
    handleGroupIceCandidate,
    handleUserJoinedGroupCall,
    handleUserLeftGroupCall,
    handleCallUpgradedToGroup,
  ]);

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    const result = await createGroup(groupName, selectedMembers);
    if (result.success) {
      setGroupName("");
      setSelectedMembers([]);
      setShowCreateGroup(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await updateProfile(file);
    setUploading(false);
    setShowMyProfile(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    if (newPassword.length < 6) {
      setPasswordError("Le nouveau mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    const result = await changePassword(currentPassword, newPassword);
    if (result.success) {
      setShowChangePassword(false);
      setCurrentPassword("");
      setNewPassword("");
    } else {
      setPasswordError(result.message);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError("");
    const result = await deleteAccount(deletePassword);
    if (!result.success) {
      setDeleteError(result.message);
    }
  };

  // Les préférences par conversation (masquée/épinglée) vivent dans le
  // localStorage (lib/conversationSettings), donc pas réactives par défaut :
  // ce compteur est incrémenté à chaque changement ailleurs dans l'app
  // (voir l'évènement "chatSettingsChanged") pour forcer le recalcul du tri
  // et du filtrage ci-dessous.
  const [settingsVersion, setSettingsVersion] = useState(0);
  useEffect(() => {
    const onSettingsChanged = () => setSettingsVersion((v) => v + 1);
    window.addEventListener("chatSettingsChanged", onSettingsChanged);
    return () =>
      window.removeEventListener("chatSettingsChanged", onSettingsChanged);
  }, []);

  // Groupes et contacts visibles dans la liste : les conversations masquées
  // ("supprimées" localement) sont exclues, et les épinglées remontent en
  // premier au sein de chaque section
  const visibleGroups = groups
    .filter((g: Group) => !isConversationHidden(g._id))
    .sort((a: Group, b: Group) => {
      const pinnedDiff = Number(isConversationPinned(b._id)) - Number(isConversationPinned(a._id));
      return pinnedDiff;
    });
  const visibleUsers = users
    .filter((u: User) => !isConversationHidden(u._id))
    .sort((a: User, b: User) => {
      const pinnedDiff = Number(isConversationPinned(b._id)) - Number(isConversationPinned(a._id));
      return pinnedDiff;
    });

  // Contacts et groupes masqués : le backend les renvoie toujours (masquer
  // est une préférence purement locale), on les isole ici pour permettre de
  // les retrouver et les réafficher — sans ça, une conversation masquée est
  // perdue pour de bon tant qu'aucun nouveau message n'arrive
  const hiddenUsers = users.filter((u: User) => isConversationHidden(u._id));
  const hiddenGroups = groups.filter((g: Group) => isConversationHidden(g._id));
  const handleUnhide = (id: string) => {
    unhideConversation(id);
    window.dispatchEvent(new Event("chatSettingsChanged"));
  };

  // Contacts et groupes en sourdine (notifications coupées), pour les
  // retrouver et les réactiver depuis "Mon profil" sans devoir rouvrir
  // chaque conversation une par une
  const mutedUserIds = authUser?.mutedConversations || [];
  const mutedUsers = users.filter((u: User) => mutedUserIds.includes(u._id));
  const mutedGroups = groups.filter((g: Group) => mutedUserIds.includes(g._id));
  const handleUnmute = (id: string) => {
    toggleMuteConversation(id);
  };

  void settingsVersion; // force le recalcul ci-dessus à chaque changement

  return (
    <aside className="w-full h-full border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
      <CallModal />
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pink-600 text-white flex items-center justify-center font-bold text-sm">
            P
          </div>
          <h2 className="font-bold text-lg">PladiChat</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddContact(true)}
            className="relative text-zinc-600 dark:text-zinc-300 hover:text-accent-600 transition"
            aria-label="Ajouter un contact"
            title="Ajouter un contact"
          >
            <UserPlus size={20} strokeWidth={2} />
            {contactRequests.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                {contactRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={handleOpenDiscoverGroups}
            className="text-zinc-600 dark:text-zinc-300 hover:text-accent-600 transition"
            aria-label="Découvrir des groupes"
            title="Découvrir des groupes"
          >
            <Compass size={20} strokeWidth={2} />
          </button>
          <button
            onClick={() => setShowGlobalSearch(true)}
            className="text-zinc-600 dark:text-zinc-300 hover:text-accent-600 transition"
            aria-label="Rechercher dans mes messages"
            title="Rechercher dans mes messages"
          >
            <Search size={20} strokeWidth={2} />
          </button>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="text-zinc-600 dark:text-zinc-300 hover:text-accent-600 transition"
            aria-label="Créer un groupe"
          >
            <Plus size={22} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
        <input
          type="text"
          placeholder="Rechercher parmi mes contacts..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full border border-zinc-300 dark:border-zinc-700 rounded-full px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-sm"
        />
      </div>

      <div
        className="custom-scrollbar flex-1 overflow-y-auto"
        onScroll={handleContactsScroll}
      >
        {visibleGroups.length > 0 && (
          <div className="px-3 pt-2 text-xs font-semibold text-zinc-400 uppercase">
            Groupes
          </div>
        )}
        {visibleGroups.map((group: Group) => (
          <button
            key={group._id}
            onClick={() => {
              clearManuallyUnread(group._id);
              window.dispatchEvent(new Event("chatSettingsChanged"));
              setSelectedGroup(group);
            }}
            className={`w-full flex items-center gap-3 p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition ${
              selectedGroup?._id === group._id
                ? "bg-zinc-100 dark:bg-zinc-800"
                : ""
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-semibold">
              {group.name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{group.name}</span>
                {group.lastMessage && (
                  <span className="text-xs text-zinc-400 flex-shrink-0">
                    {formatTime(group.lastMessage.createdAt)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                {(() => {
                  const typers = typingGroupSenders.filter(
                    (t: { groupId: string; senderName: string }) =>
                      t.groupId === group._id,
                  );
                  return typers.length > 0 ? (
                    <p className="text-sm text-accent-600 dark:text-accent-400 truncate italic">
                      {typers.map((t: { groupId: string; senderName: string }) => t.senderName).join(", ")} en train d&apos;écrire...
                    </p>
                  ) : (
                    group.lastMessage && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                        {typeof group.lastMessage.sender === "object"
                          ? group.lastMessage.sender.username
                          : ""}
                        : {formatLastMessage(group.lastMessage)}
                      </p>
                    )
                  );
                })()}
                {!!group.unreadCount && (
                  <span className="bg-accent-600 text-white text-xs font-semibold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center flex-shrink-0">
                    {group.unreadCount > 99 ? "99+" : group.unreadCount}
                  </span>
                )}
                {!group.unreadCount && isConversationManuallyUnread(group._id) && (
                  <span className="w-2.5 h-2.5 bg-accent-600 rounded-full flex-shrink-0" />
                )}
              </div>
            </div>
          </button>
        ))}

        {isUsersLoading && (
          <p className="text-center text-sm text-zinc-400 mt-4">
            Chargement...
          </p>
        )}

        {!isUsersLoading && visibleUsers.length === 0 && (
          <p className="text-center text-sm text-zinc-400 mt-4 px-4">
            {search
              ? "Aucun contact ne correspond à cette recherche."
              : "Tu n'as encore aucun contact. Utilise le bouton ✚ en haut pour en ajouter."}
          </p>
        )}

        {visibleUsers.length > 0 && (
          <div className="px-3 pt-2 text-xs font-semibold text-zinc-400 uppercase">
            Contacts
          </div>
        )}

        {visibleUsers.map((user: User) => (
            <button
              key={user._id}
              onClick={() => {
                clearManuallyUnread(user._id);
                window.dispatchEvent(new Event("chatSettingsChanged"));
                setSelectedUser(user);
              }}
              className={`w-full flex items-center gap-3 p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition ${
                selectedUser?._id === user._id
                  ? "bg-zinc-100 dark:bg-zinc-800"
                  : ""
              }`}
            >
              <div className="relative">
                <Avatar
                  src={user.avatar}
                  fallback={user.username[0].toUpperCase()}
                  colorClass="bg-accent-600"
                />
                {onlineUsers.includes(user._id) && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full" />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">
                    {getNickname(user._id) || user.username}
                  </span>
                  {user.lastMessage && (
                    <span className="text-xs text-zinc-400 flex-shrink-0">
                      {formatTime(user.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  {typingUserIds.includes(user._id) ? (
                    <p className="text-sm text-accent-600 dark:text-accent-400 truncate italic">
                      en train d&apos;écrire...
                    </p>
                  ) : (
                    user.lastMessage && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                        {formatLastMessage(user.lastMessage)}
                      </p>
                    )
                  )}
                  {!!user.unreadCount && (
                    <span className="bg-accent-600 text-white text-xs font-semibold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center flex-shrink-0">
                      {user.unreadCount > 99 ? "99+" : user.unreadCount}
                    </span>
                  )}
                  {!user.unreadCount && isConversationManuallyUnread(user._id) && (
                    <span className="w-2.5 h-2.5 bg-accent-600 rounded-full flex-shrink-0" />
                  )}
                </div>
              </div>
            </button>
          ))}

        {isLoadingMoreUsers && (
          <p className="text-center text-xs text-zinc-400 py-3">
            Chargement d&apos;autres contacts...
          </p>
        )}

        {/* Lien vers les conversations masquées, uniquement s'il y en a au
            moins une — sans ça, une conversation masquée serait perdue
            pour de bon tant qu'aucun nouveau message n'arrive */}
        {(hiddenUsers.length > 0 || hiddenGroups.length > 0) && (
          <button
            onClick={() => setShowHiddenConversations(true)}
            className="w-full text-center text-xs text-zinc-400 hover:text-accent-600 py-3 border-t border-zinc-100 dark:border-zinc-800 transition"
          >
            Conversations masquées ({hiddenUsers.length + hiddenGroups.length})
          </button>
        )}
      </div>

      {/* Modale : conversations masquées, pour pouvoir les réafficher */}
      {showHiddenConversations && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowHiddenConversations(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold mb-3">Conversations masquées</h3>
            <div className="custom-scrollbar max-h-64 overflow-y-auto flex flex-col gap-1">
              {hiddenUsers.length === 0 && hiddenGroups.length === 0 && (
                <p className="text-sm text-zinc-400">Aucune conversation masquée.</p>
              )}
              {hiddenGroups.map((group: Group) => (
                <div
                  key={group._id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      src={undefined}
                      fallback={group.name[0]?.toUpperCase()}
                      colorClass="bg-emerald-600"
                      size="w-9 h-9 text-sm"
                    />
                    <p className="font-medium truncate">{group.name}</p>
                  </div>
                  <button
                    onClick={() => handleUnhide(group._id)}
                    className="text-xs shrink-0 ml-2 px-3 py-1.5 rounded-full bg-accent-600 text-white"
                  >
                    Réafficher
                  </button>
                </div>
              ))}
              {hiddenUsers.map((user: User) => (
                <div
                  key={user._id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      src={user.avatar}
                      fallback={user.username[0]?.toUpperCase()}
                      colorClass="bg-accent-600"
                      size="w-9 h-9 text-sm"
                    />
                    <p className="font-medium truncate">
                      {getNickname(user._id) || user.username}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnhide(user._id)}
                    className="text-xs shrink-0 ml-2 px-3 py-1.5 rounded-full bg-accent-600 text-white"
                  >
                    Réafficher
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowHiddenConversations(false)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm mt-3"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm">
            <h3 className="font-bold mb-3">Nouveau groupe</h3>
            <input
              type="text"
              placeholder="Nom du groupe"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 mb-3 bg-transparent text-sm"
            />
            <div className="custom-scrollbar max-h-48 overflow-y-auto mb-3">
              {users.map((user: User) => (
                <label
                  key={user._id}
                  className="flex items-center gap-2 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(user._id)}
                    onChange={() => toggleMember(user._id)}
                  />
                  {user.username}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateGroup(false)}
                className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateGroup}
                className="flex-1 bg-accent-600 text-white rounded-lg py-2 text-sm font-medium"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : mon propre profil (photo en grand, nom, email) */}
      {showMyProfile && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowMyProfile(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm text-center max-h-[85vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => authUser?.avatar && setShowMyProfileZoom(true)}
              disabled={!authUser?.avatar}
              className="relative disabled:cursor-default mx-auto block w-fit"
              aria-label="Agrandir ma photo de profil"
            >
              <Avatar
                src={authUser?.avatar}
                fallback={authUser?.username?.[0]?.toUpperCase() || "?"}
                colorClass="bg-accent-600"
                size="w-24 h-24 text-3xl mx-auto"
              />
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }
                }}
                aria-label="Changer la photo"
                className="absolute bottom-0 right-0 bg-accent-600 hover:bg-accent-700 transition text-white rounded-full w-8 h-8 flex items-center justify-center border-2 border-white dark:border-zinc-900"
              >
                <Camera size={14} strokeWidth={2} />
              </span>
            </button>
            {isEditingUsername ? (
              <div className="flex items-center gap-1 justify-center mt-3">
                <input
                  autoFocus
                  value={usernameDraft}
                  onChange={(e) => setUsernameDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveUsername()}
                  className="font-bold text-xl text-center border-b border-accent-600 bg-transparent outline-none w-40"
                />
                <button
                  onClick={handleSaveUsername}
                  className="text-accent-600 hover:text-accent-700 transition"
                  aria-label="Valider le nom d'utilisateur"
                >
                  <UserCheck size={18} strokeWidth={2} />
                </button>
              </div>
            ) : (
              <h3 className="font-bold text-xl mt-3 flex items-center justify-center gap-1.5">
                {authUser?.username}
                <button
                  onClick={() => {
                    setUsernameDraft(authUser?.username || "");
                    setIsEditingUsername(true);
                    setUsernameError("");
                  }}
                  className="text-zinc-400 hover:text-accent-600 transition"
                  aria-label="Modifier le nom d'utilisateur"
                >
                  <Pencil size={14} strokeWidth={2} />
                </button>
              </h3>
            )}
            {usernameError && (
              <p className="text-xs text-red-600 mt-1">{usernameError}</p>
            )}
            {isEditingEmail ? (
              <div className="flex items-center gap-1 justify-center mt-1">
                <input
                  autoFocus
                  type="email"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveEmail()}
                  className="text-sm text-center border-b border-accent-600 bg-transparent outline-none w-48"
                />
                <button
                  onClick={handleSaveEmail}
                  className="text-accent-600 hover:text-accent-700 transition"
                  aria-label="Valider l'adresse email"
                >
                  <UserCheck size={16} strokeWidth={2} />
                </button>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 flex items-center justify-center gap-1.5">
                {authUser?.email}
                <button
                  onClick={() => {
                    setEmailDraft(authUser?.email || "");
                    setIsEditingEmail(true);
                    setEmailError("");
                  }}
                  className="text-zinc-400 hover:text-accent-600 transition"
                  aria-label="Modifier l'adresse email"
                >
                  <Pencil size={12} strokeWidth={2} />
                </button>
              </p>
            )}
            {emailError && (
              <p className="text-xs text-red-600 mt-1">{emailError}</p>
            )}
            {authUser?.createdAt && (
              <p className="text-xs text-zinc-400 mt-1">
                Membre depuis{" "}
                {new Date(authUser.createdAt).toLocaleDateString("fr-FR", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}

            <div className="mt-4 space-y-0.5">
            <button
              onClick={handleCopyShareLink}
              className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <LinkIcon size={16} strokeWidth={2} className="shrink-0" />
              {linkCopied ? "Lien copié !" : "Copier mon lien d'ajout"}
            </button>

            <button
              onClick={() => setShowQrCodeOnly(true)}
              className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <QrCode size={16} strokeWidth={2} className="shrink-0" />
              Mon QR code
            </button>

            <button
              onClick={() => {
                setShowMyProfile(false);
                setShowBlockedUsers(true);
                getBlockedUsersList();
              }}
              className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <Ban size={16} strokeWidth={2} className="shrink-0" />
              Utilisateurs bloqués
            </button>

            <button
              onClick={() => {
                setShowMyProfile(false);
                setShowHiddenConversations(true);
              }}
              className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <EyeOff size={16} strokeWidth={2} className="shrink-0" />
              Conversations masquées
              {hiddenUsers.length + hiddenGroups.length > 0 && (
                <span className="text-zinc-400">
                  ({hiddenUsers.length + hiddenGroups.length})
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setShowMyProfile(false);
                setShowMutedList(true);
              }}
              className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <BellOff size={16} strokeWidth={2} className="shrink-0" />
              Notifications coupées
              {mutedUsers.length + mutedGroups.length > 0 && (
                <span className="text-zinc-400">
                  ({mutedUsers.length + mutedGroups.length})
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setShowMyProfile(false);
                setShowSentRequests(true);
                getSentContactRequests();
              }}
              className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <UserPlus size={16} strokeWidth={2} className="shrink-0" />
              Demandes envoyées
              {sentContactRequests.length > 0 && (
                <span className="text-zinc-400">({sentContactRequests.length})</span>
              )}
            </button>
            </div>

            <div className="my-4 border-t border-zinc-200 dark:border-zinc-800" />

            <button
              onClick={() => {
                setShowMyProfile(false);
                setShowGlobalWallpaperMenu(true);
              }}
              className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <Palette size={16} strokeWidth={2} className="shrink-0" />
              Fond d&apos;écran
            </button>
            <input
              ref={globalWallpaperFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleGlobalWallpaperImageSelect}
            />

            <button
              onClick={() => {
                setShowMyProfile(false);
                setShowRingtoneMenu(true);
              }}
              className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <Music size={16} strokeWidth={2} className="shrink-0" />
              Sonnerie d&apos;appel
            </button>

            <div className="px-2 py-2">
              <p className="flex items-center gap-2 text-sm mb-2">
                <Palette size={16} strokeWidth={2} />
                Couleur d&apos;accent
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleAccentChange(c.id)}
                    aria-label={c.label}
                    title={c.label}
                    className={`w-8 h-8 rounded-full transition ${
                      selectedAccent === c.id
                        ? "ring-2 ring-offset-2 ring-zinc-400 dark:ring-offset-zinc-900"
                        : ""
                    }`}
                    style={{ backgroundColor: c.swatch }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between px-2 py-2 rounded-lg text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <span className="flex items-center gap-2">
                <Moon size={16} strokeWidth={2} />
                Mode sombre
              </span>
              <button
                type="button"
                onClick={() => setIsDarkMode(toggleTheme())}
                aria-label="Basculer le mode sombre"
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  isDarkMode ? "bg-accent-600" : "bg-zinc-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    isDarkMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between px-2 py-2 rounded-lg text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <span className="flex items-center gap-2">
                <Bell size={16} strokeWidth={2} />
                Notifications push
              </span>
              <button
                type="button"
                onClick={handleTogglePush}
                disabled={pushLoading}
                aria-label="Basculer les notifications push"
                className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${
                  pushEnabled ? "bg-accent-600" : "bg-zinc-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    pushEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <button
              onClick={() => {
                setShowChangePassword(true);
                setShowMyProfile(false);
              }}
              className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <Lock size={16} strokeWidth={2} className="shrink-0" />
              Mot de passe
            </button>

            <button
              onClick={logout}
              className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg text-sm text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
            >
              <LogOut size={16} strokeWidth={2} className="shrink-0" />
              Se déconnecter
            </button>

            <button
              onClick={() => {
                setShowMyProfile(false);
                setShowLogoutAllConfirm(true);
              }}
              className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg text-sm text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
            >
              <LogOut size={16} strokeWidth={2} className="shrink-0" />
              Se déconnecter de tous les appareils
            </button>

            <button
              onClick={() => {
                setShowDeleteAccount(true);
                setShowMyProfile(false);
              }}
              className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-lg text-sm text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
            >
              <Trash2 size={16} strokeWidth={2} className="shrink-0" />
              Supprimer mon compte
            </button>

            <button
              onClick={() => setShowMyProfile(false)}
              className="mt-4 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Modale : conversations en sourdine, pour les réactiver */}
      {showMutedList && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowMutedList(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold mb-3">Notifications coupées</h3>
            <div className="custom-scrollbar max-h-64 overflow-y-auto flex flex-col gap-1">
              {mutedUsers.length === 0 && mutedGroups.length === 0 && (
                <p className="text-sm text-zinc-400">
                  Aucune conversation en sourdine.
                </p>
              )}
              {mutedGroups.map((group: Group) => (
                <div key={group._id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      src={undefined}
                      fallback={group.name[0]?.toUpperCase()}
                      colorClass="bg-emerald-600"
                      size="w-9 h-9 text-sm"
                    />
                    <p className="font-medium truncate">{group.name}</p>
                  </div>
                  <button
                    onClick={() => handleUnmute(group._id)}
                    className="text-xs shrink-0 ml-2 px-3 py-1.5 rounded-full bg-accent-600 text-white"
                  >
                    Réactiver
                  </button>
                </div>
              ))}
              {mutedUsers.map((user: User) => (
                <div key={user._id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      src={user.avatar}
                      fallback={user.username[0]?.toUpperCase()}
                      colorClass="bg-accent-600"
                      size="w-9 h-9 text-sm"
                    />
                    <p className="font-medium truncate">
                      {getNickname(user._id) || user.username}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnmute(user._id)}
                    className="text-xs shrink-0 ml-2 px-3 py-1.5 rounded-full bg-accent-600 text-white"
                  >
                    Réactiver
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowMutedList(false)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm mt-3"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Modale : demandes de contact envoyées, en attente d'une réponse,
          avec la possibilité de les annuler */}
      {showSentRequests && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSentRequests(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold mb-3">Demandes envoyées</h3>
            <div className="custom-scrollbar max-h-64 overflow-y-auto flex flex-col gap-1">
              {sentContactRequests.length === 0 && (
                <p className="text-sm text-zinc-400">
                  Aucune demande en attente.
                </p>
              )}
              {sentContactRequests.map((user: User) => (
                <div key={user._id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      src={user.avatar}
                      fallback={user.username[0]?.toUpperCase()}
                      colorClass="bg-accent-600"
                      size="w-9 h-9 text-sm"
                    />
                    <p className="font-medium truncate">{user.username}</p>
                  </div>
                  <button
                    onClick={() => cancelContactRequest(user._id)}
                    className="text-xs shrink-0 ml-2 px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-700"
                  >
                    Annuler
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowSentRequests(false)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm mt-3"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Modale : liste des utilisateurs bloqués, pour pouvoir les
          débloquer sans devoir rouvrir une conversation avec chacun */}
      {showBlockedUsers && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowBlockedUsers(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold mb-3">Utilisateurs bloqués</h3>
            <div className="custom-scrollbar max-h-64 overflow-y-auto flex flex-col gap-1">
              {blockedUsersList.length === 0 && (
                <p className="text-sm text-zinc-400">
                  Tu n&apos;as bloqué personne.
                </p>
              )}
              {blockedUsersList.map((user: User) => (
                <div
                  key={user._id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      src={user.avatar}
                      fallback={user.username[0]?.toUpperCase()}
                      colorClass="bg-accent-600"
                      size="w-9 h-9 text-sm"
                    />
                    <p className="font-medium truncate">{user.username}</p>
                  </div>
                  <button
                    onClick={() => toggleBlockUser(user._id)}
                    className="text-xs shrink-0 ml-2 px-3 py-1.5 rounded-full bg-accent-600 text-white"
                  >
                    Débloquer
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowBlockedUsers(false)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm mt-3"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Aperçu plein écran de ma propre photo de profil */}
      {showMyProfileZoom && authUser?.avatar && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4"
          onClick={() => setShowMyProfileZoom(false)}
        >
          <button
            onClick={() => setShowMyProfileZoom(false)}
            className="absolute top-4 right-4 text-white"
            aria-label="Fermer l'aperçu"
          >
            <X size={32} strokeWidth={2} />
          </button>
          <Image
            src={authUser.avatar}
            alt="Ma photo de profil en plein écran"
            width={1200}
            height={1200}
            unoptimized
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}

      {/* Modale : mon QR code seul, pour le montrer/scanner facilement */}
      {showQrCodeOnly && shareLink && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={() => setShowQrCodeOnly(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl p-6 flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareLink)}`}
              alt="Mon QR code d'ajout"
              width={220}
              height={220}
              className="rounded-lg"
            />
            <p className="text-sm text-zinc-500">{authUser?.username}</p>
            <button
              onClick={() => setShowQrCodeOnly(false)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Modale : rechercher un utilisateur dans l'annuaire complet et
          l'ajouter à ses contacts (seule façon de trouver de nouvelles
          personnes ; la liste principale ne montre que ses contacts déjà
          ajoutés) */}
      {showAddContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm">
            <h3 className="font-bold mb-3">Ajouter un contact</h3>

            {/* Demandes reçues, en attente d'une réponse */}
            {contactRequests.length > 0 && (
              <div className="mb-3 pb-3 border-b border-zinc-200 dark:border-zinc-700">
                <p className="text-xs text-zinc-400 uppercase mb-1">
                  Demandes reçues ({contactRequests.length})
                </p>
                <div className="flex flex-col gap-1">
                  {contactRequests.map((user: User) => (
                    <div
                      key={user._id}
                      className="py-2 text-sm border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar
                          src={user.avatar}
                          fallback={user.username[0]?.toUpperCase()}
                          colorClass="bg-accent-600"
                          size="w-9 h-9 text-sm"
                        />
                        <p className="font-medium truncate">{user.username}</p>
                      </div>
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => acceptContactRequest(user._id)}
                          className="text-xs px-3 py-1.5 rounded-full bg-accent-600 text-white"
                        >
                          Accepter
                        </button>
                        <button
                          onClick={() => declineContactRequest(user._id)}
                          className="text-xs px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-700"
                        >
                          Refuser
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <input
              type="text"
              autoFocus
              placeholder="Rechercher par nom ou email..."
              value={addContactSearch}
              onChange={(e) => handleAddContactSearchChange(e.target.value)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-full px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-sm mb-3"
            />
            <div className="custom-scrollbar max-h-64 overflow-y-auto mb-3 flex flex-col gap-1">
              {isDiscovering && (
                <p className="text-sm text-zinc-400">Recherche...</p>
              )}
              {!isDiscovering && addContactSearch.trim() && discoverResults.length === 0 && (
                <p className="text-sm text-zinc-400">Aucun résultat.</p>
              )}
              {!isDiscovering && !addContactSearch.trim() && (
                <p className="text-sm text-zinc-400">
                  Tape un nom d&apos;utilisateur ou un email pour chercher.
                </p>
              )}
              {discoverResults.map((user: User) => (
                <div
                  key={user._id}
                  className="flex items-center justify-between py-2 text-sm border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      src={user.avatar}
                      fallback={user.username[0]?.toUpperCase()}
                      colorClass="bg-accent-600"
                      size="w-9 h-9 text-sm"
                    />
                    <p className="font-medium truncate">{user.username}</p>
                  </div>
                  <button
                    onClick={() => handleAddContact(user._id)}
                    className="text-xs shrink-0 ml-2 px-3 py-1.5 rounded-full bg-accent-600 text-white"
                  >
                    Ajouter
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setShowAddContact(false);
                setAddContactSearch("");
              }}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Modale : recherche dans TOUTES les conversations à la fois */}
      {showGlobalSearch && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowGlobalSearch(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold mb-3">Rechercher dans mes messages</h3>
            <input
              type="text"
              autoFocus
              placeholder="Rechercher un mot..."
              value={globalSearchQuery}
              onChange={(e) => handleGlobalSearchChange(e.target.value)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-full px-4 py-2 bg-transparent text-sm mb-3"
            />
            <div className="custom-scrollbar max-h-96 overflow-y-auto flex flex-col gap-1">
              {isGlobalSearching && (
                <p className="text-sm text-zinc-400 text-center py-4">Recherche...</p>
              )}
              {!isGlobalSearching && globalSearchQuery.trim() && globalSearchResults.length === 0 && (
                <p className="text-sm text-zinc-400 text-center py-4">Aucun résultat.</p>
              )}
              {!isGlobalSearching && !globalSearchQuery.trim() && (
                <p className="text-sm text-zinc-400 text-center py-4">
                  Tape un mot pour chercher dans toutes tes conversations.
                </p>
              )}
              {globalSearchResults.map((result: {
                _id: string;
                text: string;
                createdAt: string;
                sender: { _id: string; username: string; avatar?: string };
                receiver?: { _id: string; username: string; avatar?: string };
                group?: { _id: string; name: string };
              }) => {
                const conversationLabel = result.group
                  ? result.group.name
                  : result.sender._id === authUser?._id
                    ? result.receiver?.username
                    : result.sender.username;
                return (
                  <button
                    key={result._id}
                    onClick={() => handleGlobalSearchResultClick(result)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">
                        {conversationLabel}
                      </span>
                      <span className="text-xs text-zinc-400 shrink-0">
                        {formatTime(result.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                      {result.sender._id === authUser?._id ? "Toi : " : ""}
                      {result.text}
                    </p>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => {
                setShowGlobalSearch(false);
                setGlobalSearchQuery("");
                clearGlobalSearchResults();
              }}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm mt-3"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Modale : découvrir des groupes publics et demander à les rejoindre */}
      {showDiscoverGroups && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm">
            <h3 className="font-bold mb-3">Découvrir des groupes</h3>
            <div className="custom-scrollbar max-h-64 overflow-y-auto mb-3 flex flex-col gap-1">
              {isLoadingDiscoverableGroups && (
                <p className="text-sm text-zinc-400">Chargement...</p>
              )}
              {!isLoadingDiscoverableGroups && discoverableGroups.length === 0 && (
                <p className="text-sm text-zinc-400">
                  Aucun groupe découvrable pour le moment.
                </p>
              )}
              {discoverableGroups.map((group: DiscoverableGroup) => (
                <div
                  key={group._id}
                  className="flex items-center justify-between py-2 text-sm border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                >
                  <button
                    onClick={() => handlePreviewGroup(group)}
                    className="min-w-0 text-left hover:opacity-70 transition"
                  >
                    <p className="font-medium truncate">{group.name}</p>
                    <p className="text-xs text-zinc-400">
                      {group.memberCount} membre{group.memberCount > 1 ? "s" : ""}
                      {" · "}Voir la discussion
                    </p>
                  </button>
                  <button
                    onClick={() => handleRequestToJoin(group._id)}
                    disabled={group.requestPending}
                    className="text-xs shrink-0 ml-2 px-3 py-1.5 rounded-full bg-accent-600 text-white disabled:opacity-50 disabled:bg-zinc-400"
                  >
                    {group.requestPending ? "Demande envoyée" : "Rejoindre"}
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowDiscoverGroups(false)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Barre de profil en bas, style WhatsApp : avatar + nom + menu vers le haut */}
      <div className="relative border-t border-zinc-200 dark:border-zinc-800 p-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMyProfile(true)}
            disabled={uploading}
            className="shrink-0"
            aria-label="Voir mon profil"
          >
            <Avatar
              src={authUser?.avatar}
              fallback={authUser?.username?.[0]?.toUpperCase() || "?"}
              colorClass="bg-accent-600"
              size="w-9 h-9"
            />
          </button>
          <button
            onClick={() => setShowMyProfile(true)}
            disabled={uploading}
            className="flex-1 min-w-0 flex items-center rounded-lg p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-left"
          >
            <span className="font-medium text-sm truncate">
              {authUser?.username}
            </span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      {/* Modale : fond d'écran par défaut de l'application, centrée à l'écran */}
      {showGlobalWallpaperMenu && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm">
            <h3 className="font-bold mb-3">Fond d&apos;écran</h3>
            <div className="custom-scrollbar max-h-64 overflow-y-auto flex flex-col gap-1">
              {WALLPAPERS.map((w) => (
                <button
                  key={w.id}
                  onClick={() =>
                    w.id === "custom"
                      ? globalWallpaperFileInputRef.current?.click()
                      : handleGlobalWallpaperChange(w.id)
                  }
                  className={`block w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition ${
                    globalWallpaper === w.id ? "font-semibold" : ""
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowGlobalWallpaperMenu(false)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm mt-3"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {showRingtoneMenu && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm">
            <h3 className="font-bold mb-3">Sonnerie d&apos;appel</h3>
            <div className="custom-scrollbar max-h-64 overflow-y-auto flex flex-col gap-1">
              {RINGTONES.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between rounded-lg border transition ${
                    selectedRingtone === r.id
                      ? "border-accent-600 bg-accent-50 dark:bg-accent-950"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-accent-600"
                  }`}
                >
                  <button
                    onClick={() => handleRingtoneChange(r.id)}
                    className="flex-1 flex items-center gap-2 text-left px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-200"
                  >
                    {selectedRingtone === r.id ? (
                      <UserCheck size={16} strokeWidth={2} className="text-accent-600 shrink-0" />
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <span className={selectedRingtone === r.id ? "font-semibold" : ""}>
                      {r.label}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      const audio = new Audio(r.file);
                      audio.play().catch(() => {});
                    }}
                    className="px-3 py-2 text-zinc-400 hover:text-accent-600 transition border-l border-zinc-200 dark:border-zinc-700"
                    aria-label={`Écouter ${r.label}`}
                  >
                    <Volume2 size={16} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowRingtoneMenu(false)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm mt-3"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm">
            <h3 className="font-bold mb-3">Modifier le mot de passe</h3>
            <input
              type="password"
              placeholder="Mot de passe actuel"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 mb-3 bg-transparent text-sm"
            />
            <input
              type="password"
              placeholder="Nouveau mot de passe"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 mb-3 bg-transparent text-sm"
            />
            {passwordError && (
              <p className="text-red-600 text-sm mb-3">{passwordError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowChangePassword(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setPasswordError("");
                }}
                className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleChangePassword}
                className="flex-1 bg-accent-600 text-white rounded-lg py-2 text-sm font-medium"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : confirmation avant de déconnecter tous les appareils
          connectés à ce compte (y compris celui-ci) */}
      {showLogoutAllConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm">
            <h3 className="font-bold mb-2">Se déconnecter de tous les appareils ?</h3>
            <p className="text-sm text-zinc-500 mb-4">
              Toutes les sessions actives (téléphone, ordinateur, autres
              navigateurs) seront fermées, y compris celle-ci. Tu devras te
              reconnecter partout.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutAllConfirm(false)}
                disabled={isLoggingOutAll}
                className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleLogoutAllDevices}
                disabled={isLoggingOutAll}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
              >
                {isLoggingOutAll ? "Déconnexion..." : "Déconnecter tout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm">
            <h3 className="font-bold mb-2 text-red-600">Supprimer mon compte</h3>
            <p className="text-sm text-zinc-500 mb-3">
              Cette action est définitive et irréversible. Entre ton mot de passe pour confirmer.
            </p>
            <input
              type="password"
              placeholder="Mot de passe"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 mb-3 bg-transparent text-sm"
            />
            {deleteError && (
              <p className="text-red-600 text-sm mb-3">{deleteError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteAccount(false);
                  setDeletePassword("");
                  setDeleteError("");
                }}
                className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteAccount}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
