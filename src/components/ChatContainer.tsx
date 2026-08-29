"use client";

// Type décrivant la forme d'un message tel qu'il vient du backend
type Message = {
  _id: string;
  sender: string;
  receiver: string;
  text: string;
  image: string;
  audio: string;
  status: string;
  createdAt: string;
};

// Imports : hooks React, stores Zustand (chat + auth), composants de la conversation,
// compression d'image et gestion du fond d'écran personnalisé
import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/store/useChatStore";
import { useAuthStore } from "@/store/useAuthStore";
import MessageInput from "@/components/MessageInput";
import imageCompression from "browser-image-compression";
import {
  WALLPAPERS,
  resolveWallpaper,
  setConversationWallpaper,
  setConversationWallpaperImage,
  clearConversationWallpaper,
} from "@/lib/wallpaper";
import MessageBubble from "./MessageBubble";

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
  } = useChatStore();

  // État du menu "supprimer le groupe", utilisateur connecté, socket temps réel,
  // et références DOM utilisées pour le défilement et les gestes tactiles
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const { authUser, socket, toggleBlockUser } = useAuthStore();
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

  const conversationId = selectedGroup?._id || selectedUser?._id || null;
  const isGroupConversation = !!selectedGroup;

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
  }, [selectedUser?._id, selectedGroup?._id]);
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

    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 100;
    setIsNearBottom(nearBottom);
    if (nearBottom) setNewMessagesCount(0);

    // Scroll infini : si on est proche du haut et qu'il reste des messages plus
    // anciens à charger, on lance le chargement (le store empêche les doublons
    // d'appel grâce à isLoadingMoreMessages)
    if (el.scrollTop < 50 && hasMoreMessages && !isLoadingMoreMessages && conversationId) {
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

  return (
    <div
      className="h-full flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* En-tête : bouton retour (mobile), nom de la conversation,
          menu de fond d'écran, menu bloquer/débloquer, et menu de suppression du groupe */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
        <button
          onClick={() => {
            setSelectedUser(null);
            setSelectedGroup(null);
          }}
          className="sm:hidden p-1 -ml-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          aria-label="Retour"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <h2 className="font-bold flex-1">
          {selectedGroup ? selectedGroup.name : selectedUser?.username}
        </h2>

        {/* Menu de choix du fond d'écran de cette conversation */}
        <div className="relative">
          <button
            onClick={() => setShowWallpaperMenu(!showWallpaperMenu)}
            className="text-xl px-2"
            aria-label="Changer le fond de cette discussion"
          >
            🎨
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
                    className={`block w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                      activeWallpaper === w.id ? "font-semibold" : ""
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
                <div className="border-t border-zinc-200 dark:border-zinc-700 mt-1">
                  <button
                    onClick={handleResetWallpaper}
                    className="block w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
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
              className="text-xl px-2"
              aria-label="Options"
            >
              ⋮
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
                    className="block w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-red-600"
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

        {/* Menu de suppression du groupe, visible seulement pour son créateur */}
        {selectedGroup && selectedGroup.createdBy === authUser?._id && (
          <div className="relative">
            <button
              onClick={() => setShowGroupMenu(!showGroupMenu)}
              className="text-xl px-2"
            >
              ⋮
            </button>
            {showGroupMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowGroupMenu(false)}
                />
                <div className="absolute right-0 z-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 text-sm w-40">
                  <button
                    onClick={() => {
                      deleteGroup(selectedGroup._id);
                      setShowGroupMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-red-600"
                  >
                    Supprimer le groupe
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bandeau d'information affiché quand un blocage empêche l'envoi de messages */}
      {isBlockedRelationship && (
        <div className="px-4 py-2 text-center text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800">
          {isBlockedByMe
            ? "Tu as bloqué cet utilisateur. Débloque-le pour reprendre la conversation."
            : "Tu ne peux pas envoyer de message à cet utilisateur."}
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
                  (m: { _id: string; username: string }) => m._id === msg.sender,
                )?.username
              : undefined;

            const previousMsg = messages[index - 1];
            const showDateSeparator =
              !previousMsg ||
              new Date(previousMsg.createdAt).toDateString() !==
                new Date(msg.createdAt).toDateString();

            return (
              <div key={msg._id}>
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
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
            <span className="hidden sm:inline text-sm font-medium">
              {newMessagesCount} nouveau{newMessagesCount > 1 ? "x" : ""} message
              {newMessagesCount > 1 ? "s" : ""}
            </span>
          </button>
        )}
      </div>

      {/* Barre de saisie du message, masquée si un blocage empêche l'envoi */}
      {!isBlockedRelationship && <MessageInput />}
    </div>
  );
}
