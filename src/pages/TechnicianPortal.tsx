import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import acTechLogo from "@/assets/ac-tech-logo.jpg";

const TechnicianPortal = () => {
  const navigate = useNavigate();
  const userRole = sessionStorage.getItem("userRole");

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
    // Admin cannot access technician portal
    if (userRole === "admin") {
      navigate("/admin-portal");
    }
  }, [navigate, userRole]);

  const handleLogout = () => {
    sessionStorage.removeItem("authenticated");
    sessionStorage.removeItem("userRole");
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
          <p className="text-xl text-muted-foreground">Technician Portal</p>
        </div>

        <div className="flex justify-center gap-2 mb-8">
          {userRole === "management" && (
            <Button onClick={() => navigate("/menu")} variant="outline">
              Back to Menu
            </Button>
          )}
          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <Card className="p-8 hover:shadow-xl transition-shadow cursor-pointer bg-white" onClick={() => navigate("/service-update")}>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-blue-600 mb-4">Service Update</h2>
              <p className="text-muted-foreground mb-6">
                Update service status, diagnosis, and technician notes
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700 w-full">
                Enter Service Update
              </Button>
            </div>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-shadow bg-white">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-400 mb-4">Technician Report Form</h2>
              <p className="text-muted-foreground mb-6">
                Detailed technician report submission (Coming Soon)
              </p>
              <Button disabled className="bg-gray-300 w-full">
                Coming Soon
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TechnicianPortal;
