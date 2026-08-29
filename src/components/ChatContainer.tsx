"use client";

// Type décrivant la forme d'un message tel qu'il vient du backend
type Message = {
  _id: string; // identifiant unique du message en base de données
  sender: string; // id de l'utilisateur qui a envoyé le message
  receiver: string; // id de l'utilisateur qui doit recevoir le message (conversation privée)
  text: string; // contenu texte du message (peut être vide si c'est une image/audio)
  image: string; // URL Cloudinary de l'image jointe (vide si aucune image)
  audio: string; // URL Cloudinary du message vocal (vide si aucun audio)
  status: string; // statut de lecture : "sent" (envoyé) ou "read" (lu)
  createdAt: string; // date de création du message, au format ISO
};

// Import des hooks React nécessaires pour gérer l'état et les effets de bord
import { useEffect, useRef, useState } from "react";
// Store Zustand qui gère tout ce qui concerne les conversations (messages, utilisateurs, groupes...)
import { useChatStore } from "@/store/useChatStore";
// Store Zustand qui gère l'authentification et le socket temps réel
import { useAuthStore } from "@/store/useAuthStore";
// Composant de la barre de saisie en bas de la conversation (texte, image, audio, emoji...)
import MessageInput from "@/components/MessageInput";
// Librairie pour compresser une image avant de l'envoyer, afin de réduire son poids
import imageCompression from "browser-image-compression";
// Fonctions utilitaires pour gérer le fond d'écran personnalisé de chaque conversation
import {
  WALLPAPERS,
  resolveWallpaper,
  setConversationWallpaper,
  setConversationWallpaperImage,
  clearConversationWallpaper,
} from "@/lib/wallpaper";

// Composant qui affiche une seule bulle de message (texte, image, réactions, statut...)
import MessageBubble from "./MessageBubble";

// Fonction utilitaire : transforme une date en texte lisible pour le séparateur
// affiché entre deux jours différents dans la conversation ("Aujourd'hui", "Hier", ou une date complète)
function formatDateSeparator(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  // Si le message date d'aujourd'hui, on affiche juste "Aujourd'hui"
  if (date.toDateString() === now.toDateString()) return "Aujourd'hui";
  // Si le message date d'hier, on affiche juste "Hier"
  if (date.toDateString() === yesterday.toDateString()) return "Hier";

  // Sinon on affiche la date complète (avec l'année seulement si ce n'est pas l'année en cours)
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

// Composant principal : affiche la conversation active (messages, en-tête, saisie)
export default function ChatContainer() {
  // On récupère depuis le store de chat tout ce dont on a besoin pour afficher la conversation
  const {
    selectedUser, // l'utilisateur actuellement sélectionné (conversation privée), ou null
    selectedGroup, // le groupe actuellement sélectionné, ou null
    messages, // la liste des messages de la conversation ouverte
    getMessages, // fonction pour charger les messages depuis le serveur
    markAsRead, // fonction pour marquer les messages comme lus
    isMessagesLoading, // booléen : true pendant le chargement des messages
    subscribeToMessages, // s'abonne aux événements socket liés aux messages (nouveau, lu, supprimé...)
    unsubscribeFromMessages, // se désabonne de ces événements (au démontage du composant)
    subscribeToTyping, // s'abonne aux événements socket "en train d'écrire"
    unsubscribeFromTyping, // se désabonne de ces événements
    isTyping, // booléen : true si l'autre personne est en train d'écrire
    setSelectedUser, // fonction pour changer/effacer l'utilisateur sélectionné
    setSelectedGroup, // fonction pour changer/effacer le groupe sélectionné
    deleteGroup, // fonction pour supprimer un groupe
  } = useChatStore();

  // État local : contrôle l'affichage du petit menu "⋮" (supprimer le groupe)
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  // Utilisateur connecté et socket temps réel, récupérés depuis le store d'authentification
  const { authUser, socket } = useAuthStore();
  // Référence vers un élément invisible tout en bas de la liste de messages,
  // utilisé pour faire défiler automatiquement jusqu'en bas
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Référence vers le conteneur scrollable des messages, pour lire sa position de scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Références pour détecter un geste de glissement (swipe) sur mobile
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // --- Gestion de l'indicateur "nouveaux messages" ---
  // true si l'utilisateur regarde actuellement le bas de la conversation
  const [isNearBottom, setIsNearBottom] = useState(true);
  // Nombre de nouveaux messages reçus pendant que l'utilisateur a remonté dans l'historique
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  // Mémorise le nombre de messages au dernier rendu, pour détecter une arrivée de nouveaux messages
  const previousMessagesLength = useRef(0);

  // Identifiant de la conversation actuelle (celui du groupe ou de l'utilisateur sélectionné)
  const conversationId = selectedGroup?._id || selectedUser?._id || null;

  // --- Gestion du fond d'écran spécifique à cette conversation ---
  const [wallpaper, setWallpaper] = useState("default");
  const [customWallpaper, setCustomWallpaper] = useState<string | null>(null);
  const [showWallpaperMenu, setShowWallpaperMenu] = useState(false);
  // Référence vers l'input de fichier caché, utilisé pour choisir une image de fond personnalisée
  const wallpaperFileInputRef = useRef<HTMLInputElement>(null);

  // Résout quel fond d'écran doit être affiché : celui propre à cette conversation
  // s'il existe, sinon le fond par défaut global choisi dans le profil
  const resolvedConversationWallpaper = conversationId
    ? resolveWallpaper(conversationId)
    : { id: wallpaper, image: customWallpaper };
  const activeWallpaper = resolvedConversationWallpaper.id;
  const activeCustomWallpaper = resolvedConversationWallpaper.image;

  // Change le fond d'écran de la conversation actuelle et l'enregistre en local (localStorage)
  const handleWallpaperChange = (id: string) => {
    if (!conversationId) return;
    setWallpaper(id);
    setConversationWallpaper(conversationId, id);
    setShowWallpaperMenu(false);
  };

  // Gère la sélection d'une image personnalisée comme fond d'écran :
  // compresse l'image, la convertit en base64, puis la sauvegarde
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

  // Retire le fond d'écran spécifique à cette conversation pour revenir au fond par défaut
  const handleResetWallpaper = () => {
    if (!conversationId) return;
    clearConversationWallpaper(conversationId);
    const resolved = resolveWallpaper(conversationId);
    setWallpaper(resolved.id);
    setCustomWallpaper(resolved.image);
    setShowWallpaperMenu(false);
  };

  // Effet : à chaque fois que la conversation sélectionnée change (utilisateur ou groupe),
  // on va chercher les messages correspondants et on les marque comme lus
  useEffect(() => {
    if (selectedUser) {
      getMessages(selectedUser._id, false);
      markAsRead(selectedUser._id, false);
    } else if (selectedGroup) {
      getMessages(selectedGroup._id, true);
      markAsRead(selectedGroup._id, true);
    }
  }, [selectedUser, selectedGroup, getMessages, markAsRead]);

  // Effet : à chaque changement de conversation, on réinitialise l'indicateur
  // de nouveaux messages et on considère qu'on repart du bas de la conversation.
  // On dépend des identifiants (._id) plutôt que des objets entiers, pour éviter
  // un déclenchement inutile si l'objet est recréé sans que la conversation change vraiment.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setNewMessagesCount(0);
    setIsNearBottom(true);
    previousMessagesLength.current = 0;
  }, [selectedUser?._id, selectedGroup?._id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Effet : s'abonne aux événements socket liés aux messages (nouveaux messages,
  // messages lus, supprimés, modifiés...) dès que la conversation ou le socket change,
  // et se désabonne proprement quand ce n'est plus nécessaire (nettoyage)
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

  // Fonction appelée à chaque défilement dans la liste de messages.
  // Calcule la distance (en pixels) entre le bas visible et le vrai bas du contenu,
  // pour savoir si l'utilisateur regarde la fin de la conversation ou remonte dans l'historique.
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    // On considère qu'on est "en bas" si on est à moins de 100px du vrai bas
    const nearBottom = distanceFromBottom < 100;
    setIsNearBottom(nearBottom);
    // Si on est revenu en bas, on efface le compteur de nouveaux messages
    if (nearBottom) setNewMessagesCount(0);
  };

  // Fait défiler la conversation jusqu'en bas (appelé au clic sur l'indicateur
  // "nouveaux messages"), puis remet le compteur à zéro
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setNewMessagesCount(0);
  };

  // Effet déclenché à chaque changement de la liste des messages :
  // - si l'utilisateur est déjà en bas, on fait défiler automatiquement vers le nouveau message
  // - sinon (l'utilisateur a remonté dans l'historique), on incrémente juste le compteur
  //   de nouveaux messages, mais seulement si ce n'est pas nous-même qui avons écrit
  useEffect(() => {
    // A-t-on reçu de nouveaux messages depuis le dernier passage dans cet effet ?
    const newMessagesArrived = messages.length > previousMessagesLength.current;

    if (newMessagesArrived) {
      if (isNearBottom) {
        // On est déjà en bas : on fait défiler automatiquement, avec un léger délai
        // pour laisser le temps au DOM de se mettre à jour avant de scroller
        const timeout = setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
        previousMessagesLength.current = messages.length;
        return () => clearTimeout(timeout);
      } else {
        // On a remonté dans l'historique : on regarde qui a envoyé le dernier message
        const lastMessage = messages[messages.length - 1];
        const isMine = lastMessage?.sender === authUser?._id;
        // On n'affiche l'indicateur que si le message vient de quelqu'un d'autre
        // (pas la peine de se notifier soi-même de son propre message)
        if (!isMine) {
          // On calcule l'incrément AVANT d'appeler setNewMessagesCount : comme
          // previousMessagesLength.current va être modifié juste après (ligne plus bas),
          // et que la fonction passée à setNewMessagesCount peut être exécutée par React
          // un peu plus tard, il faut figer la valeur de l'incrément maintenant pour
          // éviter de calculer "messages.length - messages.length = 0" par erreur.
          const increment = messages.length - previousMessagesLength.current;
          setNewMessagesCount((count) => count + increment);
        }
      }
    }
    // Dans tous les cas, on mémorise la nouvelle longueur pour la comparaison suivante
    previousMessagesLength.current = messages.length;
  }, [messages, authUser, isNearBottom]);

  // Effet : quand l'indicateur "en train d'écrire" apparaît, on fait défiler vers le bas
  // uniquement si l'utilisateur était déjà en train de regarder le bas de la conversation
  useEffect(() => {
    if (isNearBottom) {
      const timeout = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isTyping, isNearBottom]);

  // Effet : s'abonne/désabonne aux événements socket "en train d'écrire"
  // pour l'utilisateur actuellement sélectionné
  useEffect(() => {
    subscribeToTyping();
    return () => unsubscribeFromTyping();
  }, [selectedUser, socket, subscribeToTyping, unsubscribeFromTyping]);

  // Gère le début d'un geste de glissement tactile (swipe), utilisé sur mobile
  // pour revenir à la liste des conversations en glissant vers la droite
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  // Gère la fin du geste de glissement : si la distance parcourue est suffisante,
  // on referme la conversation actuelle pour revenir à la liste (comportement mobile)
  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const distance = touchEndX.current - touchStartX.current;

    if (distance > 100) {
      setSelectedUser(null);
      setSelectedGroup(null);
    }
  };

  // Si aucune conversation n'est sélectionnée, on affiche un simple message d'invite
  // à la place de toute l'interface de conversation
  if (!selectedUser && !selectedGroup) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-400">
        Sélectionne une conversation pour commencer
      </div>
    );
  }

  // --- Rendu principal de la conversation ---
  return (
    // Conteneur global de la conversation : prend toute la hauteur disponible,
    // organisé verticalement (en-tête / messages / saisie), et écoute les gestes tactiles
    <div
      className="h-full flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* --- En-tête de la conversation --- */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
        {/* Bouton retour, visible uniquement sur mobile (caché à partir de la taille "sm") */}
        <button
          onClick={() => {
            setSelectedUser(null);
            setSelectedGroup(null);
          }}
          className="sm:hidden p-1 -ml-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          aria-label="Retour"
        >
          {/* Icône flèche vers la gauche, dessinée en SVG */}
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

        {/* Nom de la conversation : nom du groupe, ou pseudo de l'utilisateur */}
        <h2 className="font-bold flex-1">
          {selectedGroup ? selectedGroup.name : selectedUser?.username}
        </h2>

        {/* Bouton pour ouvrir le menu de choix du fond d'écran de cette conversation */}
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
              {/* Zone invisible qui couvre tout l'écran : cliquer dessus ferme le menu */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowWallpaperMenu(false)}
              />
              {/* Menu déroulant avec la liste des fonds disponibles */}
              <div className="absolute right-0 z-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 text-sm w-52">
                <div className="px-4 py-1 text-xs text-zinc-400 uppercase">
                  Fond de cette discussion
                </div>
                {/* On affiche un bouton par fond d'écran disponible */}
                {WALLPAPERS.map((w) => (
                  <button
                    key={w.id}
                    onClick={() =>
                      // Le fond "custom" ouvre le sélecteur de fichier au lieu de s'appliquer directement
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
          {/* Input de fichier caché, déclenché par le bouton "Image personnalisée" */}
          <input
            ref={wallpaperFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleWallpaperImageSelect}
          />
        </div>

        {/* Menu "⋮" pour supprimer le groupe, visible uniquement si on est dans un groupe
            ET qu'on en est le créateur */}
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

      {/* --- Zone des messages --- */}
      {/* Conteneur "relative" pour pouvoir positionner l'indicateur de nouveaux messages
          par-dessus la liste, sans qu'il défile avec elle */}
      <div className="relative flex-1 min-h-0">
        {/* Conteneur scrollable qui contient tous les messages, avec le fond d'écran choisi */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className={`h-full overflow-y-auto p-4 flex flex-col gap-3 ${
            WALLPAPERS.find((w) => w.id === activeWallpaper)?.className || ""
          }`}
          style={
            // Si le fond choisi est une image personnalisée, on l'applique en style inline
            activeWallpaper === "custom" && activeCustomWallpaper
              ? {
                  backgroundImage: `url(${activeCustomWallpaper})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          {/* Message de chargement pendant que les messages arrivent du serveur */}
          {isMessagesLoading && (
            <p className="text-center text-sm text-zinc-400">Chargement...</p>
          )}

          {/* On parcourt tous les messages de la conversation pour les afficher un par un */}
          {messages.map((msg: Message, index: number) => {
            // Est-ce que ce message a été envoyé par l'utilisateur connecté ?
            const isMine = msg.sender === authUser?._id;
            // Dans un groupe, on cherche le pseudo de l'expéditeur pour l'afficher au-dessus du message
            const senderName = selectedGroup
              ? selectedGroup.members.find(
                  (m: { _id: string; username: string }) => m._id === msg.sender,
                )?.username
              : undefined;

            // On compare avec le message précédent pour savoir s'il faut afficher
            // un séparateur de date (si on change de jour)
            const previousMsg = messages[index - 1];
            const showDateSeparator =
              !previousMsg ||
              new Date(previousMsg.createdAt).toDateString() !==
                new Date(msg.createdAt).toDateString();

            return (
              <div key={msg._id}>
                {/* Séparateur de date, affiché seulement quand on change de jour */}
                {showDateSeparator && (
                  <div className="flex justify-center my-3">
                    <span className="text-xs font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded-full px-3 py-1">
                      {formatDateSeparator(msg.createdAt)}
                    </span>
                  </div>
                )}
                {/* La bulle de message elle-même, avec toute sa logique (réactions, menu...) */}
                <MessageBubble
                  msg={msg}
                  isMine={isMine}
                  senderName={senderName}
                  // isLast sert à savoir si on doit afficher "Vu à HH:MM" sous ce message
                  isLast={index === messages.length - 1}
                />
              </div>
            );
          })}

          {/* Indicateur "en train d'écrire..." (trois petits points animés),
              affiché quand le contact tape un message */}
          {isTyping && (
            <div className="max-w-xs px-4 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 self-start flex gap-1 items-center">
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
            </div>
          )}

          {/* Élément invisible tout en bas, utilisé comme cible pour le défilement automatique */}
          <div ref={messagesEndRef} />
        </div>

        {/* Bouton flottant "nouveaux messages", affiché seulement si le compteur est supérieur à 0.
            Sur mobile (en dessous de "sm"), seule la flèche est visible dans un rond ;
            à partir de "sm", le texte apparaît aussi à côté de la flèche. */}
        {newMessagesCount > 0 && (
          <button
            onClick={scrollToBottom}
            aria-label="Aller aux nouveaux messages"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white shadow-lg flex items-center gap-2 rounded-full sm:px-4 sm:py-2 w-10 h-10 sm:w-auto sm:h-auto justify-center"
          >
            {/* Flèche vers le bas, dessinée en SVG (chevron) */}
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
            {/* Texte du compteur, masqué sur mobile grâce à "hidden sm:inline" */}
            <span className="hidden sm:inline text-sm font-medium">
              {newMessagesCount} nouveau{newMessagesCount > 1 ? "x" : ""} message
              {newMessagesCount > 1 ? "s" : ""}
            </span>
          </button>
        )}
      </div>

      {/* --- Barre de saisie du message, tout en bas --- */}
      <MessageInput />
    </div>
  );
}
