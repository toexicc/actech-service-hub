import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search } from "lucide-react";
import acTechLogo from "@/assets/ac-tech-logo.jpg";

const Login = () => {
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === "ACT3CH2025~*") {
      sessionStorage.setItem("authenticated", "true");
      navigate("/menu");
    } else {
      toast({
        title: "Invalid Password",
        description: "Please enter the correct admin portal password.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <img 
            src={acTechLogo} 
            alt="AC Tech Repair" 
            className="mx-auto h-20 mb-4 object-contain"
          />
          <h1 className="text-3xl font-bold text-blue-600 mb-2">AC Tech Repair</h1>
          <p className="text-muted-foreground">Internal Team Web Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <Label htmlFor="password">Enter Admin Portal Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="mt-2"
            />
          </div>

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
            Login
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
    </div>
  );
};

export default Login;
