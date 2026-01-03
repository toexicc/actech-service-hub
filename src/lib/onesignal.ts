// OneSignal App ID - This is a public identifier, safe to include in frontend code
const ONESIGNAL_APP_ID = "YOUR_ONESIGNAL_APP_ID"; // Replace with your actual App ID

export const initOneSignal = async (): Promise<void> => {
  // Skip initialization if not in browser
  if (typeof window === 'undefined') return;
  
  // Skip if already initialized
  if (window.OneSignal) {
    console.log('OneSignal already initialized');
    return;
  }

  // Initialize the deferred array if it doesn't exist
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  
  window.OneSignalDeferred.push(async (OneSignal) => {
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true, // For development
        serviceWorkerParam: { scope: '/' },
        serviceWorkerPath: '/OneSignalSDKWorker.js',
        notifyButton: {
          enable: false, // We'll use custom UI
        },
        promptOptions: {
          slidedown: {
            prompts: [
              {
                type: "push",
                autoPrompt: false, // We'll trigger manually after login
                text: {
                  actionMessage: "Get notified about service updates and messages",
                  acceptButton: "Allow",
                  cancelButton: "Later",
                },
                delay: {
                  pageViews: 1,
                  timeDelay: 5,
                },
              },
            ],
          },
        },
      });
      
      console.log('OneSignal initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OneSignal:', error);
    }
  });
};

export const setOneSignalExternalUserId = async (userId: string): Promise<void> => {
  if (!window.OneSignal) {
    console.warn('OneSignal not initialized');
    return;
  }
  
  try {
    await window.OneSignal.login(userId);
    console.log('OneSignal external user ID set:', userId);
  } catch (error) {
    console.error('Failed to set OneSignal external user ID:', error);
  }
};

export const clearOneSignalExternalUserId = async (): Promise<void> => {
  if (!window.OneSignal) {
    console.warn('OneSignal not initialized');
    return;
  }
  
  try {
    await window.OneSignal.logout();
    console.log('OneSignal external user ID cleared');
  } catch (error) {
    console.error('Failed to clear OneSignal external user ID:', error);
  }
};

export const promptForPushPermission = async (): Promise<void> => {
  if (!window.OneSignal) {
    console.warn('OneSignal not initialized');
    return;
  }
  
  try {
    await window.OneSignal.Slidedown.promptPush();
  } catch (error) {
    console.error('Failed to prompt for push permission:', error);
  }
};

export const getNotificationPermission = (): 'default' | 'granted' | 'denied' => {
  if (!window.OneSignal) {
    return 'default';
  }
  
  return window.OneSignal.Notifications.permissionNative;
};

export const isSubscribedToPush = (): boolean => {
  if (!window.OneSignal) {
    return false;
  }
  
  return window.OneSignal.User.PushSubscription.optedIn;
};
