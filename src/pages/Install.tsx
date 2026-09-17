import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Download, Smartphone, Monitor, Apple, Chrome, ArrowLeft } from "lucide-react";
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
    <div className="min-h-screen bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md flex-col justify-center space-y-5">
        <Button variant="ghost" onClick={() => navigate("/")} className="w-fit rounded-full px-3">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="text-center">
          <img 
            src="/pwa-192x192.png" 
            alt="AC Tech Repair Logo" 
            className="mx-auto h-24 w-24 rounded-2xl shadow-lg"
          />
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">ACTech Hub</h1>
          <p className="mt-2 text-sm text-muted-foreground">Add it to your home screen for a faster full-screen workspace.</p>
        </div>

        {isInstalled ? (
          <Card className="border-success/30 bg-success/5">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                App Installed
              </CardTitle>
              <CardDescription>
                ACTech Hub is ready from your home screen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/")} className="h-12 w-full rounded-xl">
                Open App
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Install Button (Android/Desktop Chrome) */}
            {deferredPrompt && (
              <Card className="border-primary/40 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-primary" />
                    Quick Install
                  </CardTitle>
                  <CardDescription>Use the browser prompt when it appears.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleInstallClick} className="h-12 w-full rounded-xl" size="lg">
                    Install App Now
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* iOS Instructions */}
            {isIOS && (
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Apple className="h-5 w-5" />
                    Install on iPhone/iPad
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">1</span>
                    <p className="text-sm text-muted-foreground">Tap the <strong>Share</strong> button at the bottom of Safari</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">2</span>
                    <p className="text-sm text-muted-foreground">Scroll down and tap <strong>"Add to Home Screen"</strong></p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">3</span>
                    <p className="text-sm text-muted-foreground">Tap <strong>"Add"</strong> in the top right corner</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Android Instructions */}
            {!isIOS && !deferredPrompt && (
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Install on Android
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">1</span>
                    <p className="text-sm text-muted-foreground">Tap the <strong>menu icon</strong> (⋮) in Chrome</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">2</span>
                    <p className="text-sm text-muted-foreground">Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">3</span>
                    <p className="text-sm text-muted-foreground">Tap <strong>"Install"</strong> to confirm</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Desktop Instructions */}
            <Card className="shadow-soft">
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

        <p className="text-center text-xs text-muted-foreground">On the published app, recent screens can reopen faster after the first visit.</p>
      </div>
    </div>
  );
};

export default Install;
