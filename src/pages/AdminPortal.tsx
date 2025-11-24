import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import acTechLogo from "@/assets/ac-tech-logo.jpg";

const AdminPortal = () => {
  const navigate = useNavigate();
  const userRole = sessionStorage.getItem("userRole");

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
    // Technicians cannot access admin portal
    if (userRole === "technician") {
      navigate("/technician-portal");
    }
  }, [navigate, userRole]);

  const handleLogout = () => {
    sessionStorage.removeItem("authenticated");
    sessionStorage.removeItem("userRole");
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("userFullName");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4 sm:p-8 flex flex-col">
      <div className="max-w-6xl mx-auto flex-grow w-full">
        <div className="text-center mb-12">
          <img 
            src={acTechLogo} 
            alt="AC Tech Repair" 
            className="mx-auto h-20 mb-4 object-contain"
          />
          <h1 className="text-3xl font-bold text-blue-600 mb-2">Admin Portal - Sections</h1>
          <div className="flex gap-2 justify-center mt-4">
            <Button onClick={() => navigate("/menu")} variant="outline">
              Back to Menu
            </Button>
            <Button onClick={handleLogout} variant="destructive">
              Logout
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="p-8 hover:shadow-xl transition-shadow cursor-pointer bg-white" onClick={() => navigate("/service-form")}>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-blue-600 mb-4">Client Intake Form</h2>
              <p className="text-muted-foreground mb-6">
                Frontdesk Form
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700 w-full">
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
              <Button className="bg-blue-600 hover:bg-blue-700 w-full">
                Open Manager
              </Button>
            </div>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-shadow cursor-pointer bg-white" onClick={() => navigate("/customer-management")}>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-blue-600 mb-4">Customer Management</h2>
              <p className="text-muted-foreground mb-6">
                View Customer Service History
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700 w-full">
                Open Customer
              </Button>
            </div>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-shadow cursor-pointer bg-white" onClick={() => navigate("/service-tracker")}>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-blue-600 mb-4">Service Tracker</h2>
              <p className="text-muted-foreground mb-6">
                Monitor All Ongoing Services
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700 w-full">
                Open Tracker
              </Button>
            </div>
          </Card>

          {userRole === "management" && (
            <>
              <Card className="p-8 hover:shadow-xl transition-shadow cursor-pointer bg-white" onClick={() => navigate("/transaction-tracker")}>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-blue-600 mb-4">Transaction Tracker</h2>
                  <p className="text-muted-foreground mb-6">
                    View Financial Reports
                  </p>
                  <Button className="bg-blue-600 hover:bg-blue-700 w-full">
                    Open Transactions
                  </Button>
                </div>
              </Card>

              <Card className="p-8 hover:shadow-xl transition-shadow cursor-pointer bg-white" onClick={() => navigate("/inventory-management")}>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-blue-600 mb-4">Inventory Management</h2>
                  <p className="text-muted-foreground mb-6">
                    Track Parts & Materials
                  </p>
                  <Button className="bg-blue-600 hover:bg-blue-700 w-full">
                    Open Inventory
                  </Button>
                </div>
              </Card>

              <Card className="p-8 hover:shadow-xl transition-shadow cursor-pointer bg-white" onClick={() => navigate("/staff-management")}>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-blue-600 mb-4">Staff Management</h2>
                  <p className="text-muted-foreground mb-6">
                    Manage Staff & Roles
                  </p>
                  <Button className="bg-blue-600 hover:bg-blue-700 w-full">
                    Open Staff
                  </Button>
                </div>
              </Card>

              <Card className="p-8 hover:shadow-xl transition-shadow cursor-pointer bg-white" onClick={() => navigate("/admin-dashboard")}>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-blue-600 mb-4">Admin Dashboard</h2>
                  <p className="text-muted-foreground mb-6">
                    View Services by Status
                  </p>
                  <Button className="bg-blue-600 hover:bg-blue-700 w-full">
                    Open Dashboard
                  </Button>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
      
      <footer className="text-center text-sm text-muted-foreground mt-8">
        Powered by Stack&Scale
      </footer>
    </div>
  );
};

export default AdminPortal;
