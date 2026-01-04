// Helper to send push notifications via edge function
// DISABLED: No Supabase backend - using OneSignal client-side SDK only
// Server-side push would require a backend (Supabase Cloud or similar)

interface PushNotificationPayload {
  userId: string;
  title: string;
  message: string;
  url?: string;
  data?: Record<string, unknown>;
}

export const sendPushNotification = async (_payload: PushNotificationPayload): Promise<boolean> => {
  // No backend available - OneSignal handles notifications via client-side SDK only
  // Server-side push notifications require enabling Lovable Cloud or a similar backend
  return false;
};
