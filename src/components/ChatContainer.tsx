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
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

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

  // Faire défiler vers le bas lorsque les messages ou l'état de saisie changent
  useEffect(() => {
    const timeout = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timeout);
  }, [messages, isTyping]);

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

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
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

      <MessageInput />
    </div>
  );
}
