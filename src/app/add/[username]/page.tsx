"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { useChatStore } from "@/store/useChatStore";
import Avatar from "@/components/Avatar";

type LookedUpUser = { _id: string; username: string; avatar?: string };

export default function AddContactByUsernamePage() {
  const params = useParams<{ username: string }>();
  const authUser = useAuthStore((state) => state.authUser);
  const isCheckingAuth = useAuthStore((state) => state.isCheckingAuth);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const lookupUserByUsername = useChatStore((state) => state.lookupUserByUsername);
  const addContact = useChatStore((state) => state.addContact);

  const [status, setStatus] = useState<"loading" | "found" | "not-found" | "self">("loading");
  const [foundUser, setFoundUser] = useState<LookedUpUser | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [requestError, setRequestError] = useState("");

  // Cette page peut être ouverte directement via un lien partagé, sans être
  // passé par la page principale (app/page.tsx) qui déclenche normalement
  // cette vérification — sans ça, isCheckingAuth reste bloqué à "true" et
  // la page ne sort jamais de son état de chargement
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isCheckingAuth || !authUser) return;

    const run = async () => {
      if (params.username === authUser.username) {
        setStatus("self");
        return;
      }
      const result = await lookupUserByUsername(params.username);
      if (result.success && result.user) {
        setFoundUser(result.user);
        setStatus("found");
      } else {
        setStatus("not-found");
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, isCheckingAuth, params.username]);

  const handleAdd = async () => {
    if (!foundUser) return;
    const result = await addContact(foundUser._id);
    if (result.success) {
      setRequestSent(true);
    } else {
      setRequestError(result.message || "Erreur");
    }
  };

  // Pas encore connecté : on invite à se connecter, puis à revenir sur ce
  // même lien une fois connecté (plus simple qu'une redirection automatique)
  if (!isCheckingAuth && !authUser) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm text-center flex flex-col gap-4">
          <h1 className="text-xl font-bold">
            Connecte-toi pour ajouter {params.username}
          </h1>
          <p className="text-sm text-zinc-500">
            Une fois connecté, reviens sur ce lien pour l&apos;ajouter à tes
            contacts.
          </p>
          <Link
            href="/login"
            className="bg-indigo-600 text-white rounded-lg py-3 font-medium hover:bg-indigo-700 transition"
          >
            Se connecter
          </Link>
          <Link href="/signup" className="text-indigo-600 font-medium text-sm">
            Créer un compte
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm text-center flex flex-col items-center gap-4">
        {(status === "loading" || isCheckingAuth) && (
          <p className="text-zinc-500">Recherche...</p>
        )}

        {status === "self" && (
          <p className="text-zinc-500">C&apos;est ton propre lien de profil 🙂</p>
        )}

        {status === "not-found" && (
          <>
            <h1 className="text-xl font-bold">Aucun compte trouvé</h1>
            <p className="text-sm text-zinc-500">
              Il n&apos;existe pas de compte PladiChat avec le nom «
              {params.username} ».
            </p>
          </>
        )}

        {status === "found" && foundUser && (
          <>
            <Avatar
              src={foundUser.avatar}
              fallback={foundUser.username[0]?.toUpperCase()}
              colorClass="bg-indigo-600"
              size="w-24 h-24 text-3xl"
            />
            <h1 className="text-xl font-bold">{foundUser.username}</h1>

            {requestSent ? (
              <p className="text-sm text-zinc-500">
                Demande envoyée ! {foundUser.username} doit encore
                l&apos;accepter.
              </p>
            ) : (
              <button
                onClick={handleAdd}
                className="bg-indigo-600 text-white rounded-lg px-6 py-3 font-medium hover:bg-indigo-700 transition"
              >
                Ajouter en contact
              </button>
            )}
            {requestError && (
              <p className="text-sm text-red-600">{requestError}</p>
            )}
          </>
        )}

        <Link href="/" className="text-indigo-600 font-medium text-sm mt-4">
          Retour à PladiChat
        </Link>
      </div>
    </div>
  );
}
