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

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useChatStore } from "@/store/useChatStore";
import { useAuthStore } from "@/store/useAuthStore";

function Avatar({
  src,
  fallback,
  colorClass,
  size = "w-10 h-10",
}: {
  src?: string;
  fallback: string;
  colorClass: string;
  size?: string;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={fallback}
        width={40}
        height={40}
        className={`${size} rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      className={`${size} rounded-full ${colorClass} text-white flex items-center justify-center font-semibold`}
    >
      {fallback}
    </div>
  );
}

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
    selectedUser,
    setSelectedUser,
    isUsersLoading,
    groups,
    getGroups,
    selectedGroup,
    setSelectedGroup,
    createGroup,
  } = useChatStore();
  const { onlineUsers, authUser, logout, updateProfile, socket } =
    useAuthStore();

  const [search, setSearch] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getUsers();
    getGroups();
  }, [getUsers, getGroups]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      getUsers();
      getGroups();
    };
    socket.on("newMessage", refresh);
    socket.on("messagesRead", refresh);
    return () => {
      socket.off("newMessage", refresh);
      socket.off("messagesRead", refresh);
    };
  }, [socket, getUsers, getGroups]);

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
    setShowProfileMenu(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <aside className="w-full h-full border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pink-600 text-white flex items-center justify-center font-bold text-sm">
            P
          </div>
          <h2 className="font-bold text-lg">PladiChat</h2>
        </div>
        <button
          onClick={() => setShowCreateGroup(true)}
          className="text-indigo-600 text-xl"
          aria-label="Créer un groupe"
        >
          +
        </button>
      </div>

      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
        <input
          type="text"
          placeholder="Rechercher un contact..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-zinc-300 dark:border-zinc-700 rounded-full px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {groups.length > 0 && (
          <div className="px-3 pt-2 text-xs font-semibold text-zinc-400 uppercase">
            Groupes
          </div>
        )}
        {groups.map((group: Group) => (
          <button
            key={group._id}
            onClick={() => setSelectedGroup(group)}
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
                {group.lastMessage && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                    {typeof group.lastMessage.sender === "object"
                      ? group.lastMessage.sender.username
                      : ""}
                    : {formatLastMessage(group.lastMessage)}
                  </p>
                )}
                {!!group.unreadCount && (
                  <span className="bg-indigo-600 text-white text-xs font-semibold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center flex-shrink-0">
                    {group.unreadCount > 99 ? "99+" : group.unreadCount}
                  </span>
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

        {!isUsersLoading && users.length === 0 && (
          <p className="text-center text-sm text-zinc-400 mt-4">
            Aucun contact.
          </p>
        )}

        {users.length > 0 && (
          <div className="px-3 pt-2 text-xs font-semibold text-zinc-400 uppercase">
            Contacts
          </div>
        )}

        {users
          .filter((user: User) =>
            user.username.toLowerCase().includes(search.toLowerCase()),
          )
          .map((user: User) => (
            <button
              key={user._id}
              onClick={() => setSelectedUser(user)}
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
                  colorClass="bg-indigo-600"
                />
                {onlineUsers.includes(user._id) && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full" />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{user.username}</span>
                  {user.lastMessage && (
                    <span className="text-xs text-zinc-400 flex-shrink-0">
                      {formatTime(user.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  {user.lastMessage && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                      {formatLastMessage(user.lastMessage)}
                    </p>
                  )}
                  {!!user.unreadCount && (
                    <span className="bg-indigo-600 text-white text-xs font-semibold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center flex-shrink-0">
                      {user.unreadCount > 99 ? "99+" : user.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
      </div>

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
            <div className="max-h-48 overflow-y-auto mb-3">
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
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barre de profil en bas, style WhatsApp : avatar + nom + menu vers le haut */}
      <div className="relative border-t border-zinc-200 dark:border-zinc-800 p-3">
        <button
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          disabled={uploading}
          className="w-full flex items-center gap-3 rounded-lg p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        >
          <Avatar
            src={authUser?.avatar}
            fallback={authUser?.username?.[0]?.toUpperCase() || "?"}
            colorClass="bg-indigo-600"
            size="w-9 h-9"
          />
          <span className="font-medium text-sm truncate">
            {authUser?.username}
          </span>
        </button>

        {showProfileMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowProfileMenu(false)}
            />
            <div className="absolute left-3 bottom-16 z-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 text-sm w-48">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="block w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Changer la photo
              </button>

              <div className="flex items-center justify-between px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <span>Mode sombre</span>
                <button
                  type="button"
                  onClick={() => setIsDarkMode(toggleTheme())}
                  aria-label="Basculer le mode sombre"
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    isDarkMode ? "bg-indigo-600" : "bg-zinc-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      isDarkMode ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <button
                onClick={logout}
                className="block w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-red-600"
              >
                Se déconnecter
              </button>
            </div>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>
    </aside>
  );
}
