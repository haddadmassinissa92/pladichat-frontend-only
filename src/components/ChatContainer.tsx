"use client";

// Définit la structure du message dans l'application de messagerie
type Message = {
  _id: string; // Identifiant unique du message
  sender: string; // Identifiant ou nom de l'expéditeur du message
  receiver: string; // Identifiant ou nom du destinataire (utilisateur ou groupe)
  text: string; // Contenu textuel du message
  image: string; // URL ou chemin vers une image jointe
  audio: string; // URL ou chemin vers un message vocal ou fichier audio joint
  linkPreview?: {
    url: string;
    title?: string;
  }; // Aperçu du lien partagé
  status: string; // État du message (ex: 'sent', 'delivered', 'read')
  createdAt: string; // Date de création du message au format ISO (chaîne de caractères)
};

// Définit un type d'objet personnalisé représentant un membre d'un groupe
type GroupMember = {
  _id: string; // Identifiant unique du membre.
  username: string; // Nom d'utilisateur unique du membre
};

// Hooks fondamentaux de React pour la gestion du cycle de vie et des états
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Avatar from "./Avatar";

// Icône propre et cohérente avec le reste de l'application
import { Palette, ArrowLeft, ArrowDown, MoreVertical, Search, ChevronUp, ChevronDown, X, Ban, Pencil, UserPlus, Users, Eye, EyeOff, UserCheck, Trash2, Phone, Video, Bell, BellOff, Pin, Download, Link2 } from "lucide-react";
import { useCallStore } from "@/store/useCallStore";

// Gestionnaires d'états globaux (Zustand) pour le chat et l'authentification
import { useChatStore } from "@/store/useChatStore";
import { useAuthStore } from "@/store/useAuthStore";

// Composant d'interface pour la saisie et l'envoi de nouveaux messages
import MessageInput from "@/components/MessageInput";

// Composant d'interface pour l'affichage visuel d'un message individuel
// (ex: Aujourd'huit, Hier, V nouveau message)
import MessageBubble from "./MessageBubble";

// Bibliothèque tierce pour réduire la taille des images avant l'envoi
import imageCompression from "browser-image-compression";

// Constantes et fonctions utilitaires pour la gestion des arrière-plans de discussion
import {
  WALLPAPERS, // Liste ou objet contenant les fonds d'écran disponibles
  resolveWallpaper, // Fonction pour identifier ou formater un fond d'écran
  setConversationWallpaper, // Fonction pour appliquer un fond d'écran prédéfini à une discussion
  setConversationWallpaperImage, // Fonction pour appliquer une image personnalisée en fond d'écran
  clearConversationWallpaper, // Fonction pour supprimer le fond d'écran actuel
} from "@/lib/wallpaper";

// Préférences par conversation (notifications coupées, épinglage, masquage)
import {
  isConversationMuted,
  toggleConversationMuted,
  isConversationPinned,
  toggleConversationPinned,
  hideConversation,
} from "@/lib/conversationSettings";

// Transforme une date en texte lisible pour le séparateur entre deux jours
// ("Aujourd'hui", "Hier", ou une date complète)
function formatDateSeparator(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yesterday.toDateString()) return "Hier";

  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

// Composant principal : affiche la conversation active (en-tête, messages, saisie)
export default function ChatContainer() {
  // Données et actions liées à la conversation, fournies par le store de chat
  const {
    users,
    selectedUser,
    selectedGroup,
    messages,
    getMessages,
    loadMoreMessages,
    hasMoreMessages,
    isLoadingMoreMessages,
    markAsRead,
    isMessagesLoading,
    subscribeToMessages,
    unsubscribeFromMessages,
    subscribeToTyping,
    unsubscribeFromTyping,
    isTyping,
    setSelectedUser,
    setSelectedGroup,
    deleteGroup,
    renameGroup,
    addMembersToGroup,
    removeMember,
    toggleBlockMember,
    toggleDiscoverable,
    approveJoinRequest,
    rejectJoinRequest,
    searchMessages,
    clearSearchResults,
    searchResults,
    deleteConversation,
  } = useChatStore();

  // État du menu "gérer le groupe", utilisateur connecté, socket temps réel,
  // et références DOM utilisées pour le défilement et les gestes tactiles
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const { authUser, socket, toggleBlockUser, onlineUsers } = useAuthStore();
  const { startCall, callStatus } = useCallStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Gestion du menu et du statut de blocage pour une conversation privée
  const [showUserMenu, setShowUserMenu] = useState(false);
  const isBlockedByMe = !!(
    selectedUser && authUser?.blockedUsers?.includes(selectedUser._id)
  );
  const isBlockedMe = !!(
    selectedUser && selectedUser.blockedUsers?.includes(authUser?._id)
  );
  // Aucun message ne peut être envoyé si l'un des deux a bloqué l'autre
  const isBlockedRelationship = isBlockedByMe || isBlockedMe;

  const handleToggleBlock = async () => {
    if (!selectedUser) return;
    await toggleBlockUser(selectedUser._id);
    setShowUserMenu(false);
  };

  // --- Gestion du groupe : renommer, ajouter des membres, gérer les membres ---
  const [showRenameGroup, setShowRenameGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [membersToAdd, setMembersToAdd] = useState<string[]>([]);
  const [showManageMembers, setShowManageMembers] = useState(false);

  // --- Gestion des groupes découvrables et des demandes d'adhésion ---
  const [showJoinRequests, setShowJoinRequests] = useState(false);

  // Confirmation avant suppression définitive d'un groupe
  const [showDeleteGroupConfirm, setShowDeleteGroupConfirm] = useState(false);

  // Modale d'informations sur le contact ou le groupe, ouverte en cliquant
  // sur l'avatar dans l'en-tête (comme sur WhatsApp)
  const [showContactInfo, setShowContactInfo] = useState(false);
  // Image affichée en plein écran depuis la galerie de médias de la fiche contact
  const [fullscreenMediaUrl, setFullscreenMediaUrl] = useState<string | null>(null);

  // --- Recherche dans l'historique de la conversation ---
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Le message qu'on essaie d'atteindre suite à une navigation dans les résultats ;
  // s'il n'est pas encore chargé, on continue à charger des messages plus anciens
  // jusqu'à le trouver (ou jusqu'à ce qu'il n'y en ait plus)
  const pendingScrollTargetRef = useRef<string | null>(null);
  const conversationId = selectedGroup?._id || selectedUser?._id || null;
  const isGroupConversation = !!selectedGroup;

  // Notifications coupées / conversation épinglée : préférences locales
  // (voir lib/conversationSettings), synchronisées à chaque changement de
  // conversation puisque ce ne sont pas des valeurs React réactives par nature
  const [, setConversationSettingsVersion] = useState(0);
  const isMuted = isConversationMuted(conversationId);
  const isPinned = isConversationPinned(conversationId);
  useEffect(() => {
    const handleSettingsChanged = () => {
      setConversationSettingsVersion((version) => version + 1);
    };
    window.addEventListener("chatSettingsChanged", handleSettingsChanged);
    return () => window.removeEventListener("chatSettingsChanged", handleSettingsChanged);
  }, []);

  const handleToggleMute = () => {
    if (!conversationId) return;
    toggleConversationMuted(conversationId);
    window.dispatchEvent(new Event("chatSettingsChanged"));
  };

  const handleTogglePin = () => {
    if (!conversationId) return;
    toggleConversationPinned(conversationId);
    window.dispatchEvent(new Event("chatSettingsChanged"));
  };

  // Retire la conversation de sa propre liste seulement (les messages
  // restent intacts pour l'autre côté) ; elle réapparaît automatiquement si
  // un nouveau message arrive, comme sur WhatsApp
  const handleHideConversation = () => {
    if (!conversationId) return;
    hideConversation(conversationId);
    window.dispatchEvent(new Event("chatSettingsChanged"));
    setShowContactInfo(false);
    setSelectedUser(null);
    setSelectedGroup(null);
  };

  // Supprime définitivement TOUS les messages de cette conversation, pour
  // tout le monde (pas seulement les siens) ; le contact/groupe reste
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const handleClearMessages = async () => {
    setIsClearing(true);
    await deleteConversation();
    setIsClearing(false);
    setShowClearConfirm(false);
  };

  // Télécharge un export texte de la conversation actuelle
  const handleExportConversation = () => {
    const title = selectedGroup ? selectedGroup.name : selectedUser?.username;
    const lines = messages.map((m: Message) => {
      const senderName = selectedGroup
        ? selectedGroup.members.find((mem: GroupMember) => mem._id === m.sender)?.username || m.sender
        : m.sender === authUser?._id
          ? "Moi"
          : selectedUser?.username;
      const date = new Date(m.createdAt).toLocaleString("fr-FR");
      const content = m.text || (m.image ? "[Image]" : m.audio ? "[Audio]" : "");
      return `[${date}] ${senderName}: ${content}`;
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "conversation"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenSearch = () => {
    setShowSearch(true);
  };

  const handleCloseSearch = () => {
    setShowSearch(false);
    setSearchQuery("");
    setCurrentResultIndex(0);
    setHighlightedMessageId(null);
    pendingScrollTargetRef.current = null;
    clearSearchResults();
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentResultIndex(0);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!conversationId) return;

    searchDebounceRef.current = setTimeout(() => {
      searchMessages(conversationId, isGroupConversation, value);
    }, 300);
  };

  // Tente de faire défiler jusqu'au message ciblé s'il est déjà chargé ; sinon,
  // déclenche le chargement de messages plus anciens et réessaie automatiquement
  // (via l'effet ci-dessous, qui se redéclenche quand "messages" change)
  const scrollToMessageId = (messageId: string) => {
    const el = document.getElementById(messageId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(messageId);
      pendingScrollTargetRef.current = null;
      setTimeout(() => setHighlightedMessageId(null), 2000);
    } else {
      pendingScrollTargetRef.current = messageId;
      if (hasMoreMessages && conversationId) {
        loadMoreMessages(conversationId, isGroupConversation);
      }
    }
  };

  // Une fois que de nouveaux (anciens) messages ont été chargés, on retente
  // d'atteindre le message ciblé par la recherche s'il y en avait un en attente

  useEffect(() => {
    if (pendingScrollTargetRef.current) {
      scrollToMessageId(pendingScrollTargetRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);


  const goToResult = (index: number) => {
    if (index < 0 || index >= searchResults.length) return;
    setCurrentResultIndex(index);
    scrollToMessageId(searchResults[index]._id);
  };

  const handleNextResult = () => goToResult(currentResultIndex + 1);
  const handlePreviousResult = () => goToResult(currentResultIndex - 1);

  // Dès que de nouveaux résultats de recherche arrivent, on saute automatiquement
  // au premier (comportement classique d'un "Ctrl+F")
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (searchResults.length > 0) {
      setCurrentResultIndex(0);
      scrollToMessageId(searchResults[0]._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchResults]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Un membre est bloqué dans le groupe s'il figure dans blockedMembers
  const isMemberBlockedInGroup = (memberId: string) =>
    !!selectedGroup?.blockedMembers?.some(
      (id: string) => id.toString() === memberId,
    );

  const handleOpenRenameGroup = () => {
    if (!selectedGroup) return;
    setNewGroupName(selectedGroup.name);
    setShowRenameGroup(true);
    setShowGroupMenu(false);
  };

  const handleRenameGroup = async () => {
    if (!selectedGroup || !newGroupName.trim()) return;
    const result = await renameGroup(selectedGroup._id, newGroupName.trim());
    if (result.success) setShowRenameGroup(false);
  };

  const handleOpenAddMembers = () => {
    setMembersToAdd([]);
    setShowAddMembers(true);
    setShowGroupMenu(false);
  };

  const toggleMemberToAdd = (userId: string) => {
    setMembersToAdd((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleAddMembers = async () => {
    if (!selectedGroup || membersToAdd.length === 0) return;
    const result = await addMembersToGroup(selectedGroup._id, membersToAdd);
    if (result.success) {
      setMembersToAdd([]);
      setShowAddMembers(false);
    }
  };

  const handleOpenManageMembers = () => {
    setShowManageMembers(true);
    setShowGroupMenu(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedGroup) return;
    await removeMember(selectedGroup._id, memberId);
  };

  const handleToggleBlockMember = async (memberId: string) => {
    if (!selectedGroup) return;
    await toggleBlockMember(selectedGroup._id, memberId);
  };

  // Rend le groupe découvrable ou privé (bascule automatique)
  const handleToggleDiscoverable = async () => {
    if (!selectedGroup) return;
    await toggleDiscoverable(selectedGroup._id);
    setShowGroupMenu(false);
  };

  const handleOpenJoinRequests = () => {
    setShowJoinRequests(true);
    setShowGroupMenu(false);
  };

  const handleApproveRequest = async (userId: string) => {
    if (!selectedGroup) return;
    await approveJoinRequest(selectedGroup._id, userId);
  };

  const handleRejectRequest = async (userId: string) => {
    if (!selectedGroup) return;
    await rejectJoinRequest(selectedGroup._id, userId);
  };

  const handleOpenDeleteGroupConfirm = () => {
    setShowDeleteGroupConfirm(true);
    setShowGroupMenu(false);
  };

  // Démarre un appel privé (audio ou vidéo) avec le contact de cette
  // conversation. Les appels de groupe se font désormais uniquement via le
  // bouton "Nouvel appel" de la sidebar, indépendant des groupes créés.
  const handleStartCall = (type: "audio" | "video") => {
    if (callStatus !== "idle" || !selectedUser) return;
    startCall(selectedUser, type);
  };

  const handleConfirmDeleteGroup = () => {
    if (!selectedGroup) return;
    deleteGroup(selectedGroup._id);
    setShowDeleteGroupConfirm(false);
  };

  // Liste des contacts qui ne sont pas déjà membres du groupe, pour la modale d'ajout
  const usersNotInGroup = selectedGroup
    ? users.filter(
        (u: GroupMember) =>
          !selectedGroup.members.some((m: GroupMember) => m._id === u._id),
      )
    : [];

  // Gestion de l'indicateur "nouveaux messages" : sait si on regarde le bas de la
  // conversation, combien de nouveaux messages sont arrivés pendant qu'on a remonté,
  // et mémorise le nombre de messages au tour précédent pour détecter les arrivées
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const previousMessagesLength = useRef(0);

  // Gestion du scroll infini vers le haut : mémorise la hauteur du contenu juste
  // avant de charger des messages plus anciens, pour pouvoir replacer le scroll
  // exactement au même endroit visuellement une fois les nouveaux messages insérés
  const scrollHeightBeforeLoadRef = useRef(0);
  const wasLoadingMoreRef = useRef(false);

  // Gestion du fond d'écran spécifique à la conversation actuelle : fond choisi,
  // image personnalisée éventuelle, état du menu de sélection, et input de fichier caché
  const [wallpaper, setWallpaper] = useState("default");
  const [customWallpaper, setCustomWallpaper] = useState<string | null>(null);
  const [showWallpaperMenu, setShowWallpaperMenu] = useState(false);
  const wallpaperFileInputRef = useRef<HTMLInputElement>(null);

  // Résout le fond réellement affiché : celui propre à cette conversation s'il existe,
  // sinon le fond par défaut global choisi dans le profil
  const resolvedConversationWallpaper = conversationId
    ? resolveWallpaper(conversationId)
    : { id: wallpaper, image: customWallpaper };
  const activeWallpaper = resolvedConversationWallpaper.id;
  const activeCustomWallpaper = resolvedConversationWallpaper.image;

  // Change le fond d'écran de la conversation actuelle et l'enregistre localement
  const handleWallpaperChange = (id: string) => {
    if (!conversationId) return;
    setWallpaper(id);
    setConversationWallpaper(conversationId, id);
    setShowWallpaperMenu(false);
  };

  // Gère le choix d'une image personnalisée comme fond : compression, conversion
  // en base64, puis sauvegarde comme fond de cette conversation
  const handleWallpaperImageSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      });
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setCustomWallpaper(dataUrl);
        setConversationWallpaperImage(conversationId, dataUrl);
        handleWallpaperChange("custom");
      };
      reader.readAsDataURL(compressed);
    } catch (error) {
      console.error("Erreur de compression du fond:", error);
    }
  };

  // Retire le fond spécifique à cette conversation pour revenir au fond par défaut
  const handleResetWallpaper = () => {
    if (!conversationId) return;
    clearConversationWallpaper(conversationId);
    const resolved = resolveWallpaper(conversationId);
    setWallpaper(resolved.id);
    setCustomWallpaper(resolved.image);
    setShowWallpaperMenu(false);
  };

  // Au changement de conversation : charge la première page de messages
  // (les plus récents) et les marque comme lus
  useEffect(() => {
    if (selectedUser) {
      getMessages(selectedUser._id, false);
      markAsRead(selectedUser._id, false);
    } else if (selectedGroup) {
      getMessages(selectedGroup._id, true);
      markAsRead(selectedGroup._id, true);
    }
  }, [selectedUser, selectedGroup, getMessages, markAsRead]);

  // Au changement de conversation : réinitialise l'indicateur de nouveaux messages
  // et repart du principe qu'on est en bas de la conversation. On dépend des
  // identifiants plutôt que des objets entiers pour éviter un déclenchement inutile.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setNewMessagesCount(0);
    setIsNearBottom(true);
    previousMessagesLength.current = 0;
    setShowSearch(false);
    setSearchQuery("");
    setCurrentResultIndex(0);
    setHighlightedMessageId(null);
    clearSearchResults();
  }, [selectedUser?._id, selectedGroup?._id, clearSearchResults]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // S'abonne aux événements socket liés aux messages (nouveau, lu, supprimé, modifié)
  // et se désabonne proprement quand ce n'est plus nécessaire
  useEffect(() => {
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [
    selectedUser,
    selectedGroup,
    socket,
    subscribeToMessages,
    unsubscribeFromMessages,
  ]);

  // Calcule si l'utilisateur regarde le bas de la conversation ou a remonté dans
  // l'historique ; efface le compteur de nouveaux messages si on revient en bas ;
  // et déclenche le chargement de messages plus anciens si on approche du tout haut
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 100;
    setIsNearBottom(nearBottom);
    if (nearBottom) setNewMessagesCount(0);

    // Scroll infini : si on est proche du haut et qu'il reste des messages plus
    // anciens à charger, on lance le chargement (le store empêche les doublons
    // d'appel grâce à isLoadingMoreMessages)
    if (
      el.scrollTop < 50 &&
      hasMoreMessages &&
      !isLoadingMoreMessages &&
      conversationId
    ) {
      scrollHeightBeforeLoadRef.current = el.scrollHeight;
      loadMoreMessages(conversationId, isGroupConversation);
    }
  };

  // Une fois que les messages plus anciens ont fini de charger, on ajuste la
  // position du scroll pour que le contenu déjà visible ne bouge pas à l'écran
  // (sans ça, l'insertion de messages en haut ferait "sauter" la vue)
  useEffect(() => {
    if (wasLoadingMoreRef.current && !isLoadingMoreMessages) {
      const el = scrollContainerRef.current;
      if (el) {
        const newScrollHeight = el.scrollHeight;
        el.scrollTop = newScrollHeight - scrollHeightBeforeLoadRef.current;
      }
    }
    wasLoadingMoreRef.current = isLoadingMoreMessages;
  }, [isLoadingMoreMessages, messages]);

  // Fait défiler jusqu'en bas de la conversation (appelé au clic sur l'indicateur)
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setNewMessagesCount(0);
  };

  // À chaque changement de la liste des messages : si on est déjà en bas, on fait
  // défiler automatiquement ; sinon, on incrémente le compteur de nouveaux messages,
  // seulement si le dernier message ne vient pas de nous-même
  useEffect(() => {
    const newMessagesArrived = messages.length > previousMessagesLength.current;

    if (newMessagesArrived) {
      if (isNearBottom) {
        const timeout = setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
        previousMessagesLength.current = messages.length;
        return () => clearTimeout(timeout);
      } else {
        const lastMessage = messages[messages.length - 1];
        const isMine = lastMessage?.sender === authUser?._id;
        if (!isMine) {
          // On fige l'incrément dans une variable avant l'appel, car la référence
          // previousMessagesLength.current sera mise à jour juste après par le
          // code suivant, avant que React n'exécute la fonction de mise à jour.
          const increment = messages.length - previousMessagesLength.current;
          setNewMessagesCount((count) => count + increment);
        }
      }
    }
    previousMessagesLength.current = messages.length;
  }, [messages, authUser, isNearBottom]);

  // Fait défiler vers le bas quand l'indicateur "en train d'écrire" apparaît,
  // uniquement si l'utilisateur regardait déjà le bas de la conversation
  useEffect(() => {
    if (isNearBottom) {
      const timeout = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isTyping, isNearBottom]);

  // S'abonne/désabonne aux événements socket "en train d'écrire" pour la
  // conversation privée actuellement sélectionnée
  useEffect(() => {
    subscribeToTyping();
    return () => unsubscribeFromTyping();
  }, [selectedUser, socket, subscribeToTyping, unsubscribeFromTyping]);

  // Gestion du geste de glissement tactile (swipe) pour revenir à la liste
  // des conversations sur mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const distance = touchEndX.current - touchStartX.current;

    if (distance > 100) {
      setSelectedUser(null);
      setSelectedGroup(null);
    }
  };

  // Si aucune conversation n'est sélectionnée, on affiche un simple message d'invite
  if (!selectedUser && !selectedGroup) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-400">
        Sélectionne une conversation pour commencer
      </div>
    );
  }

  // Vérifie si l'utilisateur connecté est bloqué dans le groupe actuellement sélectionné
  const amIBlockedInThisGroup =
    !!selectedGroup && isMemberBlockedInGroup(authUser?._id || "");

  // Nombre de demandes d'adhésion en attente pour ce groupe (visible pour son créateur)
  const pendingJoinRequestsCount = selectedGroup?.joinRequests?.length || 0;

  // Est-on déjà membre du groupe sélectionné ? (false si on ne fait que
  // prévisualiser un groupe découvrable avant d'y être accepté : dans ce cas,
  // selectedGroup.members est vide côté frontend puisqu'on ne les connaît pas encore)
  const isMemberOfSelectedGroup =
    !!selectedGroup &&
    selectedGroup.members.some((m: GroupMember) => m._id === authUser?._id);

  return (
    <div
      className="h-full flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* En-tête : bouton retour (mobile), nom de la conversation,
          menu de fond d'écran, menu bloquer/débloquer, et menu de gestion du groupe */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
        <button
          onClick={() => {
            setSelectedUser(null);
            setSelectedGroup(null);
          }}
          className="sm:hidden p-1 -ml-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          aria-label="Retour"
        >
          <ArrowLeft size={22} strokeWidth={2} />
        </button>

        {/* Avatar de la conversation : photo de profil pour un contact,
            rond avec initiale pour un groupe (composant partagé avec la sidebar).
            Cliquable pour ouvrir les infos, comme sur WhatsApp. */}
        <button
          onClick={() => setShowContactInfo(true)}
          aria-label="Voir les informations"
          className="shrink-0"
        >
          <Avatar
            src={selectedGroup ? undefined : selectedUser?.avatar}
            fallback={
              selectedGroup
                ? selectedGroup.name[0]?.toUpperCase()
                : selectedUser?.username[0]?.toUpperCase() || "?"
            }
            colorClass={selectedGroup ? "bg-emerald-600" : "bg-indigo-600"}
            size="w-9 h-9"
          />
        </button>

        <h2
          onClick={() => setShowContactInfo(true)}
          className="font-bold flex-1 min-w-0 truncate cursor-pointer"
        >
          {selectedGroup ? selectedGroup.name : selectedUser?.username}
        </h2>

        {/* Boutons pour démarrer un appel audio/vidéo : uniquement en
            conversation privée (pas pour les groupes créés), masqués si un
            blocage empêche déjà l'envoi de messages ou si un appel est en cours */}
        {selectedUser && !isBlockedRelationship && callStatus === "idle" && (
          <>
            <button
              onClick={() => handleStartCall("audio")}
              className="shrink-0 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 transition"
              aria-label="Appel audio"
            >
              <Phone size={22} strokeWidth={2} />
            </button>
            <button
              onClick={() => handleStartCall("video")}
              className="shrink-0 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 transition"
              aria-label="Appel vidéo"
            >
              <Video size={24} fill="currentColor" stroke="none" />
            </button>
          </>
        )}

        {/* Menu "⋮" pour bloquer/débloquer, changer le thème et la recherche,
            visible uniquement en conversation privée */}
        {selectedUser && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 transition"
              aria-label="Options"
            >
              <MoreVertical size={20} strokeWidth={2} />
            </button>
            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 z-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 text-sm w-48">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      handleOpenSearch();
                    }}
                    className="w-full flex items-center gap-2 text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    <Search size={16} strokeWidth={2} className="shrink-0" />
                    Recherche
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowWallpaperMenu(true);
                    }}
                    className="w-full flex items-center gap-2 text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    <Palette size={16} strokeWidth={2} className="shrink-0" />
                    Thème
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      handleToggleMute();
                    }}
                    className="w-full flex items-center gap-2 text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    {isMuted ? (
                      <BellOff size={16} strokeWidth={2} className="shrink-0" />
                    ) : (
                      <Bell size={16} strokeWidth={2} className="shrink-0" />
                    )}
                    {isMuted ? "Réactiver les notifications" : "Couper les notifications"}
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      handleTogglePin();
                    }}
                    className="w-full flex items-center gap-2 text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    <Pin size={16} strokeWidth={2} className="shrink-0" />
                    {isPinned ? "Désépingler" : "Épingler cette conversation"}
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      handleExportConversation();
                    }}
                    className="w-full flex items-center gap-2 text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    <Download size={16} strokeWidth={2} className="shrink-0" />
                    Exporter la conversation
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowClearConfirm(true);
                    }}
                    className="w-full flex items-center gap-2 text-left px-4 py-2 text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                  >
                    <Trash2 size={16} strokeWidth={2} className="shrink-0" />
                    Supprimer la conversation
                  </button>
                  <button
                    onClick={handleToggleBlock}
                    className="w-full flex items-center gap-2 text-left px-4 py-2 text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                  >
                    <Ban size={16} strokeWidth={2} className="shrink-0" />
                    {isBlockedByMe
                      ? `Débloquer ${selectedUser.username}`
                      : `Bloquer ${selectedUser.username}`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Menu "⋮" du groupe : recherche et thème accessibles à tous les
            membres, actions d'administration réservées au créateur */}
        {selectedGroup && (
          <div className="relative">
            <button
              onClick={() => setShowGroupMenu(!showGroupMenu)}
              className="text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 transition"
              aria-label="Options du groupe"
            >
              <MoreVertical size={20} strokeWidth={2} />
            </button>
            {showGroupMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowGroupMenu(false)}
                />
                <div className="absolute right-0 z-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 text-sm w-52">
                  <button
                    onClick={() => {
                      setShowGroupMenu(false);
                      handleOpenSearch();
                    }}
                    className="w-full flex items-center gap-2 text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    <Search size={16} strokeWidth={2} className="shrink-0" />
                    Recherche
                  </button>
                  <button
                    onClick={() => {
                      setShowGroupMenu(false);
                      setShowWallpaperMenu(true);
                    }}
                    className="w-full flex items-center gap-2 text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    <Palette size={16} strokeWidth={2} className="shrink-0" />
                    Thème
                  </button>
                  <button
                    onClick={() => {
                      setShowGroupMenu(false);
                      handleToggleMute();
                    }}
                    className="w-full flex items-center gap-2 text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    {isMuted ? (
                      <BellOff size={16} strokeWidth={2} className="shrink-0" />
                    ) : (
                      <Bell size={16} strokeWidth={2} className="shrink-0" />
                    )}
                    {isMuted ? "Réactiver les notifications" : "Couper les notifications"}
                  </button>
                  <button
                    onClick={() => {
                      setShowGroupMenu(false);
                      handleTogglePin();
                    }}
                    className="w-full flex items-center gap-2 text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    <Pin size={16} strokeWidth={2} className="shrink-0" />
                    {isPinned ? "Désépingler" : "Épingler cette conversation"}
                  </button>
                  <button
                    onClick={() => {
                      setShowGroupMenu(false);
                      handleExportConversation();
                    }}
                    className="w-full flex items-center gap-2 text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    <Download size={16} strokeWidth={2} className="shrink-0" />
                    Exporter la conversation
                  </button>
                  <button
                    onClick={() => {
                      setShowGroupMenu(false);
                      setShowClearConfirm(true);
                    }}
                    className="w-full flex items-center gap-2 text-left px-4 py-2 text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                  >
                    <Trash2 size={16} strokeWidth={2} className="shrink-0" />
                    Supprimer la conversation
                  </button>
                  {selectedGroup.createdBy === authUser?._id && (
                    <>
                      <button
                        onClick={handleOpenRenameGroup}
                        className="w-full flex items-center gap-2 text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      >
                        <Pencil size={16} strokeWidth={2} className="shrink-0" />
                        Renommer le groupe
                      </button>
                      <button
                        onClick={handleOpenAddMembers}
                        className="w-full flex items-center gap-2 text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      >
                        <UserPlus size={16} strokeWidth={2} className="shrink-0" />
                        Ajouter des membres
                      </button>
                      <button
                        onClick={handleOpenManageMembers}
                        className="w-full flex items-center gap-2 text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      >
                        <Users size={16} strokeWidth={2} className="shrink-0" />
                        Gérer les membres
                      </button>
                      <button
                        onClick={handleToggleDiscoverable}
                        className="w-full flex items-center gap-2 text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      >
                        {selectedGroup.isDiscoverable ? (
                          <EyeOff size={16} strokeWidth={2} className="shrink-0" />
                        ) : (
                          <Eye size={16} strokeWidth={2} className="shrink-0" />
                        )}
                        {selectedGroup.isDiscoverable
                          ? "Rendre le groupe privé"
                          : "Rendre le groupe découvrable"}
                      </button>
                      {pendingJoinRequestsCount > 0 && (
                        <button
                          onClick={handleOpenJoinRequests}
                          className="w-full flex items-center gap-2 text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                        >
                          <UserCheck size={16} strokeWidth={2} className="shrink-0" />
                          Demandes d&apos;adhésion ({pendingJoinRequestsCount})
                        </button>
                      )}
                      <button
                        onClick={handleOpenDeleteGroupConfirm}
                        className="w-full flex items-center gap-2 text-left px-4 py-2 text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                      >
                        <Trash2 size={16} strokeWidth={2} className="shrink-0" />
                        Supprimer le groupe
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Barre de recherche dans l'historique de la conversation */}
      {showSearch && (
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
          <Search size={16} strokeWidth={2} className="text-zinc-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Rechercher dans cette conversation..."
            className="flex-1 min-w-0 bg-transparent outline-none text-sm"
          />
          {searchQuery.trim() && (
            <span className="text-xs text-zinc-400 shrink-0">
              {searchResults.length > 0
                ? `${currentResultIndex + 1}/${searchResults.length}`
                : "0 résultat"}
            </span>
          )}
          <button
            onClick={handlePreviousResult}
            disabled={searchResults.length === 0}
            className="text-zinc-500 hover:text-indigo-600 disabled:opacity-30 shrink-0"
            aria-label="Résultat précédent"
          >
            <ChevronUp size={18} strokeWidth={2} />
          </button>
          <button
            onClick={handleNextResult}
            disabled={searchResults.length === 0}
            className="text-zinc-500 hover:text-indigo-600 disabled:opacity-30 shrink-0"
            aria-label="Résultat suivant"
          >
            <ChevronDown size={18} strokeWidth={2} />
          </button>
          <button
            onClick={handleCloseSearch}
            className="text-zinc-500 hover:text-indigo-600 shrink-0"
            aria-label="Fermer la recherche"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Bandeau d'information affiché quand on prévisualise un groupe découvrable
          dont on n'est pas encore membre : on peut écrire, mais le message restera
          grisé et invisible aux autres tant que le créateur n'a pas approuvé */}
      {selectedGroup && !isMemberOfSelectedGroup && (
        <div className="px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950">
          Tu n&apos;es pas encore membre de ce groupe. Envoie un message pour
          demander à le rejoindre — il restera invisible aux membres jusqu&apos;à
          ce que le créateur accepte ta demande.
        </div>
      )}

      {/* Bandeau d'information affiché quand un blocage empêche l'envoi de messages */}
      {isBlockedRelationship && (
        <div className="px-4 py-2 text-center text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800">
          {isBlockedByMe
            ? "Tu as bloqué cet utilisateur. Débloque-le pour reprendre la conversation."
            : "Tu ne peux pas envoyer de message à cet utilisateur."}
        </div>
      )}
      {amIBlockedInThisGroup && (
        <div className="px-4 py-2 text-center text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800">
          Tu as été bloqué dans ce groupe et ne peux pas y écrire.
        </div>
      )}

      {/* Zone de messages : conteneur scrollable avec le fond choisi, la liste des
          bulles de messages (avec séparateurs de date), l'indicateur de saisie,
          et le bouton flottant "nouveaux messages" positionné par-dessus */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className={`custom-scrollbar h-full overflow-y-auto overscroll-contain p-4 flex flex-col gap-3 ${
            WALLPAPERS.find((w) => w.id === activeWallpaper)?.className || ""
          }`}
          style={
            activeWallpaper === "custom" && activeCustomWallpaper
              ? {
                  backgroundImage: `url(${activeCustomWallpaper})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          {isMessagesLoading && (
            <p className="text-center text-sm text-zinc-400">Chargement...</p>
          )}

          {/* Petit indicateur affiché tout en haut pendant le chargement de
              messages plus anciens (scroll infini) */}
          {isLoadingMoreMessages && (
            <p className="text-center text-xs text-zinc-400 py-2">
              Chargement des messages précédents...
            </p>
          )}

          {messages.map((msg: Message, index: number) => {
            const isMine = msg.sender === authUser?._id;
            const senderName = selectedGroup
              ? selectedGroup.members.find(
                  (m: GroupMember) => m._id === msg.sender,
                )?.username
              : undefined;

            const previousMsg = messages[index - 1];
            const showDateSeparator =
              !previousMsg ||
              new Date(previousMsg.createdAt).toDateString() !==
                new Date(msg.createdAt).toDateString();

            return (
              <div
                key={msg._id}
                id={msg._id}
                className={
                  highlightedMessageId === msg._id
                    ? "rounded-2xl ring-2 ring-amber-400 transition-all"
                    : ""
                }
              >
                {showDateSeparator && (
                  <div className="flex justify-center my-3">
                    <span className="text-xs font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded-full px-3 py-1">
                      {formatDateSeparator(msg.createdAt)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  msg={{
                    ...msg,
                    linkPreview: msg.linkPreview
                      ? {
                          ...msg.linkPreview,
                          title: msg.linkPreview.title ?? "",
                          description: "",
                          image: "",
                        }
                      : msg.linkPreview,
                  }}
                  isMine={isMine}
                  senderName={senderName}
                  isLast={index === messages.length - 1}
                />
              </div>
            );
          })}

          {/* Indicateur "en train d'écrire..." */}
          {isTyping && (
            <div className="max-w-xs px-4 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 self-start flex gap-1 items-center">
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bouton flottant "nouveaux messages" : juste la flèche dans un rond sur
            mobile, flèche + texte à partir de la taille "sm" */}
        {newMessagesCount > 0 && (
          <button
            onClick={scrollToBottom}
            aria-label="Aller aux nouveaux messages"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white shadow-lg flex items-center gap-2 rounded-full sm:px-4 sm:py-2 w-10 h-10 sm:w-auto sm:h-auto justify-center"
          >
            <ArrowDown size={18} strokeWidth={2.5} className="shrink-0" />
            <span className="hidden sm:inline text-sm font-medium">
              {newMessagesCount} nouveau{newMessagesCount > 1 ? "x" : ""}{" "}
              message
              {newMessagesCount > 1 ? "s" : ""}
            </span>
          </button>
        )}
      </div>

      {/* Barre de saisie du message, masquée si un blocage (privé ou dans le groupe) empêche l'envoi */}
      {!isBlockedRelationship && !amIBlockedInThisGroup && <MessageInput />}

      {/* Input caché pour l'upload d'une image de fond personnalisée,
          déclenché depuis la modale "Thème" ci-dessous */}
      <input
        ref={wallpaperFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleWallpaperImageSelect}
      />

      {/* Modale : fond de cette discussion (déplacée dans le menu "⋮" du contact/groupe) */}
      {showWallpaperMenu && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm">
            <h3 className="font-bold mb-3">Thème</h3>
            <div className="custom-scrollbar max-h-64 overflow-y-auto flex flex-col gap-1">
              {WALLPAPERS.map((w) => (
                <button
                  key={w.id}
                  onClick={() =>
                    w.id === "custom"
                      ? wallpaperFileInputRef.current?.click()
                      : handleWallpaperChange(w.id)
                  }
                  className={`block w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition ${
                    activeWallpaper === w.id ? "font-semibold" : ""
                  }`}
                >
                  {w.label}
                </button>
              ))}
              <button
                onClick={handleResetWallpaper}
                className="block w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Utiliser le fond par défaut
              </button>
            </div>
            <button
              onClick={() => setShowWallpaperMenu(false)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm mt-3"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Modale : renommer le groupe */}
      {showRenameGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm">
            <h3 className="font-bold mb-3">Renommer le groupe</h3>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 mb-3 bg-transparent text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowRenameGroup(false)}
                className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleRenameGroup}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium"
              >
                Renommer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : ajouter des membres */}
      {showAddMembers && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm">
            <h3 className="font-bold mb-3">Ajouter des membres</h3>
            <div className="custom-scrollbar max-h-48 overflow-y-auto mb-3">
              {usersNotInGroup.length === 0 && (
                <p className="text-sm text-zinc-400">
                  Tous tes contacts sont déjà dans ce groupe.
                </p>
              )}
              {usersNotInGroup.map((user: GroupMember) => (
                <label
                  key={user._id}
                  className="flex items-center gap-2 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={membersToAdd.includes(user._id)}
                    onChange={() => toggleMemberToAdd(user._id)}
                  />
                  {user.username}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddMembers(false)}
                className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleAddMembers}
                disabled={membersToAdd.length === 0}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : gérer les membres existants (retirer / bloquer dans le groupe) */}
      {showManageMembers && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm">
            <h3 className="font-bold mb-3">Gérer les membres</h3>
            <div className="custom-scrollbar max-h-64 overflow-y-auto mb-3 flex flex-col gap-1">
              {selectedGroup.members
                .filter((m: GroupMember) => m._id !== authUser?._id)
                .map((member: GroupMember) => (
                  <div
                    key={member._id}
                    className="flex items-center justify-between py-2 text-sm border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                  >
                    <span className="truncate">{member.username}</span>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleBlockMember(member._id)}
                        className="text-xs text-amber-600"
                      >
                        {isMemberBlockedInGroup(member._id)
                          ? "Débloquer"
                          : "Bloquer"}
                      </button>
                      <button
                        onClick={() => handleRemoveMember(member._id)}
                        className="text-xs text-red-600"
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                ))}
            </div>
            <button
              onClick={() => setShowManageMembers(false)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Confirmation avant suppression définitive du groupe */}
      {showDeleteGroupConfirm && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm">
            <h3 className="font-bold mb-2">Supprimer &quot;{selectedGroup.name}&quot; ?</h3>
            <p className="text-sm text-zinc-500 mb-4">
              Cette action est irréversible : le groupe et tous ses messages
              seront définitivement supprimés pour tous les membres.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteGroupConfirm(false)}
                className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDeleteGroup}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : confirmation avant de vider tous les messages de la
          conversation (contact ou groupe), sans supprimer le contact/groupe */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm">
            <h3 className="font-bold mb-2">Supprimer cette conversation ?</h3>
            <p className="text-sm text-zinc-500 mb-4">
              Tous les messages seront définitivement supprimés pour tout le
              monde. Le contact reste dans ta liste.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearing}
                className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleClearMessages}
                disabled={isClearing}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
              >
                {isClearing ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : demandes d'adhésion en attente pour ce groupe */}
      {showJoinRequests && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm">
            <h3 className="font-bold mb-3">Demandes d&apos;adhésion</h3>
            <div className="custom-scrollbar max-h-64 overflow-y-auto mb-3 flex flex-col gap-1">
              {(selectedGroup.joinRequests || []).length === 0 && (
                <p className="text-sm text-zinc-400">
                  Aucune demande en attente.
                </p>
              )}
              {(selectedGroup.joinRequests || []).map(
                (requester: GroupMember) => (
                  <div
                    key={requester._id}
                    className="flex items-center justify-between py-2 text-sm border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                  >
                    <span className="truncate">{requester.username}</span>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleApproveRequest(requester._id)}
                        className="text-xs text-emerald-600 font-medium"
                      >
                        Accepter
                      </button>
                      <button
                        onClick={() => handleRejectRequest(requester._id)}
                        className="text-xs text-red-600"
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
            <button
              onClick={() => setShowJoinRequests(false)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
      {/* Modale : informations sur le contact ou le groupe (ouverte en
          cliquant sur l'avatar ou le nom, comme la fiche contact de WhatsApp) */}
      {showContactInfo && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowContactInfo(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm max-h-[85vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center mb-4">
              <Avatar
                src={selectedGroup ? undefined : selectedUser?.avatar}
                fallback={
                  selectedGroup
                    ? selectedGroup.name[0]?.toUpperCase()
                    : selectedUser?.username[0]?.toUpperCase() || "?"
                }
                colorClass={selectedGroup ? "bg-emerald-600" : "bg-indigo-600"}
                size="w-24 h-24 text-3xl"
              />
              <h3 className="font-bold text-xl mt-3">
                {selectedGroup ? selectedGroup.name : selectedUser?.username}
              </h3>
              {selectedUser && (
                <p className="text-sm text-zinc-500 mt-1">
                  {onlineUsers.includes(selectedUser._id)
                    ? "En ligne"
                    : "Hors ligne"}
                </p>
              )}
            </div>

            {/* Actions communes aux contacts et aux groupes : notifications
                et suppression locale de la conversation */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 py-3 space-y-1">
              <button
                onClick={handleToggleMute}
                className="w-full flex items-center gap-2 text-left text-sm px-2 py-2 rounded-lg text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                {isMuted ? (
                  <BellOff size={15} strokeWidth={2} className="shrink-0" />
                ) : (
                  <Bell size={15} strokeWidth={2} className="shrink-0" />
                )}
                {isMuted
                  ? "Réactiver les notifications"
                  : "Couper les notifications"}
              </button>
              <button
                onClick={handleHideConversation}
                className="w-full flex items-center gap-2 text-left text-sm px-2 py-2 rounded-lg text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <EyeOff size={15} strokeWidth={2} className="shrink-0" />
                Masquer cette conversation
              </button>
            </div>

            {/* Détails supplémentaires pour un contact privé */}
            {selectedUser && (
              <div className="border-t border-zinc-200 dark:border-zinc-800 py-3 space-y-3">
                <div>
                  <p className="text-xs text-zinc-400 uppercase">Email</p>
                  <p className="text-sm">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400 uppercase mb-1">
                    Photos ({messages.filter((m: Message) => m.image).length})
                  </p>
                  {messages.filter((m: Message) => m.image).length === 0 ? (
                    <p className="text-sm text-zinc-400">Aucune photo pour le moment.</p>
                  ) : (
                    <div className="custom-scrollbar grid grid-cols-4 gap-1 max-h-40 overflow-y-auto">
                      {messages
                        .filter((m: Message) => m.image)
                        .map((m: Message) => (
                          <button
                            key={m._id}
                            onClick={() => setFullscreenMediaUrl(m.image)}
                            className="aspect-square rounded-lg overflow-hidden"
                          >
                            <Image
                              src={m.image}
                              alt="Photo échangée"
                              width={80}
                              height={80}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-zinc-400 uppercase mb-1">
                    Audios ({messages.filter((m: Message) => m.audio).length})
                  </p>
                  {messages.filter((m: Message) => m.audio).length === 0 ? (
                    <p className="text-sm text-zinc-400">Aucun audio pour le moment.</p>
                  ) : (
                    <div className="custom-scrollbar max-h-40 overflow-y-auto space-y-2">
                      {messages
                        .filter((m: Message) => m.audio)
                        .map((m: Message) => (
                          <audio
                            key={m._id}
                            controls
                            src={m.audio}
                            className="w-full h-8"
                          />
                        ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-zinc-400 uppercase mb-1">
                    Liens partagés (
                    {messages.filter((m: Message) => m.linkPreview).length})
                  </p>
                  {messages.filter((m: Message) => m.linkPreview).length === 0 ? (
                    <p className="text-sm text-zinc-400">Aucun lien pour le moment.</p>
                  ) : (
                    <div className="custom-scrollbar max-h-40 overflow-y-auto space-y-1">
                      {messages
                        .filter((m: Message) => m.linkPreview)
                        .map((m: Message) => (
                          <a
                            key={m._id}
                            href={m.linkPreview?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline truncate"
                          >
                            <Link2 size={14} strokeWidth={2} className="shrink-0" />
                            <span className="truncate">
                              {m.linkPreview?.title || m.linkPreview?.url}
                            </span>
                          </a>
                        ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    handleToggleBlock();
                    setShowContactInfo(false);
                  }}
                  className="w-full flex items-center gap-2 text-left text-sm text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg px-2 py-2 transition"
                >
                  <Ban size={15} strokeWidth={2} className="shrink-0" />
                  {isBlockedByMe
                    ? `Débloquer ${selectedUser.username}`
                    : `Bloquer ${selectedUser.username}`}
                </button>
              </div>
            )}

            {/* Détails et actions supplémentaires pour un groupe */}
            {selectedGroup && (
              <div className="border-t border-zinc-200 dark:border-zinc-800 py-3">
                <p className="text-sm text-zinc-500 mb-3">
                  {selectedGroup.members.length} membre
                  {selectedGroup.members.length > 1 ? "s" : ""}
                  {selectedGroup.createdAt && (
                    <>
                      {" · "}Créé le{" "}
                      {new Date(selectedGroup.createdAt).toLocaleDateString(
                        "fr-FR",
                      )}
                    </>
                  )}
                </p>

                <p className="text-xs text-zinc-400 uppercase mb-1">Membres</p>
                <div className="custom-scrollbar max-h-48 overflow-y-auto mb-3">
                  {selectedGroup.members.map((member: GroupMember) => (
                    <div
                      key={member._id}
                      className="flex items-center gap-3 py-2"
                    >
                      <Avatar
                        fallback={member.username[0]?.toUpperCase()}
                        colorClass="bg-indigo-600"
                        size="w-8 h-8 text-sm"
                      />
                      <span className="text-sm truncate">
                        {member.username}
                        {member._id === selectedGroup.createdBy && (
                          <span className="text-xs text-zinc-400 ml-1">
                            (créateur)
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Actions rapides réservées au créateur du groupe */}
                {selectedGroup.createdBy === authUser?._id && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 space-y-1">
                    <button
                      onClick={() => {
                        setShowContactInfo(false);
                        handleOpenRenameGroup();
                      }}
                      className="w-full flex items-center gap-2 text-left text-sm px-2 py-2 rounded-lg text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    >
                      <Pencil size={15} strokeWidth={2} className="shrink-0" />
                      Renommer le groupe
                    </button>
                    <button
                      onClick={() => {
                        setShowContactInfo(false);
                        handleOpenAddMembers();
                      }}
                      className="w-full flex items-center gap-2 text-left text-sm px-2 py-2 rounded-lg text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    >
                      <UserPlus size={15} strokeWidth={2} className="shrink-0" />
                      Ajouter des membres
                    </button>
                    <button
                      onClick={handleToggleDiscoverable}
                      className="w-full flex items-center gap-2 text-left text-sm px-2 py-2 rounded-lg text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    >
                      {selectedGroup.isDiscoverable ? (
                        <EyeOff size={15} strokeWidth={2} className="shrink-0" />
                      ) : (
                        <Eye size={15} strokeWidth={2} className="shrink-0" />
                      )}
                      {selectedGroup.isDiscoverable
                        ? "Rendre le groupe privé"
                        : "Rendre le groupe découvrable"}
                    </button>
                    <button
                      onClick={() => {
                        setShowContactInfo(false);
                        handleOpenDeleteGroupConfirm();
                      }}
                      className="w-full flex items-center gap-2 text-left text-sm px-2 py-2 rounded-lg text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                    >
                      <Trash2 size={15} strokeWidth={2} className="shrink-0" />
                      Supprimer le groupe
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setShowContactInfo(false)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm mt-3"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Aperçu plein écran d'une photo cliquée depuis la galerie de la fiche contact */}
      {fullscreenMediaUrl && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4"
          onClick={() => setFullscreenMediaUrl(null)}
        >
          <button
            onClick={() => setFullscreenMediaUrl(null)}
            className="absolute top-4 right-4 text-white"
            aria-label="Fermer l'aperçu"
          >
            <X size={32} strokeWidth={2} />
          </button>
          <Image
            src={fullscreenMediaUrl}
            alt="Photo en plein écran"
            width={1200}
            height={1200}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
