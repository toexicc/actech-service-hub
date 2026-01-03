// OneSignal App ID - This is a public identifier, safe to include in frontend code
const ONESIGNAL_APP_ID = "0ba186cc-b8d9-4573-83f1-cc2ea6b9e841";

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
        serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js',
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
      } as any);
      
      console.log('OneSignal initialized successfully');
      console.log('OneSignal permission:', OneSignal.Notifications?.permissionNative);
      console.log('OneSignal subscribed:', OneSignal.User?.PushSubscription?.optedIn);
      console.log('OneSignal subscription id:', OneSignal.User?.PushSubscription?.id ? 'exists' : 'none');
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
    console.log('Setting OneSignal external user ID:', userId);
    await window.OneSignal.login(userId);
    console.log('OneSignal external user ID set successfully:', userId);
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

export const promptForPushPermission = async (): Promise<boolean> => {
  if (!window.OneSignal) {
    console.warn('OneSignal not initialized');
    return false;
  }
  
  try {
    console.log('Prompting for push notification permission...');
    await window.OneSignal.Slidedown.promptPush();
    
    // Wait a bit for the subscription to register
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const isSubscribed = await checkSubscriptionStatus();
    console.log('Push permission prompt completed. Subscribed:', isSubscribed);
    return isSubscribed;
  } catch (error) {
    console.error('Failed to prompt for push permission:', error);
    return false;
  }
};

export const getNotificationPermission = (): 'default' | 'granted' | 'denied' => {
  if (!window.OneSignal) {
    return 'default';
  }
  
  return window.OneSignal.Notifications?.permissionNative || 'default';
};

export const isSubscribedToPush = (): boolean => {
  if (!window.OneSignal) {
    return false;
  }
  
  return window.OneSignal.User?.PushSubscription?.optedIn || false;
};

export const checkSubscriptionStatus = async (): Promise<boolean> => {
  if (!window.OneSignal) {
    console.warn('OneSignal not initialized');
    return false;
  }
  
  try {
    const permission = window.OneSignal.Notifications?.permissionNative;
    const optedIn = window.OneSignal.User?.PushSubscription?.optedIn;
    const subscriptionId = window.OneSignal.User?.PushSubscription?.id;
    
    console.log('OneSignal Subscription Status:', {
      permission,
      optedIn,
      subscriptionId: subscriptionId ? 'exists' : 'none'
    });
    
    return optedIn === true;
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return false;
  }
};

// Combined function to handle the full push notification setup after login
export const setupPushNotificationsForUser = async (userId: string): Promise<void> => {
  if (!window.OneSignal) {
    console.warn('OneSignal not initialized');
    return;
  }
  
  try {
    console.log('Setting up push notifications for user:', userId);
    
    // Check current subscription status
    const isAlreadySubscribed = isSubscribedToPush();
    console.log('Already subscribed:', isAlreadySubscribed);
    
    if (isAlreadySubscribed) {
      // User is already subscribed, just set the external user ID
      await setOneSignalExternalUserId(userId);
    } else {
      // Need to prompt for permission first
      console.log('User not subscribed, prompting for permission...');
      
      // Prompt for push permission
      await window.OneSignal.Slidedown.promptPush();
      
      // Wait for user to respond and subscription to register
      // We'll poll for subscription status
      let attempts = 0;
      const maxAttempts = 30; // Wait up to 30 seconds
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const subscribed = isSubscribedToPush();
        if (subscribed) {
          console.log('User subscribed to push notifications');
          await setOneSignalExternalUserId(userId);
          console.log('Push notification setup complete for user:', userId);
          return;
        }
        
        // Check if user denied
        const permission = getNotificationPermission();
        if (permission === 'denied') {
          console.log('User denied push notification permission');
          return;
        }
        
        attempts++;
      }
      
      console.log('Subscription polling timed out. User may not have responded to the prompt.');
    }
  } catch (error) {
    console.error('Error setting up push notifications:', error);
  }
};
