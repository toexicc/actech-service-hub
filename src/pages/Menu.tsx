import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import acTechLogo from "@/assets/ac-tech-logo.jpg";

const Menu = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem("authenticated");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <img 
            src={acTechLogo} 
            alt="AC Tech Repair" 
            className="mx-auto h-24 mb-4 object-contain"
          />
          <h1 className="text-4xl font-bold text-blue-600 mb-2">AC Tech Repair</h1>
          <p className="text-xl text-muted-foreground">Internal Team Portal</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <Card className="p-8 hover:shadow-xl transition-shadow cursor-pointer bg-white" onClick={() => navigate("/admin-portal")}>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-blue-600 mb-4">Admin Portal</h2>
              <p className="text-muted-foreground mb-6">
                Frontdesk Form and Client Info Update
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Enter Admin Portal
              </Button>
            </div>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-shadow cursor-pointer bg-white" onClick={() => navigate("/technician-portal")}>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-blue-600 mb-4">Technician Portal</h2>
              <p className="text-muted-foreground mb-6">
                Service Update and Technician Report Form
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Enter Technician Portal
              </Button>
            </div>
          </Card>
        </div>

        <div className="text-center">
          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Menu;
