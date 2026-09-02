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
import { Search, Plus, Palette } from "lucide-react";
import imageCompression from "browser-image-compression";
import { useChatStore } from "@/store/useChatStore";
import { useAuthStore } from "@/store/useAuthStore";
import Avatar from "./Avatar";
import {
  WALLPAPERS,
  getGlobalWallpaper,
  setGlobalWallpaper,
  setGlobalWallpaperImage,
} from "@/lib/wallpaper";

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
    previewDiscoverableGroup,
  } = useChatStore();
  const { onlineUsers, authUser, logout, updateProfile, socket, changePassword, deleteAccount } =
    useAuthStore();

  const [search, setSearch] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
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

  // Découverte de groupes publics et demandes d'adhésion
  const [showDiscoverGroups, setShowDiscoverGroups] = useState(false);

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
  }, [getUsers, getGroups]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      getUsers();
      getGroups();
    };
    socket.on("newMessage", refresh);
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

    return () => {
      socket.off("newMessage", refresh);
      socket.off("messagesRead", refresh);
      socket.off("groupUpdated", refresh);
      socket.off("removedFromGroup", handleRemovedFromGroup);
      socket.off("joinRequestReceived", handleJoinRequestReceived);
      socket.off("joinRequestApproved", handleJoinRequestApproved);
      socket.off("joinRequestRejected", handleJoinRequestRejected);
    };
  }, [socket, getUsers, getGroups, selectedGroup, setSelectedGroup]);

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

  return (
    <aside className="w-full h-full border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pink-600 text-white flex items-center justify-center font-bold text-sm">
            P
          </div>
          <h2 className="font-bold text-lg">PladiChat</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenDiscoverGroups}
            className="text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 transition"
            aria-label="Découvrir des groupes"
            title="Découvrir des groupes"
          >
            <Search size={20} strokeWidth={2} />
          </button>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 transition"
            aria-label="Créer un groupe"
          >
            <Plus size={22} strokeWidth={2} />
          </button>
        </div>
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

      <div
        className="custom-scrollbar flex-1 overflow-y-auto"
        onScroll={handleContactsScroll}
      >
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

        {isLoadingMoreUsers && (
          <p className="text-center text-xs text-zinc-400 py-3">
            Chargement d&apos;autres contacts...
          </p>
        )}
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
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium"
              >
                Créer
              </button>
            </div>
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
                    className="text-xs shrink-0 ml-2 px-3 py-1.5 rounded-full bg-indigo-600 text-white disabled:opacity-50 disabled:bg-zinc-400"
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
            <div className="absolute left-3 bottom-16 z-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 text-sm w-56">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="block w-full text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Changer la photo
              </button>

              <div className="relative">
                <button
                  onClick={() =>
                    setShowGlobalWallpaperMenu(!showGlobalWallpaperMenu)
                  }
                  className="w-full flex items-center gap-2 text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  <Palette size={16} strokeWidth={2} className="shrink-0" />
                  Fond d&apos;écran
                </button>
                {showGlobalWallpaperMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowGlobalWallpaperMenu(false)}
                    />
                    <div className="absolute left-full ml-2 bottom-0 z-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 text-sm w-48">
                      {WALLPAPERS.map((w) => (
                        <button
                          key={w.id}
                          onClick={() =>
                            w.id === "custom"
                              ? globalWallpaperFileInputRef.current?.click()
                              : handleGlobalWallpaperChange(w.id)
                          }
                          className={`block w-full text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition ${
                            globalWallpaper === w.id ? "font-semibold" : ""
                          }`}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <input
                  ref={globalWallpaperFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleGlobalWallpaperImageSelect}
                />
              </div>

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
                onClick={() => {
                  setShowChangePassword(true);
                  setShowProfileMenu(false);
                }}
                className="block w-full text-left px-4 py-2 text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Mot de passe
              </button>

              <button
                onClick={logout}
                className="block w-full text-left px-4 py-2 text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
              >
                Se déconnecter
              </button>

              <button
                onClick={() => {
                  setShowDeleteAccount(true);
                  setShowProfileMenu(false);
                }}
                className="block w-full text-left px-4 py-2 text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
              >
                Supprimer mon compte
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
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium"
              >
                Confirmer
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
