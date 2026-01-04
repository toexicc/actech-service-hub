// Helper to send push notifications via our edge function
// This sends notifications through OneSignal even when the app is closed

const SUPABASE_URL = "https://ulzxolpefyutprfpfrxp.supabase.co";

interface PushNotificationPayload {
  userId: string;
  title: string;
  message: string;
  url?: string;
  data?: Record<string, unknown>;
}

export const sendPushNotification = async (payload: PushNotificationPayload): Promise<boolean> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Push notification failed:", errorData);
      return false;
    }

    const result = await response.json();
    console.log("Push notification sent:", result);
    return result.success === true;
  } catch (error) {
    console.error("Error sending push notification:", error);
    return false;
  }
};
