export const NOTIFICATION_ENABLED_KEY = "sb:pwa-notifications-enabled";
export const NOTIFICATION_SEEN_PREFIX = "sb:notification-seen:";

export function isNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

export async function showAppNotification(title: string, options: NotificationOptions = {}) {
  if (!isNotificationSupported() || Notification.permission !== "granted") return false;

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    badge: "/icons/icon-192.png",
    icon: "/icons/icon-192.png",
    ...options,
  });
  return true;
}

export function notificationSeenKey(id: string) {
  return `${NOTIFICATION_SEEN_PREFIX}${id}`;
}

export function wasNotificationSeen(id: string) {
  try {
    return localStorage.getItem(notificationSeenKey(id)) === new Date().toISOString().slice(0, 10);
  } catch {
    return false;
  }
}

export function markNotificationSeen(id: string) {
  try {
    localStorage.setItem(notificationSeenKey(id), new Date().toISOString().slice(0, 10));
  } catch {
    // localStorage can be unavailable in private browsing.
  }
}
