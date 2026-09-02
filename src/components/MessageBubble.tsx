"use client";

// Import des hooks React et des composants nécessaires
import { useState, useRef } from "react";
import Image from "next/image";
import { useChatStore } from "@/store/useChatStore";
import { useAuthStore } from "@/store/useAuthStore";
import EmojiPicker from "./EmojiPicker";
import { SmilePlus, Plus, X, Check, CheckCheck } from "lucide-react";

type Reaction = {
  emoji: string;
  user: string | { _id: string; username: string };
};

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
  reactions?: Reaction[];
  linkPreview?: {
    url: string;
    title: string;
    description: string;
    image: string;
  } | null;
  pendingApproval?: boolean;
  replyTo?: {
    _id: string;
    text: string;
  } | null;
};

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function formatReadTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getReactionUserId(user: Reaction["user"]): string {
  return typeof user === "object" ? user._id : user;
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
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Longueur au-delà de laquelle un message texte est raccourci avec
  // un bouton "Lire la suite" (comme sur WhatsApp/Messenger)
  const TEXT_TRUNCATE_LENGTH = 300;
  const isLongText = msg.text && msg.text.length > TEXT_TRUNCATE_LENGTH;
  const displayedText =
    isLongText && !isTextExpanded
      ? `${msg.text.slice(0, TEXT_TRUNCATE_LENGTH)}...`
      : msg.text;

  const { deleteMessage, editMessage, setReplyingTo, reactToMessage } =
    useChatStore();
  const { authUser } = useAuthStore();

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

  const handleReact = (emoji: string) => {
    reactToMessage(msg._id, emoji);
    setShowReactionPicker(false);
    setShowMenu(false);
  };

  // Regroupe les réactions par emoji avec leur nombre
  const groupedReactions = (msg.reactions || []).reduce(
    (acc: { emoji: string; count: number; mine: boolean }[], r) => {
      const existing = acc.find((g) => g.emoji === r.emoji);
      const isMine = getReactionUserId(r.user) === authUser?._id;
      if (existing) {
        existing.count += 1;
        if (isMine) existing.mine = true;
      } else {
        acc.push({ emoji: r.emoji, count: 1, mine: isMine });
      }
      return acc;
    },
    [],
  );

  return (
    <div className={`relative flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      <div className="relative flex group">
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
            onDoubleClick={() => handleReact("❤️")}
            className={`max-w-xs px-4 py-2 rounded-2xl cursor-pointer ${
              msg.pendingApproval
                ? "opacity-50 bg-zinc-200 dark:bg-zinc-700 self-end"
                : isMine
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

            {msg.text && (
              <span className="whitespace-pre-wrap break-words">
                {displayedText}
                {isLongText && (
                  <>
                    {" "}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsTextExpanded(!isTextExpanded);
                      }}
                      className={`font-semibold underline underline-offset-2 ${
                        isMine
                          ? "text-indigo-100 hover:text-white"
                          : "text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                      }`}
                    >
                      {isTextExpanded ? "Réduire" : "Lire la suite"}
                    </button>
                  </>
                )}
              </span>
            )}

            {/* Carte d'aperçu du lien, affichée si le message contient une URL
                dont on a pu récupérer les métadonnées (titre, description, image) */}
            {msg.linkPreview && (
              <a
                href={msg.linkPreview.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`block mt-2 rounded-lg overflow-hidden border ${
                  isMine
                    ? "border-indigo-400 bg-indigo-700"
                    : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                }`}
              >
                {msg.linkPreview.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={msg.linkPreview.image}
                    alt=""
                    className="w-full max-h-40 object-cover"
                  />
                )}
                <div className="p-2">
                  {msg.linkPreview.title && (
                    <p className="text-xs font-semibold line-clamp-1">
                      {msg.linkPreview.title}
                    </p>
                  )}
                  {msg.linkPreview.description && (
                    <p className="text-xs opacity-70 line-clamp-2">
                      {msg.linkPreview.description}
                    </p>
                  )}
                  <p className="text-xs opacity-50 mt-1 truncate">
                    {msg.linkPreview.url}
                  </p>
                </div>
              </a>
            )}

            {msg.edited && (
              <span className="text-xs opacity-60 ml-1">(modifié)</span>
            )}
            {isMine && (
              <span className="inline-flex ml-2 opacity-70 align-middle">
                {msg.status === "read" ? (
                  <CheckCheck size={14} strokeWidth={2} />
                ) : (
                  <Check size={14} strokeWidth={2} />
                )}
              </span>
            )}
          </div>
        )}

        {/* Bouton discret pour réagir, visible au survol (desktop) */}
        {!isEditing && (
          <div className="relative">
            <button
              onClick={() => setShowReactionPicker(!showReactionPicker)}
              className="opacity-0 group-hover:opacity-100 transition px-1 self-center text-zinc-500 hover:text-indigo-600"
              aria-label="Réagir"
            >
              <SmilePlus size={16} strokeWidth={2} />
            </button>

            {showReactionPicker && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowReactionPicker(false)}
                />
                <div
                  className={`absolute z-20 bottom-full mb-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full shadow-lg px-2 py-1 flex gap-1 items-center ${
                    isMine ? "right-0" : "left-0"
                  }`}
                >
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReact(emoji)}
                      className="text-lg hover:scale-125 transition"
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setShowReactionPicker(false);
                      setShowFullEmojiPicker(true);
                    }}
                    className="text-zinc-400 hover:text-zinc-600 px-1"
                    aria-label="Plus d'emojis"
                  >
                    <Plus size={16} strokeWidth={2} />
                  </button>
                </div>
              </>
            )}

            {showFullEmojiPicker && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowFullEmojiPicker(false)}
                />
                <div
                  className={`absolute z-20 bottom-full mb-1 ${
                    isMine ? "right-0" : "left-0"
                  }`}
                >
                  <EmojiPicker onSelect={handleReact} />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Affichage des réactions déjà posées sous la bulle */}
      {groupedReactions.length > 0 && (
        <div className="flex gap-1 mt-1 flex-wrap">
          {groupedReactions.map((g) => (
            <button
              key={g.emoji}
              onClick={() => handleReact(g.emoji)}
              className={`text-xs rounded-full px-2 py-0.5 border ${
                g.mine
                  ? "bg-indigo-100 dark:bg-indigo-900 border-indigo-400"
                  : "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {g.emoji} {g.count > 1 && g.count}
            </button>
          ))}
        </div>
      )}

      {isMine && isLast && msg.status === "read" && msg.readAt && (
        <div className="text-xs text-zinc-400 mt-1 text-right w-full">
          Vu à {formatReadTime(msg.readAt)}
        </div>
      )}

      {msg.pendingApproval && (
        <div className="text-xs text-amber-600 mt-1 text-right w-full">
          En attente d&apos;approbation par le créateur du groupe
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
            <div className="flex gap-1 px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 items-center">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className="text-lg hover:scale-125 transition"
                >
                  {emoji}
                </button>
              ))}
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowFullEmojiPicker(true);
                }}
                className="text-zinc-400 hover:text-zinc-600 px-1"
                aria-label="Plus d'emojis"
              >
                <Plus size={16} strokeWidth={2} />
              </button>
            </div>
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
            className="absolute top-4 right-4 text-white"
            aria-label="Fermer l'aperçu"
          >
            <X size={32} strokeWidth={2} />
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
