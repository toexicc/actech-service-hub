// Sends a push notification via the send-push-notification edge function so
// recipients get notified even when offline / not currently logged in.
import { supabase } from "@/integrations/supabase/client";

interface PushNotificationPayload {
  userId: string;
  title: string;
  message: string;
  url?: string;
  data?: Record<string, unknown>;
}

export const sendPushNotification = async (
  payload: PushNotificationPayload,
): Promise<boolean> => {
  try {
    if (!payload.userId || !payload.title || !payload.message) return false;
    const { error } = await supabase.functions.invoke("send-push-notification", {
      body: {
        userId: payload.userId,
        title: payload.title,
        message: payload.message,
        url: payload.url,
        data: payload.data,
      },
    });
    return !error;
  } catch {
    return false;
  }
};
