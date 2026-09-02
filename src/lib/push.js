// lib/push.js

import { axiosInstance } from "./axios";

// Convertit la clé publique VAPID (une chaîne base64) au format brut attendu
// par l'API PushManager du navigateur
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Demande la permission de notification, enregistre le service worker,
// s'abonne aux notifications push, puis enregistre la souscription côté serveur
export async function subscribeToPushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return {
      success: false,
      message: "Les notifications push ne sont pas supportées sur ce navigateur.",
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, message: "Permission refusée." };
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const existingSubscription = await registration.pushManager.getSubscription();
    const subscription =
      existingSubscription ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        ),
      }));

    const subJson = subscription.toJSON();
    await axiosInstance.post("/users/push-subscribe", {
      endpoint: subJson.endpoint,
      keys: subJson.keys,
    });

    return { success: true };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: "Erreur lors de l'activation des notifications.",
    };
  }
}

// Se désabonne des notifications push, à la fois côté navigateur et côté serveur
export async function unsubscribeFromPushNotifications() {
  try {
    if (!("serviceWorker" in navigator)) return { success: true };

    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();

    if (subscription) {
      await axiosInstance.post("/users/push-unsubscribe", {
        endpoint: subscription.endpoint,
      });
      await subscription.unsubscribe();
    }

    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false };
  }
}

// Vérifie si l'utilisateur est déjà abonné sur cet appareil/navigateur
export async function isPushSubscribed() {
  if (!("serviceWorker" in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return !!subscription;
}
