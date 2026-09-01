"use client";

import { useState, useRef } from "react";
import { useChatStore } from "@/store/useChatStore";
import { useAuthStore } from "@/store/useAuthStore";
import imageCompression from "browser-image-compression";
import Image from "next/image";
import { Image as ImageIcon, Mic } from "lucide-react";

export default function MessageInput() {
  // etats pour la gestion des messages, les images, la saisie et l'envoi
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // etats pour la gestion des messages, modification, suppression et réponse
  const sendMessage = useChatStore((state) => state.sendMessage);
  const selectedUser = useChatStore((state) => state.selectedUser);
  const replyingTo = useChatStore((state) => state.replyingTo);
  const setReplyingTo = useChatStore((state) => state.setReplyingTo);

  // etats pour la gestion d'authentication
  const { authUser, socket } = useAuthStore();
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // etats pour la gestion de l'audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);

    if (!socket || !selectedUser) return;

    socket.emit("typing", {
      receiverId: selectedUser._id,
      senderId: authUser?._id,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stopTyping", {
        receiverId: selectedUser._id,
        senderId: authUser?._id,
      });
    }, 1500);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      });

      setImageFile(compressedFile);
      console.log(
        "Taille après compression:",
        (compressedFile.size / 1024).toFixed(0),
        "Ko",
      );
      setImagePreview(URL.createObjectURL(compressedFile));
    } catch (error) {
      console.error("Erreur de compression:", error);
    }
  };

  const startRecording = async () => {
    try {
      // Contraintes réduisant la taille du fichier dès la capture : mono (1 canal)
      // et fréquence d'échantillonnage plus basse (16 kHz suffit largement pour
      // de la voix, contre 44-48 kHz par défaut), tout en gardant une bonne
      // qualité vocale grâce à la réduction du bruit et l'annulation d'écho
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Le codec Opus (dans un conteneur webm) est déjà très efficace pour la
      // voix ; on limite en plus le débit à 24 kbps, largement suffisant pour
      // une note vocale intelligible tout en réduisant fortement la taille
      const options: MediaRecorderOptions = { audioBitsPerSecond: 24000 };
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options.mimeType = "audio/webm;codecs=opus";
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        console.log("Taille de l'audio:", (blob.size / 1024).toFixed(0), "Ko");
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Erreur d'accès au micro:", error);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const removeAudio = () => {
    setAudioBlob(null);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !imageFile && !audioBlob) return;

    if (socket && selectedUser) {
      socket.emit("stopTyping", {
        receiverId: selectedUser._id,
        senderId: authUser?._id,
      });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    setIsSending(true);
    await sendMessage({
      text,
      image: imageFile,
      audio: audioBlob,
      replyTo: replyingTo,
    });
    setIsSending(false);
    setText("");
    removeImage();
    removeAudio();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-zinc-200 dark:border-zinc-800"
    >
      {replyingTo && (
        <div className="px-4 py-2 flex items-center justify-between bg-zinc-100 dark:bg-zinc-800 text-sm">
          <div className="truncate">
            <span className="text-zinc-400">Réponse à : </span>
            {replyingTo.text}
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="ml-2 text-zinc-400"
          >
            ✕
          </button>
        </div>
      )}

      {imagePreview && (
        <div className="p-3 flex items-center gap-2">
          <div className="relative">
            <Image
              src={imagePreview}
              alt="Aperçu"
              width={80}
              height={80}
              unoptimized
              className="w-20 h-20 object-cover rounded-lg"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute -top-2 -right-2 bg-zinc-800 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {audioBlob && (
        <div className="px-4 py-2 flex items-center gap-2">
          <audio
            controls
            src={URL.createObjectURL(audioBlob)}
            className="h-8"
          />
          <button
            type="button"
            onClick={removeAudio}
            className="text-zinc-400 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      <div className="p-3 flex items-end gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 border border-zinc-300 dark:border-zinc-700 rounded-full px-3 py-2 bg-transparent">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-zinc-500 shrink-0"
            aria-label="Ajouter une image"
          >
            <ImageIcon size={22} strokeWidth={2} />
          </button>

          <input
            type="text"
            placeholder="Écris un message..."
            value={text}
            onChange={handleChange}
            className="flex-1 min-w-0 bg-transparent outline-none text-sm"
          />

          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`shrink-0 ${isRecording ? "text-red-600 animate-pulse" : "text-zinc-500"}`}
            aria-label="Enregistrer un message audio"
          >
            <Mic size={22} strokeWidth={2} />
          </button>
        </div>

        <button
          type="submit"
          disabled={isSending}
          className="bg-indigo-600 text-white rounded-full px-6 py-2.5 font-medium hover:bg-indigo-700 transition disabled:opacity-50 shrink-0"
        >
          {isSending ? "..." : "Envoyer"}
        </button>
      </div>
    </form>
  );
}
