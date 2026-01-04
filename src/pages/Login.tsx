import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, Wrench, Shield } from "lucide-react";
import { findUser } from "@/lib/userCredentials";
import { logAuthActivity } from "@/lib/activityLogger";
import { setupPushNotificationsForUser } from "@/lib/onesignal";
import acTechLogo from "@/assets/S_S_Marketing-2.png";
import SplashScreen from "@/components/SplashScreen";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSplashComplete = () => {
    // Render the login UI immediately; the splash already covers it.
    // Avoids iOS Safari edge-cases where a delayed state update can leave a blank screen.
    setShowSplash(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast({
        title: "Missing Information",
        description: "Please enter both username and password.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const user = await findUser(username, password);

      if (user) {
        sessionStorage.setItem("authenticated", "true");
        sessionStorage.setItem("userRole", user.role);
        sessionStorage.setItem("username", user.username);
        sessionStorage.setItem("userFullName", user.name);
        sessionStorage.setItem("staffId", user.staffId);
        
        // Log successful login
        logAuthActivity(user.username, `User logged in successfully`, user.role);
        
        // Setup push notifications for this user (prompts permission and sets user ID)
        // Safari stability: OneSignal web SDK can cause white screens, so we skip it.
        setTimeout(() => {
          if (document.documentElement?.dataset?.browser !== "safari") {
            setupPushNotificationsForUser(user.staffId);
          }
        }, 1500);
        
        // All users go to /menu
        navigate("/menu");
      } else {
        toast({
          title: "Invalid Credentials",
          description: "Username or password is incorrect.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {showSplash && (
        <SplashScreen onComplete={handleSplashComplete} />
      )}
      
      <div className="min-h-screen min-h-[100dvh] gradient-bg flex flex-col items-center justify-center p-4 py-6 sm:py-4 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="w-full max-w-md relative z-10">
          {/* Logo and Title */}
          <div className="text-center mb-4 sm:mb-8">
            <div className="flex justify-center mb-2 sm:mb-4">
              <div className="p-3 sm:p-4 rounded-2xl bg-card shadow-lg border border-border/50">
                <img 
                  src={acTechLogo}
                  alt="AC Tech Repair" 
                  className="h-12 w-12 sm:h-16 sm:w-16 object-contain rounded-lg"
                />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-0.5 sm:mb-1">AC Tech Repair</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Internal Team Portal</p>
          </div>

          {/* Login Card */}
          <Card className="shadow-xl border-border/50 bg-card">
            <CardHeader className="space-y-1 pb-2 sm:pb-4">
              <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Sign In
              </CardTitle>
              <CardDescription className="text-sm">
                Enter your credentials to access the portal
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="h-10 sm:h-11"
                    autoComplete="username"
                  />
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="h-10 sm:h-11"
                    autoComplete="current-password"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-10 sm:h-11 gradient-primary text-primary-foreground hover:opacity-90 transition-opacity" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>

              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border">
                <Button 
                  variant="outline" 
                  className="w-full h-10 sm:h-11 group"
                  onClick={() => navigate("/track")}
                >
                  <Search className="mr-2 h-4 w-4 group-hover:text-primary transition-colors" />
                  Track Your Service
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <div className="mt-4 sm:mt-8 grid grid-cols-3 gap-2 sm:gap-4">
            <div className="text-center p-2 sm:p-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-1 sm:mb-2">
                <Wrench className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Service Management</p>
            </div>
            <div className="text-center p-2 sm:p-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-info/10 flex items-center justify-center mx-auto mb-1 sm:mb-2">
                <Search className="h-4 w-4 sm:h-5 sm:w-5 text-info" />
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Real-time Tracking</p>
            </div>
            <div className="text-center p-2 sm:p-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-success/10 flex items-center justify-center mx-auto mb-1 sm:mb-2">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Secure Access</p>
            </div>
          </div>
        </div>
        
        <footer className="mt-4 sm:mt-8 text-center text-xs sm:text-sm text-muted-foreground relative z-10">
          Powered by Stack&Scale
        </footer>
      </div>
    </>
  );
};

export default Login;
