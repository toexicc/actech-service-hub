import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, Wrench, Shield, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Missing Information", description: "Enter email and password.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Sign-in failed", description: error.message || "Try again.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    // The useEffect above handles navigation once useAuth hydrates user+roles,
    // so we intentionally don't navigate here to avoid a redirect race.
  };

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <div className="min-h-screen min-h-[100dvh] gradient-bg flex flex-col items-center justify-center p-4 py-6 sm:py-4 relative overflow-y-auto">
        {/* Ambient orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-info/15 blur-3xl" />
        </div>

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary to-primary-glow shadow-float">
                <div className="bg-card rounded-xl p-2">
                  <img src={acTechLogo} alt="AC Tech Repair" className="h-14 w-14 object-contain" />
                </div>
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">AC Tech Repair</h1>
            <p className="text-sm text-muted-foreground mt-1">Internal Team Portal</p>
          </div>

          <div className="glass-panel rounded-2xl p-6 sm:p-7 shadow-elegant">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight">Sign in</h2>
                <p className="text-xs text-muted-foreground">Access your team portal</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@actech.com" className="h-11 bg-background/60" autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" className="h-11 bg-background/60" autoComplete="current-password" />
              </div>
              <Button type="submit" className="w-full h-11 gradient-primary text-primary-foreground hover:opacity-95 shadow-glow" disabled={isLoading}>
                {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Please wait...</>) : (<>Sign in <ArrowRight className="ml-2 h-4 w-4" /></>)}
              </Button>
              <p className="text-center text-xs text-muted-foreground pt-1">Accounts are created by administrators via Staff Management.</p>
            </form>

            <div className="mt-5 pt-5 border-t border-border/60">
              <Button variant="outline" className="w-full h-11 bg-card/50" onClick={() => navigate("/track")}>
                <Search className="mr-2 h-4 w-4 text-primary" />
                Track your service
              </Button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { icon: Wrench, label: "Service Management", tone: "bg-primary/10 text-primary" },
              { icon: Search, label: "Real-time Tracking", tone: "bg-info/10 text-info" },
              { icon: Shield, label: "Secure Access", tone: "bg-success/10 text-success" },
            ].map((f) => (
              <div key={f.label} className="text-center p-3 rounded-xl glass-panel">
                <div className={`w-9 h-9 rounded-xl ${f.tone} flex items-center justify-center mx-auto mb-1.5`}>
                  <f.icon className="h-4 w-4" />
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">{f.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
