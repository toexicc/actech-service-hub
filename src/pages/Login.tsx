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
import acTechLogo from "@/assets/S_S_Marketing-2.png";
import SplashScreen from "@/components/SplashScreen";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSplashComplete = () => {
    setShowSplash(false);
    // Small delay before showing content for smooth transition
    setTimeout(() => setShowContent(true), 50);
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
      
      <div className={`min-h-screen gradient-bg flex flex-col items-center justify-center p-4 transition-opacity duration-500 ${
        showContent ? 'opacity-100' : 'opacity-0'
      }`}>
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="w-full max-w-md relative z-10">
          {/* Logo and Title */}
          <div className={`text-center mb-8 transition-all duration-700 delay-100 ${
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}>
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-2xl bg-card shadow-lg border border-border/50">
                <img 
                  src={acTechLogo}
                  alt="AC Tech Repair" 
                  className="h-16 w-16 object-contain rounded-lg"
                />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-1">AC Tech Repair</h1>
            <p className="text-muted-foreground">Internal Team Portal</p>
          </div>

          {/* Login Card */}
          <Card className={`shadow-xl border-border/50 bg-card/80 backdrop-blur-sm transition-all duration-700 delay-200 ${
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Sign In
              </CardTitle>
              <CardDescription>
                Enter your credentials to access the portal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="h-11"
                    autoComplete="username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="h-11"
                    autoComplete="current-password"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 gradient-primary text-primary-foreground hover:opacity-90 transition-opacity" 
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

              <div className="mt-6 pt-6 border-t border-border">
                <Button 
                  variant="outline" 
                  className="w-full h-11 group"
                  onClick={() => navigate("/track")}
                >
                  <Search className="mr-2 h-4 w-4 group-hover:text-primary transition-colors" />
                  Track Your Service
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <div className={`mt-8 grid grid-cols-3 gap-4 transition-all duration-700 delay-300 ${
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            <div className="text-center p-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Wrench className="h-5 w-5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">Service Management</p>
            </div>
            <div className="text-center p-3">
              <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center mx-auto mb-2">
                <Search className="h-5 w-5 text-info" />
              </div>
              <p className="text-xs text-muted-foreground">Real-time Tracking</p>
            </div>
            <div className="text-center p-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center mx-auto mb-2">
                <Shield className="h-5 w-5 text-success" />
              </div>
              <p className="text-xs text-muted-foreground">Secure Access</p>
            </div>
          </div>
        </div>
        
        <footer className={`mt-8 text-center text-sm text-muted-foreground relative z-10 transition-all duration-700 delay-400 ${
          showContent ? 'opacity-100' : 'opacity-0'
        }`}>
          Powered by Stack&Scale
        </footer>
      </div>
    </>
  );
};

export default Login;
