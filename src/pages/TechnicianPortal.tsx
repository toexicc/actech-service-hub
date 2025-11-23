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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4 sm:p-8 flex flex-col">
      <div className="max-w-6xl mx-auto flex-grow w-full">
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
          <Button onClick={handleLogout} variant="destructive">
            Logout
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-8">
          <Card className="p-8 hover:shadow-xl transition-shadow cursor-pointer bg-white" onClick={() => navigate("/service-update")}>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-blue-600 mb-4">Service Update Form</h2>
              <p className="text-muted-foreground mb-6">
                Update service status and progress
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700 w-full">
                Open Form
              </Button>
            </div>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-shadow cursor-pointer bg-white" onClick={() => navigate("/service-tracking")}>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-blue-600 mb-4">Service Tracking</h2>
              <p className="text-muted-foreground mb-6">
                View and track assigned services
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700 w-full">
                Open Tracker
              </Button>
            </div>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-shadow cursor-pointer bg-white" onClick={() => navigate("/open-dashboard")}>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-blue-600 mb-4">Open Dashboard</h2>
              <p className="text-muted-foreground mb-6">
                View due today and overdue services
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700 w-full">
                Open Dashboard
              </Button>
            </div>
          </Card>
        </div>
      </div>
      
      <footer className="text-center text-sm text-muted-foreground mt-8">
        Powered by Stack&Scale
      </footer>
    </div>
  );
};

export default TechnicianPortal;
