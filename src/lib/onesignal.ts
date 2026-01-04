// OneSignal App ID - public identifier safe to include in frontend code
const ONESIGNAL_APP_ID = "0ba186cc-b8d9-4573-83f1-cc2ea6b9e841";

declare global {
  interface Window {
    OneSignal?: any;
    OneSignalDeferred?: Array<(os: any) => void | Promise<void>>;
  }
}

let initQueued = false;

const ensureDeferredQueue = () => {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
};

/**
 * Ensures OneSignal SDK is ready and provides the SDK instance.
 * Uses the official deferred pattern so we don't race the SDK load.
 */
const withOneSignal = (cb: (OneSignal: any) => void | Promise<void>) => {
  if (typeof window === "undefined") return;
  ensureDeferredQueue();
  window.OneSignalDeferred!.push(cb);
};

export const initOneSignal = async (): Promise<void> => {
  if (typeof window === "undefined") return;

  // Important: do NOT bail just because window.OneSignal exists.
  // In v16 the SDK can define globals before init completes.
  if (initQueued) return;
  initQueued = true;

  withOneSignal(async (OneSignal) => {
    try {
      const isLocalhost =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        safari_web_id: "web.onesignal.auto.2e77cfdc-f6e8-4572-82d4-363b6713f2bc",

        // Critical: ensure OneSignal SW is registered at the correct location/scope.
        // If this is wrong, notifications will only appear while the app is open.
        // Use the v16 SW file served from the site root.
        serviceWorkerParam: { scope: "/" },
        serviceWorkerPath: "OneSignalSDK.sw.js",
        serviceWorkerUpdaterPath: "OneSignalSDKUpdaterWorker.js",

        // Helpful for local testing only (doesn't affect production).
        allowLocalhostAsSecureOrigin: isLocalhost,

        notifyButton: { enable: true },
        promptOptions: {
          slidedown: {
            prompts: [
              {
                type: "push",
                autoPrompt: false,
                text: {
                  actionMessage: "Get notified about service updates and messages",
                  acceptButton: "Allow",
                  cancelButton: "Later",
                },
                delay: { pageViews: 1, timeDelay: 5 },
              },
            ],
          },
        },
      } as any);

      console.log("OneSignal initialized successfully");

      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        console.log(
          "[OneSignal] SW registrations:",
          regs.map((r) => ({ scope: r.scope, active: r.active?.scriptURL })),
        );
      }
    } catch (error) {
      console.error("Failed to initialize OneSignal:", error);
    }
  });
};

export const setOneSignalExternalUserId = async (userId: string): Promise<void> => {
  if (typeof window === "undefined") return;

  withOneSignal(async (OneSignal) => {
    try {
      await OneSignal.login(userId);
      console.log("OneSignal external user ID set");
    } catch (error) {
      console.error("Failed to set OneSignal external user ID:", error);
    }
  });
};

export const clearOneSignalExternalUserId = async (): Promise<void> => {
  if (typeof window === "undefined") return;

  withOneSignal(async (OneSignal) => {
    try {
      await OneSignal.logout();
      console.log("OneSignal external user ID cleared");
    } catch (error) {
      console.error("Failed to clear OneSignal external user ID:", error);
    }
  });
};

export const promptForPushPermission = async (): Promise<boolean> => {
  if (typeof window === "undefined") return false;

  return await new Promise<boolean>((resolve) => {
    withOneSignal(async (OneSignal) => {
      try {
        await OneSignal.Slidedown.promptPush();

        // Give the SDK a moment to update subscription state
        await new Promise((r) => setTimeout(r, 750));
        resolve(isSubscribedToPush());
      } catch (error) {
        console.error("Failed to prompt for push permission:", error);
        resolve(false);
      }
    });
  });
};

export const getNotificationPermission = (): "default" | "granted" | "denied" => {
  if (!window.OneSignal) return "default";
  return window.OneSignal.Notifications?.permissionNative || "default";
};

export const isSubscribedToPush = (): boolean => {
  if (!window.OneSignal) return false;
  return window.OneSignal.User?.PushSubscription?.optedIn || false;
};

export const checkSubscriptionStatus = async (): Promise<boolean> => {
  if (typeof window === "undefined") return false;

  return await new Promise<boolean>((resolve) => {
    withOneSignal(async (OneSignal) => {
      try {
        const optedIn = OneSignal.User?.PushSubscription?.optedIn;
        resolve(optedIn === true);
      } catch (error) {
        console.error("Error checking subscription status:", error);
        resolve(false);
      }
    });
  });
};

// Combined function to handle the full push notification setup after login
export const setupPushNotificationsForUser = async (userId: string): Promise<void> => {
  if (typeof window === "undefined") return;

  // Ensure init was queued (safe if already queued)
  await initOneSignal();

  withOneSignal(async (OneSignal) => {
    try {
      const alreadySubscribed = OneSignal.User?.PushSubscription?.optedIn === true;

      if (!alreadySubscribed) {
        await OneSignal.Slidedown.promptPush();
      }

      // Give subscription time to be created before binding external id
      await new Promise((r) => setTimeout(r, 1000));

      const subscribedNow = OneSignal.User?.PushSubscription?.optedIn === true;
      if (subscribedNow) {
        await OneSignal.login(userId);
      }
    } catch (error) {
      console.error("Error setting up push notifications:", error);
    }
  });
};

