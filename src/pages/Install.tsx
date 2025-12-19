import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Monitor, Apple, Chrome } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <img 
            src="/pwa-192x192.png" 
            alt="AC Tech Repair Logo" 
            className="w-24 h-24 mx-auto rounded-2xl shadow-lg"
          />
          <h1 className="text-2xl font-bold text-foreground mt-4">AC Tech Service Hub</h1>
          <p className="text-muted-foreground mt-2">Install the app for the best experience</p>
        </div>

        {isInstalled ? (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-green-600 flex items-center justify-center gap-2">
                <Download className="h-5 w-5" />
                App Installed!
              </CardTitle>
              <CardDescription>
                You can now access AC Tech Service Hub from your home screen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/")} className="w-full">
                Open App
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Install Button (Android/Desktop Chrome) */}
            {deferredPrompt && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-primary" />
                    Quick Install
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleInstallClick} className="w-full" size="lg">
                    Install App Now
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* iOS Instructions */}
            {isIOS && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Apple className="h-5 w-5" />
                    Install on iPhone/iPad
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">1</span>
                    <p className="text-sm text-muted-foreground">Tap the <strong>Share</strong> button at the bottom of Safari</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">2</span>
                    <p className="text-sm text-muted-foreground">Scroll down and tap <strong>"Add to Home Screen"</strong></p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">3</span>
                    <p className="text-sm text-muted-foreground">Tap <strong>"Add"</strong> in the top right corner</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Android Instructions */}
            {!isIOS && !deferredPrompt && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Install on Android
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">1</span>
                    <p className="text-sm text-muted-foreground">Tap the <strong>menu icon</strong> (⋮) in Chrome</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">2</span>
                    <p className="text-sm text-muted-foreground">Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">3</span>
                    <p className="text-sm text-muted-foreground">Tap <strong>"Install"</strong> to confirm</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Desktop Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Install on Desktop
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Chrome className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Look for the <strong>install icon</strong> in the address bar (Chrome/Edge) and click it
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Back to Login */}
        <Button variant="ghost" onClick={() => navigate("/")} className="w-full">
          Back to Login
        </Button>
      </div>
    </div>
  );
};

export default Install;
