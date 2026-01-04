// Helper to send push notifications via our edge function
// This sends notifications through OneSignal even when the app is closed

const SUPABASE_FUNCTIONS_BASE_URL = "https://ulzxolpefyutprfpfrxp.functions.supabase.co";

// Check if push notifications via edge function are available
// (Only works on production with Cloud enabled)
const isPushEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  // Only attempt push on production domain
  return (
    window.location.hostname === "www.actechrepair-service.com" ||
    window.location.hostname === "actechrepair-service.com"
  );
};

interface PushNotificationPayload {
  userId: string;
  title: string;
  message: string;
  url?: string;
  data?: Record<string, unknown>;
}

export const sendPushNotification = async (payload: PushNotificationPayload): Promise<boolean> => {
  // Skip if not on production (edge function won't exist)
  if (!isPushEnabled()) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${SUPABASE_FUNCTIONS_BASE_URL}/functions/v1/send-push-notification`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Silently fail - don't break the app
      return false;
    }

    const result = await response.json();
    return result.success === true;
  } catch {
    // Silently fail - network errors shouldn't crash the app
    return false;
  }
};
