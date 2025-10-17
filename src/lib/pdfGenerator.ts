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
  
  // Date/Time and Service ID
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let yPos = 45;
  doc.text(`Date and Time: ${data.timestamp}`, 15, yPos);
  doc.text(`Service ID: ${data.serviceId}`, 120, yPos);
  
  yPos += 6;
  doc.text(`Admin Representative: ${data.adminRep}`, 15, yPos);
  doc.text(`Technician: ${data.technician}`, 120, yPos);
  
  // Client Information
  yPos += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Client Information", 15, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Client Type: ${data.clientType}`, 15, yPos);
  doc.text(`Priority: ${data.priority}`, 120, yPos);
  
  yPos += 6;
  doc.text(`Name: ${data.clientName}`, 15, yPos);
  doc.text(`Username: ${data.username}`, 120, yPos);
  
  yPos += 6;
  doc.text(`Phone: ${data.phone}`, 15, yPos);
  doc.text(`Email: ${data.email}`, 120, yPos);
  
  // Device Information
  yPos += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Device Information", 15, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Device Type: ${data.deviceType}`, 15, yPos);
  doc.text(`Serial No.: ${data.serial}`, 120, yPos);
  
  yPos += 6;
  doc.text(`Brand: ${data.brand}`, 15, yPos);
  doc.text(`Color: ${data.color}`, 120, yPos);
  
  yPos += 6;
  doc.text(`Model: ${data.model}`, 15, yPos);
  doc.text(`Memory: ${data.memory}`, 120, yPos);
  
  // Chief Complaint
  yPos += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Chief Complaint", 15, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const complaintLines = doc.splitTextToSize(data.chiefComplaint, 180);
  doc.text(complaintLines, 15, yPos);
  yPos += (complaintLines.length * 6);
  
  // Device Notes
  yPos += 8;
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
  
  const notesText = deviceNotes.length > 0 ? deviceNotes.join(", ") : "None";
  const notesLines = doc.splitTextToSize(notesText, 180);
  doc.text(notesLines, 15, yPos);
  yPos += (notesLines.length * 6);
  
  // Cost and Time
  yPos += 8;
  doc.text(`Estimated Cost: PHP ${data.estimatedCost.toLocaleString()}`, 15, yPos);
  yPos += 6;
  doc.text(`Time Frame: ${data.timeFrame}`, 15, yPos);
  
  // Footer
  yPos += 15;
  doc.setFontSize(8);
  const footerText = "This document is automatically generated after you submit the digital form. Please note that by completing the form, you have already acknowledged and agreed to the Terms and Conditions of AC Tech Repair Ph, confirmed the accuracy of all information provided, and consented to the servicing of your device with costs to be finalized based on the final diagnosis.";
  const footerLines = doc.splitTextToSize(footerText, 180);
  doc.text(footerLines, 15, yPos);
  
  // Return as blob
  return doc.output("blob");
};
