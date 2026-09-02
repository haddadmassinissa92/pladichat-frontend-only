"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Video, Mic, MicOff, VideoOff } from "lucide-react";
import { useCallStore } from "@/store/useCallStore";
import Avatar from "./Avatar";

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
}: {
  username: string;
  avatar?: string;
  stream: MediaStream | null;
  callType: "audio" | "video" | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (stream) {
      if (videoRef.current) videoRef.current.srcObject = stream;
      if (audioRef.current) audioRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-zinc-800 rounded-xl overflow-hidden flex items-center justify-center aspect-video">
      {callType === "video" ? (
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <audio ref={audioRef} autoPlay />
      )}
      {(callType !== "video" || !stream) && (
        <Avatar
          src={avatar}
          fallback={username?.[0]?.toUpperCase() || "?"}
          colorClass="bg-indigo-600"
          size="w-16 h-16 text-xl"
        />
      )}
      <span className="absolute bottom-2 left-2 text-xs bg-black/50 px-2 py-0.5 rounded-full">
        {username}
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
    acceptCall,
    rejectCall,
    acceptGroupCall,
    rejectGroupCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useCallStore();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(0);
  const durationRef = useRef(0);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream) {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (callStatus !== "active") {
      durationRef.current = 0;
      return;
    }
    const interval = setInterval(() => {
      durationRef.current += 1;
      setDuration(durationRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  if (callStatus === "idle") return null;
  if (callMode === "private" && !remoteUser) return null;
  if (callMode === "group" && callStatus === "ringing" && !incomingGroupCallData) return null;

  const participantList = Object.entries(participants) as [
    string,
    { username: string; avatar?: string; stream: MediaStream | null },
  ][];
  const isGroupRinging = callMode === "group" && callStatus === "ringing";

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-between text-white p-6">
      {/* --- Mode privé : flux distant en fond --- */}
      {callMode === "private" && callType === "video" && callStatus === "active" ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        callMode === "private" && <audio ref={remoteAudioRef} autoPlay />
      )}

      {/* --- En-tête --- */}
      <div className="relative z-10 flex flex-col items-center mt-12">
        {callMode === "private" && remoteUser && (
          <>
            <Avatar
              src={remoteUser.avatar}
              fallback={remoteUser.username?.[0]?.toUpperCase() || "?"}
              colorClass="bg-indigo-600"
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

      {/* --- Grille des participants, en appel de groupe actif --- */}
      {callMode === "group" && callStatus === "active" && (
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-3xl my-6 overflow-y-auto custom-scrollbar max-h-[50vh]">
          {participantList.length === 0 && (
            <p className="col-span-full text-center text-zinc-400 text-sm py-8">
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
            />
          ))}
        </div>
      )}

      {/* Miniature de la caméra locale */}
      {callType === "video" && callStatus === "active" && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute top-6 right-6 w-28 h-40 object-cover rounded-xl border-2 border-white/20 z-10"
        />
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
              onClick={endCall}
              className="bg-red-600 hover:bg-red-700 transition rounded-full w-16 h-16 flex items-center justify-center"
              aria-label={callMode === "group" ? "Quitter l'appel" : "Raccrocher"}
            >
              <PhoneOff size={26} strokeWidth={2} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
