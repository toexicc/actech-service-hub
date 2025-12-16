import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
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

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 animate-fade-in">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Client Inquiry</h1>
          <p className="text-muted-foreground">View and manage client inquiries</p>
        </div>

        <ClientInquiryTable />

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          powered by Stack&Scale
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ClientInquiry;
