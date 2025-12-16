import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Wrench,
  ClipboardList,
  Monitor,
} from "lucide-react";

const TechnicianPortal = () => {
  const navigate = useNavigate();
  const userRole = sessionStorage.getItem("userRole");

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
    if (userRole === "admin") {
      navigate("/admin-portal");
    }
  }, [navigate, userRole]);

  const techSections = [
    {
      title: "Service Update Form",
      description: "Update service status and progress",
      icon: Wrench,
      path: "/service-update",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Service Tracking",
      description: "View and track assigned services",
      icon: ClipboardList,
      path: "/service-tracking",
      color: "text-info",
      bgColor: "bg-info/10",
    },
  ];

  if (userRole === "management") {
    techSections.push({
      title: "Tech Dashboard",
      description: "View due today and overdue services",
      icon: Monitor,
      path: "/tech-dashboard",
      color: "text-warning",
      bgColor: "bg-warning/10",
    });
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 animate-fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Technician Portal</h1>
          <p className="text-muted-foreground">Select a section to manage</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {techSections.map((section) => (
            <Card
              key={section.path}
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1 border-border/50"
              onClick={() => navigate(section.path)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${section.bgColor}`}>
                    <section.icon className={`h-6 w-6 ${section.color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">{section.title}</h3>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-8 text-sm text-muted-foreground">
          Powered by Stack&Scale
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TechnicianPortal;
