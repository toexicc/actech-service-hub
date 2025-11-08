import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import acTechLogo from "@/assets/ac-tech-logo.jpg";

const AdminPortal = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <img 
            src={acTechLogo} 
            alt="AC Tech Repair" 
            className="mx-auto h-20 mb-4 object-contain"
          />
          <h1 className="text-3xl font-bold text-blue-600 mb-2">Admin Portal - Sections</h1>
          <Button onClick={() => navigate("/menu")} variant="outline" className="mt-4">
            Back to Menu
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-8 hover:shadow-xl transition-shadow cursor-pointer bg-white" onClick={() => navigate("/service-form")}>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-blue-600 mb-4">Client Intake Form</h2>
              <p className="text-muted-foreground mb-6">
                Frontdesk Form
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Open Form
              </Button>
            </div>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-shadow cursor-pointer bg-white" onClick={() => navigate("/manage-client")}>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-blue-600 mb-4">Manage Client</h2>
              <p className="text-muted-foreground mb-6">
                Client Information View/Update
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Open Manager
              </Button>
            </div>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-shadow cursor-pointer bg-white" onClick={() => navigate("/service-tracker")}>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-blue-600 mb-4">Service Tracker</h2>
              <p className="text-muted-foreground mb-6">
                Monitor All Ongoing Services
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Open Tracker
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;
