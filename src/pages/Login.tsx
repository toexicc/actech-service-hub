import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, Wrench, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import acTechLogo from "@/assets/S_S_Marketing-2.png";
import SplashScreen from "@/components/SplashScreen";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate("/menu", { replace: true });
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Missing Information", description: "Enter email and password.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Sign-in failed", description: error.message, variant: "destructive" });
      } else {
        navigate("/menu");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setIsLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) {
        toast({ title: "Google sign-in failed", description: String((result.error as any)?.message ?? result.error), variant: "destructive" });
        setIsLoading(false);
      } else if (!result.redirected) {
        navigate("/menu");
      }
    } catch (e: any) {
      toast({ title: "Google sign-in failed", description: e?.message ?? String(e), variant: "destructive" });
      setIsLoading(false);
    }
  };

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <div className="min-h-screen min-h-[100dvh] gradient-bg flex flex-col items-center justify-center p-4 py-6 sm:py-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-4 sm:mb-8">
            <div className="flex justify-center mb-2 sm:mb-4">
              <div className="p-3 sm:p-4 rounded-2xl bg-card shadow-lg border border-border/50">
                <img src={acTechLogo} alt="AC Tech Repair" className="h-12 w-12 sm:h-16 sm:w-16 object-contain rounded-lg" />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-0.5 sm:mb-1">AC Tech Repair</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Internal Team Portal</p>
          </div>

          <Card className="shadow-xl border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="space-y-1 pb-2 sm:pb-4">
              <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Sign In
              </CardTitle>
              <CardDescription className="text-sm">Access the team portal</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@actech.com" className="h-10 sm:h-11" autoComplete="email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" className="h-10 sm:h-11" autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full h-10 sm:h-11 gradient-primary text-primary-foreground hover:opacity-90" disabled={isLoading}>
                  {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>) : "Sign In"}
                </Button>
              </form>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
              </div>

              <Button type="button" variant="outline" className="w-full h-10 sm:h-11" onClick={handleGoogle} disabled={isLoading}>
                Continue with Google
              </Button>

              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border">
                <Button variant="outline" className="w-full h-10 sm:h-11 group" onClick={() => navigate("/track")}>
                  <Search className="mr-2 h-4 w-4 group-hover:text-primary transition-colors" />
                  Track Your Service
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 sm:mt-8 grid grid-cols-3 gap-2 sm:gap-4">
            <div className="text-center p-2 sm:p-3"><div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-1 sm:mb-2"><Wrench className="h-4 w-4 sm:h-5 sm:w-5 text-primary" /></div><p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Service Management</p></div>
            <div className="text-center p-2 sm:p-3"><div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-info/10 flex items-center justify-center mx-auto mb-1 sm:mb-2"><Search className="h-4 w-4 sm:h-5 sm:w-5 text-info" /></div><p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Real-time Tracking</p></div>
            <div className="text-center p-2 sm:p-3"><div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-success/10 flex items-center justify-center mx-auto mb-1 sm:mb-2"><Shield className="h-4 w-4 sm:h-5 sm:w-5 text-success" /></div><p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Secure Access</p></div>
          </div>
        </div>
        <footer className="mt-4 sm:mt-8 text-center text-xs sm:text-sm text-muted-foreground relative z-10">Powered by Stack&Scale</footer>
      </div>
    </>
  );
};

export default Login;
