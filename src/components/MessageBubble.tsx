"use client";

// Import des hooks React et des composants nécessaires
import { useState, useRef } from "react";
import Image from "next/image";
import { useChatStore } from "@/store/useChatStore";

// TypeScript type definition for a message object
type Message = {
  _id: string;
  sender: string;
  receiver: string;
  text: string;
  image: string;
  audio: string;
  status: string;
  readAt?: string | null;
  createdAt: string;
  edited?: boolean;
  replyTo?: {
    _id: string;
    text: string;
  } | null;
};

function formatReadTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({
  msg,
  isMine,
  senderName,
  isLast = false,
}: {
  msg: Message;
  isMine: boolean;
  senderName?: string;
  isLast?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(msg.text);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { deleteMessage, editMessage, setReplyingTo } = useChatStore();

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu(true);
  };

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => setShowMenu(true), 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.text);
    setShowMenu(false);
  };

  const handleDeleteClick = () => {
    setShowMenu(false);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    deleteMessage(msg._id);
    setShowDeleteConfirm(false);
  };

  const handleReply = () => {
    setReplyingTo(msg);
    setShowMenu(false);
  };

  const handleEditSave = () => {
    editMessage(msg._id, editText);
    setIsEditing(false);
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowImagePreview(true);
  };

  return (
    <div className={`relative flex ${isMine ? "self-end" : "self-start"}`}>
      {isEditing ? (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm bg-transparent"
            autoFocus
          />
          <button
            onClick={handleEditSave}
            className="text-indigo-600 text-sm font-medium"
          >
            OK
          </button>
        </div>
      ) : (
        <div
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`max-w-xs px-4 py-2 rounded-2xl cursor-pointer ${
            isMine
              ? "bg-indigo-600 text-white self-end"
              : "bg-zinc-100 dark:bg-zinc-800 self-start"
          }`}
        >
          {!isMine && senderName && (
            <div className="text-xs font-semibold text-indigo-600 mb-1">
              {senderName}
            </div>
          )}

          {msg.replyTo && (
            <div className="text-xs opacity-70 border-l-2 pl-2 mb-1 italic truncate">
              {msg.replyTo.text}
            </div>
          )}
          {msg.image && (
            <Image
              src={msg.image}
              alt="Image envoyée"
              width={220}
              height={220}
              onClick={handleImageClick}
              className="rounded-lg mb-1 max-w-full h-auto cursor-zoom-in"
            />
          )}

          {msg.audio && (
            <audio controls src={msg.audio} className="max-w-full mb-1" />
          )}

          {msg.text}

          {msg.edited && (
            <span className="text-xs opacity-60 ml-1">(modifié)</span>
          )}
          {isMine && (
            <span className="text-xs ml-2 opacity-70">
              {msg.status === "read" ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      )}

      {isMine && isLast && msg.status === "read" && msg.readAt && (
        <div className="text-xs text-zinc-400 mt-1 text-right w-full">
          Vu à {formatReadTime(msg.readAt)}
        </div>
      )}

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div
            className={`absolute z-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 text-sm ${
              isMine ? "right-0" : "left-0"
            }`}
          >
            <button
              onClick={handleCopy}
              className="block w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Copier
            </button>
            <button
              onClick={handleReply}
              className="block w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Répondre
            </button>
            {isMine && (
              <>
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setShowMenu(false);
                  }}
                  className="block w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Modifier
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="block w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-red-600"
                >
                  Supprimer
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Confirmation avant suppression d'un message */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 w-full max-w-sm">
            <h3 className="font-bold mb-2">Supprimer ce message ?</h3>
            <p className="text-sm text-zinc-500 mb-4">
              Cette action est irréversible.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aperçu de l'image en plein écran */}
      {showImagePreview && msg.image && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImagePreview(false)}
        >
          <button
            onClick={() => setShowImagePreview(false)}
            className="absolute top-4 right-4 text-white text-3xl leading-none"
            aria-label="Fermer l'aperçu"
          >
            ✕
          </button>
          <Image
            src={msg.image}
            alt="Image en plein écran"
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
