import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2 } from "lucide-react";
import { findUser } from "@/lib/userCredentials";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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
        
        // Redirect based on role
        if (user.role === "technician") {
          navigate("/technician-portal");
        } else {
          navigate("/menu");
        }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <img 
            src="/ac-tech-logo-pdf.png" 
            alt="AC Tech Repair" 
            className="mx-auto h-20 mb-4 object-contain"
          />
          <h1 className="text-3xl font-bold text-blue-600 mb-2">AC Tech Repair</h1>
          <p className="text-muted-foreground">Internal Team Web Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="mt-2"
              autoComplete="username"
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="mt-2"
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigate("/track")}
          >
            <Search className="mr-2 h-4 w-4" />
            Track Your Service
          </Button>
        </div>
      </div>
      
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        Powered by Stack&Scale
      </footer>
    </div>
  );
};

export default Login;
