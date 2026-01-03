interface OneSignalNotificationPermission {
  permission: 'default' | 'granted' | 'denied';
}

interface OneSignalUser {
  PushSubscription: {
    id: string | null;
    token: string | null;
    optedIn: boolean;
  };
}

interface OneSignalNamespace {
  init(options: {
    appId: string;
    allowLocalhostAsSecureOrigin?: boolean;
    serviceWorkerParam?: { scope: string };
    serviceWorkerPath?: string;
    serviceWorkerUpdaterPath?: string;
    notifyButton?: { enable: boolean };
    promptOptions?: {
      slidedown?: {
        prompts?: Array<{
          type: string;
          autoPrompt: boolean;
          text?: {
            actionMessage?: string;
            acceptButton?: string;
            cancelButton?: string;
          };
          delay?: {
            pageViews?: number;
            timeDelay?: number;
          };
        }>;
      };
    };
  }): Promise<void>;
  
  login(externalId: string): Promise<void>;
  logout(): Promise<void>;
  
  Notifications: {
    permission: boolean;
    permissionNative: 'default' | 'granted' | 'denied';
    requestPermission(): Promise<void>;
    addEventListener(event: string, callback: (data: any) => void): void;
    removeEventListener(event: string, callback: (data: any) => void): void;
  };
  
  User: OneSignalUser;
  
  Slidedown: {
    promptPush(): Promise<void>;
  };
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: OneSignalNamespace) => void>;
    OneSignal?: OneSignalNamespace;
  }
}

export {};
