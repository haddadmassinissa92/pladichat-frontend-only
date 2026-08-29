"use client";

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

export default function ChatContainer() {
  const {
    selectedUser,
    selectedGroup,
    messages,
    getMessages,
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

  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const { authUser, socket } = useAuthStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Suivi du scroll pour l'indicateur "Nouveaux messages"
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const previousMessagesLength = useRef(0);

  const conversationId = selectedGroup?._id || selectedUser?._id || null;

  // Gestion du fond d'écran spécifique à cette conversation
  const [wallpaper, setWallpaper] = useState("default");
  const [customWallpaper, setCustomWallpaper] = useState<string | null>(null);
  const [showWallpaperMenu, setShowWallpaperMenu] = useState(false);
  const wallpaperFileInputRef = useRef<HTMLInputElement>(null);

  const resolvedConversationWallpaper = conversationId
    ? resolveWallpaper(conversationId)
    : { id: wallpaper, image: customWallpaper };
  const activeWallpaper = resolvedConversationWallpaper.id;
  const activeCustomWallpaper = resolvedConversationWallpaper.image;

  const handleWallpaperChange = (id: string) => {
    if (!conversationId) return;
    setWallpaper(id);
    setConversationWallpaper(conversationId, id);
    setShowWallpaperMenu(false);
  };

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

  const handleResetWallpaper = () => {
    if (!conversationId) return;
    clearConversationWallpaper(conversationId);
    const resolved = resolveWallpaper(conversationId);
    setWallpaper(resolved.id);
    setCustomWallpaper(resolved.image);
    setShowWallpaperMenu(false);
  };

  // Récupérer les messages et les marquer comme lus lorsque l'utilisateur/groupe sélectionné change
  useEffect(() => {
    if (selectedUser) {
      getMessages(selectedUser._id, false);
      markAsRead(selectedUser._id, false);
    } else if (selectedGroup) {
      getMessages(selectedGroup._id, true);
      markAsRead(selectedGroup._id, true);
    }
  }, [selectedUser, selectedGroup, getMessages, markAsRead]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setNewMessagesCount(0);
    setIsNearBottom(true);
    previousMessagesLength.current = 0;
  }, [selectedUser?._id, selectedGroup?._id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Souscrire aux événements de messages en temps réel
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

  // Détecter si l'utilisateur est proche du bas de la conversation
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 100;
    setIsNearBottom(nearBottom);
    if (nearBottom) setNewMessagesCount(0);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setNewMessagesCount(0);
  };

  // Faire défiler vers le bas lorsque les messages changent (sauf si l'utilisateur a scrollé vers le haut)
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
          const increment = messages.length - previousMessagesLength.current;
          setNewMessagesCount((count) => count + increment);
        }
      }
    }
    previousMessagesLength.current = messages.length;
  }, [messages, authUser, isNearBottom]);

  // Faire défiler vers le bas quand l'indicateur de saisie apparaît, si déjà en bas
  useEffect(() => {
    if (isNearBottom) {
      const timeout = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isTyping, isNearBottom]);

  // Souscrire aux événements de saisie en temps réel pour l'utilisateur sélectionné
  useEffect(() => {
    subscribeToTyping();
    return () => unsubscribeFromTyping();
  }, [selectedUser, socket, subscribeToTyping, unsubscribeFromTyping]);

  // Gérer les événements de glissement pour revenir à la liste sur mobile
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

  // Afficher un message si rien n'est sélectionné
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

          {/** prevention de l'ecriture , quand un contact t'ecris un message */}
          {isTyping && (
            <div className="max-w-xs px-4 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 self-start flex gap-1 items-center">
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Indicateur de nouveaux messages, visible quand on a scrollé vers le haut */}
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

      <MessageInput />
    </div>
  );
}
