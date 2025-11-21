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
  isUpdated?: boolean;
  signatureUrl?: string;
  annotationImageUrl?: string;
  annotationNotes?: string;
}

export const generateServicePDF = async (data: PDFData): Promise<Blob> => {
  const doc = new jsPDF({
    format: "letter",
    unit: "mm",
  });

  // Add logo - use public path for production compatibility
  const logoImg = await fetch("/ac-tech-logo-pdf.png")
    .then((res) => {
      if (!res.ok) throw new Error("Failed to load logo");
      return res.blob();
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read logo"));
          reader.readAsDataURL(blob);
        }),
    );

  // Center logo at top with proper aspect ratio (square logo)
  doc.addImage(logoImg, "PNG", 80, 10, 50, 50);

  let yPos = 65;

  // Header text
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("AC TECH REPAIR INC. | UNIT 103, 1ST FLOOR, FBR ARCADE, 5 a KATIPUNAN AVE, QUEZON CITY", 105, yPos, {
    align: "center",
  });
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

  // Add UPDATED watermark/badge if this is an updated PDF
  if (data.isUpdated) {
    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(220, 53, 69); // Red color for visibility
    doc.setFont("helvetica", "bold");
    doc.text("*** UPDATED VERSION ***", 105, yPos, { align: "center" });
    doc.setTextColor(0, 0, 0); // Reset to black
  }

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
  yPos += complaintLines.length * 5;

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
    yPos += notesLines.length * 5;
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

  // Device Annotation Image (if provided)
  if (data.annotationImageUrl) {
    yPos += 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Device Annotation", leftCol, yPos);
    
    yPos += 8;
    // Add annotation image - scale to fit width while maintaining aspect ratio
    const imgWidth = 180;
    const imgHeight = 135; // Maintain 4:3 aspect ratio
    doc.addImage(data.annotationImageUrl, "PNG", leftCol, yPos, imgWidth, imgHeight);
    yPos += imgHeight + 5;
    
    // Add annotation notes if provided
    if (data.annotationNotes) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const notesLines = doc.splitTextToSize(data.annotationNotes, 180);
      doc.text(notesLines, leftCol, yPos);
      yPos += notesLines.length * 5;
    }
  }

  // Signature (Column AK) - if provided
  if (data.signatureUrl) {
    yPos += 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Client Signature", leftCol, yPos);
    
    yPos += 8;
    // Add signature image
    const sigWidth = 80;
    const sigHeight = 40;
    doc.addImage(data.signatureUrl, "PNG", leftCol, yPos, sigWidth, sigHeight);
    yPos += sigHeight + 10;
  }

  // Footer
  yPos += 15;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const footerText =
    "This document is automatically generated after you submitted the digital form. Please note that by completing the form, you have already acknowledged and agreed to the Terms and Conditions of AC Tech Repair Ph, confirmed the accuracy of all information provided, and consented to the servicing of your device with costs to be finalized based on the final diagnosis.";
  const footerLines = doc.splitTextToSize(footerText, 180);
  doc.text(footerLines, leftCol, yPos);

  // Return as blob
  return doc.output("blob");
};
