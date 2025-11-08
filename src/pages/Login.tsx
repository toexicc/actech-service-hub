import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search } from "lucide-react";
import acTechLogo from "@/assets/ac-tech-logo.jpg";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Login = () => {
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!role) {
      toast({
        title: "Role Required",
        description: "Please select a role before logging in.",
        variant: "destructive",
      });
      return;
    }

    const rolePasswords: Record<string, string> = {
      technician: "ACT3CH2025~*Technician#",
      admin: "ACT3CH2025~*Admin+",
      management: "ACT3CH2025~*Management!",
    };

    if (password === rolePasswords[role]) {
      sessionStorage.setItem("authenticated", "true");
      sessionStorage.setItem("userRole", role);
      
      // Redirect based on role
      if (role === "technician") {
        navigate("/technician-portal");
      } else {
        navigate("/menu");
      }
    } else {
      toast({
        title: "Invalid Password",
        description: "Please enter the correct password for the selected role.",
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
            <Label htmlFor="role">Select Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="technician">Technician</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="management">Management</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="password">Enter Password</Label>
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
