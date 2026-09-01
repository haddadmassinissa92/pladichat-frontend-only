"use client";

// Définit la structure du message dans l'application de messagerie
type Message = {
  _id: string; // Identifiant unique du message
  sender: string; // Identifiant ou nom de l'expéditeur du message
  receiver: string; // Identifiant ou nom du destinataire (utilisateur ou groupe)
  text: string; // Contenu textuel du message
  image: string; // URL ou chemin vers une image jointe
  audio: string; // URL ou chemin vers un message vocal ou fichier audio joint
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

// Icône propre et cohérente avec le reste de l'application
import { Palette, ArrowLeft, ArrowDown, MoreVertical, Search, ChevronUp, ChevronDown, X } from "lucide-react";

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
  } = useChatStore();

  // État du menu "gérer le groupe", utilisateur connecté, socket temps réel,
  // et références DOM utilisées pour le défilement et les gestes tactiles
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const { authUser, socket, toggleBlockUser } = useAuthStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const pendingScrollTargetRef = useRef<string | null>(null);

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

  // Gestion de la recherche dans l'historique des messages
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(
    null,
  );

  // Déclarer conversationId et isGroupConversation ici pour qu'ils soient disponibles
  // dans scrollToMessageId qui est appelée au-dessous
  const conversationId = selectedGroup?._id || selectedUser?._id || null;
  const isGroupConversation = !!selectedGroup;

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

  // Ouverture de la barre de recherche dans l'historique
  const handleOpenSearch = () => {
    setShowSearch(true);
  };

  // Fermeture de la barre de recherche
  const handleCloseSearch = () => {
    setShowSearch(false);
    setSearchQuery("");
    setCurrentResultIndex(0);
    setHighlightedMessageId(null);
    clearSearchResults();
  };

 // Gère les changements dans la barre de recherche
const handleSearchChange = (query: string) => {
  setSearchQuery(query);
  if (query.trim() && conversationId) {
    searchMessages(conversationId, isGroupConversation, query.trim());
  } else {
    clearSearchResults();
  }
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

        <h2 className="font-bold flex-1">
          {selectedGroup ? selectedGroup.name : selectedUser?.username}
        </h2>

        {/* Bouton pour ouvrir la recherche dans l'historique de cette conversation */}
        <button
          onClick={handleOpenSearch}
          className="text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 transition"
          aria-label="Rechercher dans la conversation"
        >
          <Search size={20} strokeWidth={2} />
        </button>

        {/* Menu de choix du fond d'écran de cette conversation */}
        <div className="relative">
          <button
            onClick={() => setShowWallpaperMenu(!showWallpaperMenu)}
            className="text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 transition"
            aria-label="Changer le fond de cette discussion"
          >
            <Palette size={20} strokeWidth={2} />
          </button>
          {showWallpaperMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowWallpaperMenu(false)}
              />
              <div className="absolute right-0 z-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 text-sm w-52">
                <div className="px-4 py-1 text-xs text-zinc-400 uppercase">
                  Fond de cette discussion
                </div>
                {WALLPAPERS.map((w) => (
                  <button
                    key={w.id}
                    onClick={() =>
                      w.id === "custom"
                        ? wallpaperFileInputRef.current?.click()
                        : handleWallpaperChange(w.id)
                    }
                    className={`block w-full text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition ${
                      activeWallpaper === w.id ? "font-semibold" : ""
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
                <div className="border-t border-zinc-200 dark:border-zinc-700 mt-1">
                  <button
                    onClick={handleResetWallpaper}
                    className="block w-full text-left px-4 py-2 text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    Utiliser le fond par défaut
                  </button>
                </div>
              </div>
            </>
          )}
          <input
            ref={wallpaperFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleWallpaperImageSelect}
          />
        </div>

        {/* Menu "⋮" pour bloquer/débloquer, visible uniquement en conversation privée */}
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
                    onClick={handleToggleBlock}
                    className="block w-full text-left px-4 py-2 text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                  >
                    {isBlockedByMe
                      ? `Débloquer ${selectedUser.username}`
                      : `Bloquer ${selectedUser.username}`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Menu "⋮" de gestion du groupe, visible seulement pour son créateur */}
        {selectedGroup && selectedGroup.createdBy === authUser?._id && (
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
                    onClick={handleOpenRenameGroup}
                    className="block w-full text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    Renommer le groupe
                  </button>
                  <button
                    onClick={handleOpenAddMembers}
                    className="block w-full text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    Ajouter des membres
                  </button>
                  <button
                    onClick={handleOpenManageMembers}
                    className="block w-full text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    Gérer les membres
                  </button>
                  <button
                    onClick={handleToggleDiscoverable}
                    className="block w-full text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    {selectedGroup.isDiscoverable
                      ? "Rendre le groupe privé"
                      : "Rendre le groupe découvrable"}
                  </button>
                  {pendingJoinRequestsCount > 0 && (
                    <button
                      onClick={handleOpenJoinRequests}
                      className="block w-full text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    >
                      Demandes d&apos;adhésion ({pendingJoinRequestsCount})
                    </button>
                  )}
                  <button
                    onClick={handleOpenDeleteGroupConfirm}
                    className="block w-full text-left px-4 py-2 text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                  >
                    Supprimer le groupe
                  </button>
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
          className={`h-full overflow-y-auto p-4 flex flex-col gap-3 ${
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
                  msg={msg}
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
            <div className="max-h-48 overflow-y-auto mb-3">
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
            <div className="max-h-64 overflow-y-auto mb-3 flex flex-col gap-1">
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

      {/* Modale : demandes d'adhésion en attente pour ce groupe */}
      {showJoinRequests && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm">
            <h3 className="font-bold mb-3">Demandes d&apos;adhésion</h3>
            <div className="max-h-64 overflow-y-auto mb-3 flex flex-col gap-1">
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
    </div>
  );
}

