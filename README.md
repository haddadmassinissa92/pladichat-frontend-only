# PladiChat — Frontend

Next.js frontend for [PladiChat](https://pladine-chat.vercel.app), a real-time WhatsApp/Messenger-style chat application.

**Live demo:** https://pladine-chat.vercel.app
**Backend repo:** https://github.com/haddadmassinissa92/pladine-chat

> The backend runs on Render's free tier, which sleeps after inactivity — the first request after a while may take 30–60 seconds.

---

## 🇬🇧 English

### Features

- Real-time private and group messaging (Socket.io)
- Text, image, and voice messages (recorded and compressed client-side)
- Emoji reactions, replies, editing, and deletion (with confirmation)
- Read receipts, typing indicators, and online/offline status
- Automatic link previews when a message contains a URL
- Full-text search across a conversation's history, with highlighting and next/previous navigation
- Infinite scroll pagination for message history
- Groups: rename, add/remove members, per-member blocking, discoverable groups with join requests
- Contact/Group info panel (WhatsApp-style) with shared media gallery
- Per-conversation and global custom wallpapers, dark mode
- Contact blocking, avatar upload, password change, account deletion

### Tech stack

Next.js 15, React 19, TypeScript, Zustand, Tailwind CSS v4, Socket.io-client, lucide-react

### Getting started

```bash
git clone https://github.com/haddadmassinissa92/pladichat-frontend-only.git
cd pladichat-frontend-only
npm install
npm run dev
```

Create a `.env.local` file with:
```
NEXT_PUBLIC_API_URL=http://localhost:5001/api
```
(point it at your running backend — see the [backend repo](https://github.com/haddadmassinissa92/pladine-chat) to set that up).

### Project structure

```
src/
├── app/               # Next.js pages (login, signup, main chat page)
├── components/        # UI components (ChatContainer, Sidebar, MessageInput, etc.)
├── store/             # Zustand stores (auth, chat)
└── lib/               # Utilities (axios instance, wallpaper helpers)
```

---

## 🇫🇷 Français

### Fonctionnalités

- Messagerie privée et de groupe en temps réel (Socket.io)
- Messages texte, image et vocaux (enregistrés et compressés côté client)
- Réactions emoji, réponses, modification et suppression (avec confirmation)
- Accusés de lecture, indicateur de saisie, statut en ligne/hors ligne
- Aperçu automatique des liens quand un message contient une URL
- Recherche dans tout l'historique d'une conversation, avec mise en évidence et navigation précédent/suivant
- Pagination par défilement infini de l'historique des messages
- Groupes : renommage, ajout/retrait de membres, blocage par membre, groupes découvrables avec demandes d'adhésion
- Fiche contact/groupe façon WhatsApp avec galerie de médias partagés
- Fonds d'écran personnalisés (par conversation et global), mode sombre
- Blocage de contact, changement d'avatar, de mot de passe, suppression de compte

### Stack technique

Next.js 15, React 19, TypeScript, Zustand, Tailwind CSS v4, Socket.io-client, lucide-react

### Installation

```bash
git clone https://github.com/haddadmassinissa92/pladichat-frontend-only.git
cd pladichat-frontend-only
npm install
npm run dev
```

Crée un fichier `.env.local` avec :
```
NEXT_PUBLIC_API_URL=http://localhost:5001/api
```
(pointe vers ton backend en cours d'exécution — voir le [dépôt backend](https://github.com/haddadmassinissa92/pladine-chat) pour le configurer).

### Structure du projet

```
src/
├── app/               # Pages Next.js (connexion, inscription, page principale du chat)
├── components/        # Composants d'interface (ChatContainer, Sidebar, MessageInput, etc.)
├── store/             # Stores Zustand (authentification, chat)
└── lib/               # Utilitaires (instance axios, gestion des fonds d'écran)
```
