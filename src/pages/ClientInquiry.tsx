import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import acTechLogo from "@/assets/ac-tech-logo.jpg";
import ClientInquiryTable from "@/components/ClientInquiryTable";

const ClientInquiry = () => {
  const navigate = useNavigate();
  const userRole = sessionStorage.getItem("userRole");

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
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
      <div className="max-w-7xl mx-auto flex-grow w-full">
        <div className="text-center mb-8">
          <img 
            src={acTechLogo} 
            alt="AC Tech Repair" 
            className="mx-auto h-20 mb-4 object-contain"
          />
          <h1 className="text-3xl font-bold text-blue-600 mb-2">Client Inquiry</h1>
          <div className="flex gap-2 justify-center mt-4">
            <Button onClick={() => navigate("/admin-portal")} variant="outline">
              Back to Admin Portal
            </Button>
            <Button onClick={handleLogout} variant="destructive">
              Logout
            </Button>
          </div>
        </div>

        <ClientInquiryTable />
      </div>
      
      <footer className="text-center text-sm text-muted-foreground mt-8">
        Powered by Stack&Scale
      </footer>
    </div>
  );
};

export default ClientInquiry;
