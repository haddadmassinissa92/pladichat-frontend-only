"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Phone, PhoneOff, Video, Mic, MicOff, VideoOff, UserPlus } from "lucide-react";
import { useCallStore } from "@/store/useCallStore";
import { useChatStore } from "@/store/useChatStore";
import Avatar from "./Avatar";
import { getRingtoneFile } from "@/lib/ringtone";

type SimpleUser = { _id: string; username: string; avatar?: string };

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Une tuile vidéo/audio pour un participant d'appel de groupe
function ParticipantTile({
  username,
  avatar,
  stream,
  callType,
  cameraOff,
}: {
  username: string;
  avatar?: string;
  stream: MediaStream | null;
  callType: "audio" | "video" | null;
  cameraOff?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [needsTap, setNeedsTap] = useState(false);

  useEffect(() => {
    if (stream) {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => setNeedsTap(true));
      }
      if (audioRef.current) {
        audioRef.current.srcObject = stream;
        audioRef.current.play().catch(() => setNeedsTap(true));
      }
    }
  }, [stream]);

  const handleTap = () => {
    videoRef.current?.play().catch(() => {});
    audioRef.current?.play().catch(() => {});
    setNeedsTap(false);
  };

  return (
    <div className="relative w-full h-full min-h-[120px] bg-zinc-800 rounded-xl overflow-hidden flex items-center justify-center">
      {callType === "video" ? (
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <audio ref={audioRef} autoPlay />
      )}
      {(callType !== "video" || !stream || cameraOff) && (
        <Avatar
          src={avatar}
          fallback={username?.[0]?.toUpperCase() || "?"}
          colorClass="bg-accent-600"
          size="w-16 h-16 text-xl"
        />
      )}
      {needsTap && (
        <button
          onClick={handleTap}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 text-white text-xs"
        >
          Appuie pour activer
        </button>
      )}
      <span className="absolute bottom-2 left-2 text-xs bg-black/50 px-2 py-0.5 rounded-full">
        {username}
        {cameraOff && callType === "video" && " · caméra coupée"}
      </span>
    </div>
  );
}

export default function CallModal() {
  const {
    callStatus,
    callMode,
    callType,
    remoteUser,
    groupName,
    localStream,
    remoteStream,
    participants,
    incomingGroupCallData,
    isMuted,
    isCameraOff,
    remoteCameraOff,
    acceptCall,
    rejectCall,
    acceptGroupCall,
    rejectGroupCall,
    endCall,
    toggleMute,
    toggleCamera,
    addParticipantsToCall,
  } = useCallStore();

  const { users } = useChatStore();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRingingRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const ringtoneRef = useRef<HTMLAudioElement>(null);
  const durationRef = useRef(0);
  const [duration, setDuration] = useState(0);

  // Modale d'ajout de participant(s) en cours d'appel
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [selectedNewUsers, setSelectedNewUsers] = useState<SimpleUser[]>([]);

  // Sur mobile, les navigateurs bloquent souvent la lecture automatique
  // d'une vidéo AVEC son (contrairement à une vidéo "muted"), même avec
  // l'attribut autoplay — ce qui se traduit par un écran noir silencieux,
  // sans erreur visible. On tente une lecture explicite, et si ça échoue,
  // on affiche un bouton "Appuie pour activer" (un clic est un vrai geste
  // utilisateur, qui débloque la lecture à coup sûr).
  const [needsTapToPlay, setNeedsTapToPlay] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (callStatus === "idle") setNeedsTapToPlay(false);
  }, [callStatus]);

  // Vignette de ma propre caméra, déplaçable n'importe où sur l'écran
  // d'appel (souris ou doigt), en appel privé comme en appel de groupe
  const pipRef = useRef<HTMLDivElement>(null);
  const [pipPos, setPipPos] = useState<{ left: number; top: number } | null>(null);
  const dragData = useRef<{ startX: number; startY: number; origLeft: number; origTop: number } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (callStatus === "idle") setPipPos(null);
  }, [callStatus]);

  const handlePipPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = pipRef.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const elRect = el.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    dragData.current = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: elRect.left - parentRect.left,
      origTop: elRect.top - parentRect.top,
    };
    el.setPointerCapture(e.pointerId);
  };

  const handlePipPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragData.current) return;
    const el = pipRef.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const dx = e.clientX - dragData.current.startX;
    const dy = e.clientY - dragData.current.startY;
    const maxLeft = parent.clientWidth - el.offsetWidth;
    const maxTop = parent.clientHeight - el.offsetHeight;
    setPipPos({
      left: Math.min(Math.max(dragData.current.origLeft + dx, 0), Math.max(maxLeft, 0)),
      top: Math.min(Math.max(dragData.current.origTop + dy, 0), Math.max(maxTop, 0)),
    });
  };

  const handlePipPointerUp = () => {
    dragData.current = null;
  };

  const handleTapToPlay = () => {
    remoteVideoRef.current?.play().catch(() => {});
    remoteAudioRef.current?.play().catch(() => {});
    setNeedsTapToPlay(false);
  };

  useEffect(() => {
    if (localStream) {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch(() => {});
      }
      if (localVideoRingingRef.current) {
        localVideoRingingRef.current.srcObject = localStream;
        localVideoRingingRef.current.play().catch(() => {});
      }
    }
  }, [localStream, callStatus]);

  useEffect(() => {
    if (remoteStream) {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => setNeedsTapToPlay(true));
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(() => setNeedsTapToPlay(true));
      }
    }
  }, [remoteStream, callStatus]);

  useEffect(() => {
    if (callStatus !== "active") {
      durationRef.current = 0;
      const resetTimeout = setTimeout(() => setDuration(0), 0);
      return () => clearTimeout(resetTimeout);
    }
    const interval = setInterval(() => {
      durationRef.current += 1;
      setDuration(durationRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  // Joue la sonnerie en boucle tant que ça sonne, et l'arrête dès que
  // l'appel démarre ou se termine
  useEffect(() => {
    const audio = ringtoneRef.current;
    if (!audio) return;

    if (callStatus === "calling" || callStatus === "ringing") {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [callStatus]);

  const showModal =
    callStatus !== "idle" &&
    !(callMode === "private" && !remoteUser) &&
    !(callMode === "group" && callStatus === "ringing" && !incomingGroupCallData);

  // Téléporté directement dans <body> via un portail (voir plus bas) : la
  // page a des conteneurs animés (transform CSS, pour le glissement
  // sidebar/chat sur mobile), ce qui casse le "position: fixed" de la
  // modale d'appel si elle reste dans cette hiérarchie — elle se comportait
  // alors comme encastrée dans la page au lieu de couvrir tout l'écran
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const participantList = Object.entries(participants) as [
    string,
    { username: string; avatar?: string; stream: MediaStream | null; cameraOff?: boolean },
  ][];
  const isGroupRinging = callMode === "group" && callStatus === "ringing";

  // Contacts pas déjà dans l'appel, disponibles pour être ajoutés
  const alreadyInCallIds = new Set([
    ...(remoteUser ? [remoteUser._id] : []),
    ...Object.keys(participants),
  ]);
  const availableToAdd = users.filter((u: SimpleUser) => !alreadyInCallIds.has(u._id));

  const toggleNewUser = (user: SimpleUser) => {
    setSelectedNewUsers((prev) =>
      prev.some((u) => u._id === user._id)
        ? prev.filter((u) => u._id !== user._id)
        : [...prev, user],
    );
  };

  const handleConfirmAddParticipants = () => {
    if (selectedNewUsers.length === 0) return;
    addParticipantsToCall(selectedNewUsers);
    setShowAddParticipant(false);
    setSelectedNewUsers([]);
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Sonnerie, toujours montée pour pouvoir démarrer dès que le statut change */}
      <audio ref={ringtoneRef} src={getRingtoneFile()} loop />

      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center sm:p-6">
          <div className="relative bg-zinc-950 text-white w-full h-full sm:h-[85vh] sm:max-w-3xl sm:rounded-3xl overflow-hidden flex flex-col items-center justify-between p-6">
          {/* --- Mode privé, appel actif : flux distant en fond --- */}
          {callMode === "private" && callType === "video" && callStatus === "active" ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : callMode === "private" && callType === "video" && callStatus === "calling" ? (
            /* --- Mode privé, ça sonne encore : pas de flux distant pour
                l'instant, on montre sa propre caméra en grand en
                attendant (comme WhatsApp) --- */
            <video
              ref={localVideoRingingRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            callMode === "private" && <audio ref={remoteAudioRef} autoPlay />
          )}

          {/* --- La personne en face a coupé SA caméra : on affiche son
              avatar par-dessus le fond noir, plutôt qu'un écran noir sans
              explication (l'audio continue de fonctionner normalement) --- */}
          {callMode === "private" &&
            callType === "video" &&
            callStatus === "active" &&
            remoteCameraOff && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-900">
                <Avatar
                  src={remoteUser?.avatar}
                  fallback={remoteUser?.username?.[0]?.toUpperCase() || "?"}
                  colorClass="bg-accent-600"
                  size="w-28 h-28 text-4xl"
                />
                <p className="text-sm text-zinc-400">
                  {remoteUser?.username} a coupé sa caméra
                </p>
              </div>
            )}

          {/* --- La lecture automatique du flux distant a été bloquée par
              le navigateur (fréquent sur mobile) : on demande un tap
              explicite, qui débloque la lecture à coup sûr --- */}
          {needsTapToPlay && (
            <button
              onClick={handleTapToPlay}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 text-white"
            >
              <Video size={40} strokeWidth={1.5} />
              <p className="text-sm font-medium">Appuie pour activer l&apos;appel</p>
            </button>
          )}

          {/* --- En-tête --- */}
          <div className="relative z-10 flex flex-col items-center mt-12">
            {callMode === "private" && remoteUser && (
              <>
                <Avatar
                  src={remoteUser.avatar}
                  fallback={remoteUser.username?.[0]?.toUpperCase() || "?"}
                  colorClass="bg-accent-600"
                  size="w-24 h-24 text-3xl"
                />
                <h2 className="text-xl font-bold mt-4">{remoteUser.username}</h2>
              </>
            )}

            {isGroupRinging && incomingGroupCallData && (
              <>
                <Avatar
                  src={incomingGroupCallData.callerAvatar}
                  fallback={incomingGroupCallData.callerName?.[0]?.toUpperCase() || "?"}
                  colorClass="bg-emerald-600"
                  size="w-24 h-24 text-3xl"
                />
                <h2 className="text-xl font-bold mt-4">
                  {incomingGroupCallData.callerName} appelle le groupe
                </h2>
              </>
            )}

            {callMode === "group" && callStatus === "active" && (
              <h2 className="text-xl font-bold">{groupName || "Appel de groupe"}</h2>
            )}

            <p className="text-sm text-zinc-300 mt-1">
              {callStatus === "calling" && "Appel en cours..."}
              {callMode === "private" &&
                callStatus === "ringing" &&
                `Appel ${callType === "video" ? "vidéo" : "audio"} entrant...`}
              {isGroupRinging &&
                `Appel de groupe ${callType === "video" ? "vidéo" : "audio"} entrant...`}
              {callStatus === "active" && callMode === "private" && formatDuration(duration)}
              {callStatus === "active" &&
                callMode === "group" &&
                `${formatDuration(duration)} · ${participantList.length + 1} participant${
                  participantList.length > 0 ? "s" : ""
                }`}
            </p>
          </div>

          {/* --- Grille des participants, en appel de groupe actif : 2
              colonnes fixes (2x2 pour 4 personnes, 2+1 pour 3...), grande
              sur desktop, plus petite mais même disposition sur mobile --- */}
          {callMode === "group" && callStatus === "active" && (
            <div className="relative z-10 grid grid-cols-2 auto-rows-fr gap-3 w-full max-w-3xl my-6 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              {participantList.length === 0 && (
                <p className="col-span-2 text-center text-zinc-400 text-sm py-8">
                  En attente que d&apos;autres personnes rejoignent...
                </p>
              )}
              {participantList.map(([userId, p]) => (
                <ParticipantTile
                  key={userId}
                  username={p.username}
                  avatar={p.avatar}
                  stream={p.stream}
                  callType={callType}
                  cameraOff={p.cameraOff}
                />
              ))}
            </div>
          )}

          {/* Miniature de ma propre caméra, déplaçable à la souris ou au doigt */}
          {callType === "video" && callStatus === "active" && (
            <div
              ref={pipRef}
              onPointerDown={handlePipPointerDown}
              onPointerMove={handlePipPointerMove}
              onPointerUp={handlePipPointerUp}
              onPointerCancel={handlePipPointerUp}
              style={pipPos ? { left: pipPos.left, top: pipPos.top, right: "auto" } : undefined}
              className={`absolute top-6 right-6 rounded-xl border-2 border-white/20 z-20 cursor-grab active:cursor-grabbing touch-none overflow-hidden ${
                callMode === "group" ? "w-20 h-28" : "w-28 h-40"
              }`}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover pointer-events-none"
              />
            </div>
          )}

          {/* --- Contrôles --- */}
          <div className="relative z-10 flex items-center gap-6 mb-8">
            {callStatus === "ringing" && callMode === "private" && (
              <>
                <button
                  onClick={rejectCall}
                  className="bg-red-600 hover:bg-red-700 transition rounded-full w-16 h-16 flex items-center justify-center"
                  aria-label="Refuser"
                >
                  <PhoneOff size={26} strokeWidth={2} />
                </button>
                <button
                  onClick={acceptCall}
                  className="bg-emerald-600 hover:bg-emerald-700 transition rounded-full w-16 h-16 flex items-center justify-center"
                  aria-label="Accepter"
                >
                  <Phone size={26} strokeWidth={2} />
                </button>
              </>
            )}

            {isGroupRinging && (
              <>
                <button
                  onClick={rejectGroupCall}
                  className="bg-red-600 hover:bg-red-700 transition rounded-full w-16 h-16 flex items-center justify-center"
                  aria-label="Refuser"
                >
                  <PhoneOff size={26} strokeWidth={2} />
                </button>
                <button
                  onClick={acceptGroupCall}
                  className="bg-emerald-600 hover:bg-emerald-700 transition rounded-full w-16 h-16 flex items-center justify-center"
                  aria-label="Rejoindre"
                >
                  <Phone size={26} strokeWidth={2} />
                </button>
              </>
            )}

            {callStatus === "calling" && (
              <button
                onClick={endCall}
                className="bg-red-600 hover:bg-red-700 transition rounded-full w-16 h-16 flex items-center justify-center"
                aria-label="Annuler l'appel"
              >
                <PhoneOff size={26} strokeWidth={2} />
              </button>
            )}

            {callStatus === "active" && (
              <>
                <button
                  onClick={toggleMute}
                  className={`rounded-full w-14 h-14 flex items-center justify-center transition ${
                    isMuted ? "bg-white text-black" : "bg-white/20 hover:bg-white/30"
                  }`}
                  aria-label="Couper/réactiver le micro"
                >
                  {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>

                {callType === "video" && (
                  <button
                    onClick={toggleCamera}
                    className={`rounded-full w-14 h-14 flex items-center justify-center transition ${
                      isCameraOff ? "bg-white text-black" : "bg-white/20 hover:bg-white/30"
                    }`}
                    aria-label="Couper/réactiver la caméra"
                  >
                    {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
                  </button>
                )}

                <button
                  onClick={() => setShowAddParticipant(true)}
                  className="bg-white/20 hover:bg-white/30 transition rounded-full w-14 h-14 flex items-center justify-center"
                  aria-label="Ajouter un participant"
                >
                  <UserPlus size={22} />
                </button>

                <button
                  onClick={endCall}
                  className="bg-red-600 hover:bg-red-700 transition rounded-full w-16 h-16 flex items-center justify-center"
                  aria-label={callMode === "group" ? "Quitter l'appel" : "Raccrocher"}
                >
                  <PhoneOff size={26} strokeWidth={2} />
                </button>
              </>
            )}
          </div>

          {/* Modale : ajouter un ou plusieurs participants à l'appel en cours */}
          {showAddParticipant && (
            <div
              className="absolute inset-0 bg-black/70 flex items-center justify-center z-20 p-4"
              onClick={() => setShowAddParticipant(false)}
            >
              <div
                className="bg-white dark:bg-zinc-900 text-black dark:text-white rounded-2xl p-4 w-full max-w-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-bold mb-3">Ajouter à l&apos;appel</h3>
                <div className="custom-scrollbar max-h-56 overflow-y-auto mb-3">
                  {availableToAdd.length === 0 && (
                    <p className="text-sm text-zinc-400">
                      Tous tes contacts sont déjà dans cet appel.
                    </p>
                  )}
                  {availableToAdd.map((user: SimpleUser) => (
                    <label key={user._id} className="flex items-center gap-2 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedNewUsers.some((u) => u._id === user._id)}
                        onChange={() => toggleNewUser(user)}
                      />
                      {user.username}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowAddParticipant(false);
                      setSelectedNewUsers([]);
                    }}
                    className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 text-sm"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmAddParticipants}
                    disabled={selectedNewUsers.length === 0}
                    className="flex-1 bg-accent-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
                  >
                    Ajouter ({selectedNewUsers.length})
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
