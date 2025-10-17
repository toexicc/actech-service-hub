import jsPDF from "jspdf";

interface PDFData {
  serviceId: string;
  timestamp: string;
  adminRep: string;
  technician: string;
  clientType: string;
  priority: string;
  clientName: string;
  username: string;
  phone: string;
  email: string;
  deviceType: string;
  serial: string;
  brand: string;
  color: string;
  model: string;
  memory: string;
  chiefComplaint: string;
  dents: boolean;
  scratches: boolean;
  missingParts: boolean;
  physicalDamage: boolean;
  importantFiles: boolean;
  noPower: boolean;
  repairHistory: boolean;
  estimatedCost: number;
  timeFrame: string;
}

export const generateServicePDF = async (data: PDFData): Promise<Blob> => {
  const doc = new jsPDF();
  
  // Set font
  doc.setFont("helvetica");
  
  // Header
  doc.setFontSize(10);
  doc.text("AC TECH REPAIR INC. | UNIT 103, 1ST FLOOR, FBR ARCADE, 5 a KATIPUNAN AVE, QUEZON CITY", 105, 15, { align: "center" });
  doc.text("MONDAY TO SATURDAY (10:00 PM - 7:00 PM)", 105, 20, { align: "center" });
  doc.setFontSize(8);
  doc.text("powered by techbros", 105, 25, { align: "center" });
  
  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("DIAGNOSIS REPORT | CLIENT INTAKE FORM", 105, 35, { align: "center" });
  
  // Date/Time and Service ID table
  let yPos = 45;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Date and Time:", 15, yPos);
  doc.text("Service ID:", 105, yPos);
  
  yPos += 5;
  doc.setFont("helvetica", "normal");
  doc.text(data.timestamp, 15, yPos);
  doc.text(data.serviceId, 105, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Admin Representative:", 15, yPos);
  doc.text("Technician:", 105, yPos);
  
  yPos += 5;
  doc.setFont("helvetica", "normal");
  doc.text(data.adminRep, 15, yPos);
  doc.text(data.technician, 105, yPos);
  
  // Client Information Section
  yPos += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Client Information", 15, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.text("Client Type:", 15, yPos);
  doc.text("Priority:", 105, yPos);
  
  yPos += 5;
  doc.setFont("helvetica", "normal");
  doc.text(data.clientType, 15, yPos);
  doc.text(data.priority, 105, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Name:", 15, yPos);
  doc.text("Username:", 105, yPos);
  
  yPos += 5;
  doc.setFont("helvetica", "normal");
  doc.text(data.clientName, 15, yPos);
  doc.text(data.username, 105, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Phone:", 15, yPos);
  doc.text("Email:", 105, yPos);
  
  yPos += 5;
  doc.setFont("helvetica", "normal");
  doc.text(data.phone, 15, yPos);
  doc.text(data.email, 105, yPos);
  
  // Device Information Section
  yPos += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Device Information", 15, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.text("Device Type:", 15, yPos);
  doc.text("Serial No.:", 105, yPos);
  
  yPos += 5;
  doc.setFont("helvetica", "normal");
  doc.text(data.deviceType, 15, yPos);
  doc.text(data.serial, 105, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Brand:", 15, yPos);
  doc.text("Color:", 105, yPos);
  
  yPos += 5;
  doc.setFont("helvetica", "normal");
  doc.text(data.brand, 15, yPos);
  doc.text(data.color, 105, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Model:", 15, yPos);
  doc.text("Memory:", 105, yPos);
  
  yPos += 5;
  doc.setFont("helvetica", "normal");
  doc.text(data.model, 15, yPos);
  doc.text(data.memory, 105, yPos);
  
  // Chief Complaint Section
  yPos += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Chief Complaint", 15, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const complaintLines = doc.splitTextToSize(data.chiefComplaint, 180);
  doc.text(complaintLines, 15, yPos);
  yPos += (complaintLines.length * 5);
  
  // Device Notes Section
  yPos += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Device Notes", 15, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const deviceNotes: string[] = [];
  if (data.dents) deviceNotes.push("Dents");
  if (data.scratches) deviceNotes.push("Scratches");
  if (data.missingParts) deviceNotes.push("Missing Parts");
  if (data.physicalDamage) deviceNotes.push("Physical Damage");
  if (data.importantFiles) deviceNotes.push("Important Files");
  if (data.noPower) deviceNotes.push("No Power");
  if (data.repairHistory) deviceNotes.push("With Repair History");
  
  const notesText = deviceNotes.length > 0 ? deviceNotes.join(", ") : "";
  const notesLines = doc.splitTextToSize(notesText, 180);
  doc.text(notesLines, 15, yPos);
  yPos += (notesLines.length * 5);
  
  // Cost and Time Frame
  yPos += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Estimated Cost:", 15, yPos);
  
  yPos += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`PHP ${data.estimatedCost.toLocaleString()}`, 15, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Time Frame:", 15, yPos);
  
  yPos += 5;
  doc.setFont("helvetica", "normal");
  doc.text(data.timeFrame, 15, yPos);
  
  // Footer
  yPos += 15;
  doc.setFontSize(8);
  const footerText = "This document is automatically generated after you submit the digital form. Please note that by completing the form, you have already acknowledged and agreed to the Terms and Conditions of AC Tech Repair Ph, confirmed the accuracy of all information provided, and consented to the servicing of your device with costs to be finalized based on the final diagnosis.";
  const footerLines = doc.splitTextToSize(footerText, 180);
  doc.text(footerLines, 15, yPos);
  
  // Return as blob
  return doc.output("blob");
};
