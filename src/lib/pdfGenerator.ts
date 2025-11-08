import jsPDF from "jspdf";
import logoJpg from "@/assets/ac-tech-logo-pdf.jpg";
import logoPng from "@/assets/ac-tech-logo-pdf.png";
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
  const doc = new jsPDF({
    format: 'letter',
    unit: 'mm'
  });
  
  // Add logo (prefer JPG for jsPDF compatibility, fallback to PNG)
  const toDataURL = async (url: string) =>
    fetch(url)
      .then((res) => res.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          })
      );

  try {
    const logoDataJpg = await toDataURL(logoJpg);
    // Center logo at top with proper aspect ratio
    doc.addImage(logoDataJpg, "JPEG", 80, 10, 50, 50);
  } catch (e1) {
    try {
      const logoDataPng = await toDataURL(logoPng);
      doc.addImage(logoDataPng, "PNG", 80, 10, 50, 50);
    } catch (e2) {
      // If both fail, continue without a logo
      // console.warn("Logo load failed", e1, e2);
    }
  }
  
  let yPos = 65;
  
  // Header text
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("AC TECH REPAIR INC. | UNIT 103, 1ST FLOOR, FBR ARCADE, 5 a KATIPUNAN AVE, QUEZON CITY", 105, yPos, { align: "center" });
  yPos += 4;
  doc.text("MONDAY TO SATURDAY (10:00 PM - 7:00 PM)", 105, yPos, { align: "center" });
  yPos += 4;
  doc.setFontSize(8);
  doc.text("powered by techbros", 105, yPos, { align: "center" });
  
  // Title
  yPos += 10;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("DIAGNOSIS REPORT | CLIENT INTAKE FORM", 105, yPos, { align: "center" });
  
  // Table layout matching template with proper margins
  yPos += 10;
  const leftCol = 15;
  const midCol = 60;
  const rightCol = 115;
  const valueCol = 150;
  
  // Row 1: Date/Time and Service ID
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Date and Time:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.timestamp, midCol, yPos);
  
  doc.setFont("helvetica", "bold");
  doc.text("Service ID:", rightCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.serviceId, valueCol, yPos);
  
  yPos += 6;
  
  // Row 2: Admin Rep and Technician
  doc.setFont("helvetica", "bold");
  doc.text("Admin Representative:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.adminRep, midCol, yPos);
  
  doc.setFont("helvetica", "bold");
  doc.text("Technician:", rightCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.technician, valueCol, yPos);
  
  // Client Information Section
  yPos += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Client Information", leftCol, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  
  // Client Type and Priority
  doc.text("Client Type:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.clientType, midCol, yPos);
  
  doc.setFont("helvetica", "bold");
  doc.text("Priority:", rightCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.priority, valueCol, yPos);
  
  yPos += 6;
  
  // Name and Username
  doc.setFont("helvetica", "bold");
  doc.text("Name:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.clientName, midCol, yPos);
  
  doc.setFont("helvetica", "bold");
  doc.text("Username:", rightCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.username, valueCol, yPos);
  
  yPos += 6;
  
  // Phone and Email
  doc.setFont("helvetica", "bold");
  doc.text("Phone:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.phone, midCol, yPos);
  
  doc.setFont("helvetica", "bold");
  doc.text("Email:", rightCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.email, valueCol, yPos);
  
  // Device Information Section
  yPos += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Device Information", leftCol, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  
  // Device Type and Serial
  doc.text("Device Type:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.deviceType, midCol, yPos);
  
  doc.setFont("helvetica", "bold");
  doc.text("Serial No.:", rightCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.serial, valueCol, yPos);
  
  yPos += 6;
  
  // Brand and Color
  doc.setFont("helvetica", "bold");
  doc.text("Brand:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.brand, midCol, yPos);
  
  doc.setFont("helvetica", "bold");
  doc.text("Color:", rightCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.color, valueCol, yPos);
  
  yPos += 6;
  
  // Model and Memory
  doc.setFont("helvetica", "bold");
  doc.text("Model:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.model, midCol, yPos);
  
  doc.setFont("helvetica", "bold");
  doc.text("Memory:", rightCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.memory, valueCol, yPos);
  
  // Chief Complaint Section
  yPos += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Chief Complaint", leftCol, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const complaintLines = doc.splitTextToSize(data.chiefComplaint, 180);
  doc.text(complaintLines, leftCol, yPos);
  yPos += (complaintLines.length * 5);
  
  // Device Notes Section
  yPos += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Device Notes", leftCol, yPos);
  
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
  if (notesText) {
    const notesLines = doc.splitTextToSize(notesText, 180);
    doc.text(notesLines, leftCol, yPos);
    yPos += (notesLines.length * 5);
  }
  
  // Cost and Time Frame
  yPos += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Estimated Cost:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(`PHP ${data.estimatedCost.toLocaleString()}`, midCol, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Time Frame:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.timeFrame, midCol, yPos);
  
  // Footer
  yPos += 15;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const footerText = "This document is automatically generated after you submit the digital form. Please note that by completing the form, you have already acknowledged and agreed to the Terms and Conditions of AC Tech Repair Ph, confirmed the accuracy of all information provided, and consented to the servicing of your device with costs to be finalized based on the final diagnosis.";
  const footerLines = doc.splitTextToSize(footerText, 180);
  doc.text(footerLines, leftCol, yPos);
  
  // Return as blob
  return doc.output("blob");
};
