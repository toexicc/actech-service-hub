import jsPDF from "jspdf";

interface QuotationPDFData {
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
  technicianDiagnosis: string;
  serviceSummary: string;
  serviceCost: string;
  partsUsed: string;
  discount: string;
  totalCost: string;
  isUpdated?: boolean;
}

export const generateQuotationPDF = async (data: QuotationPDFData): Promise<Blob> => {
  const doc = new jsPDF({
    format: "letter",
    unit: "mm",
  });

  // Add logo - use public path for production compatibility
  const basePath = import.meta.env.MODE === 'production' ? '/actech-service-hub' : '';
  const logoImg = await fetch(`${basePath}/ac-tech-logo-pdf.png`)
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
  doc.text("AC TECH REPAIR INC. | UNIT 103, 1ST FLOOR, FBR ARCADE, KATIPUNAN AVE, QUEZON CITY", 105, yPos, {
    align: "center",
  });
  yPos += 4;
  doc.text("MONDAY TO SATURDAY (10:00 PM - 7:00 PM)", 105, yPos, { align: "center" });
  yPos += 4;
  doc.setFontSize(8);
  doc.text("ac tech repair powered by techbros", 105, yPos, { align: "center" });

  // Title
  yPos += 10;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("SERVICE QUOTATION FORM", 105, yPos, { align: "center" });

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

  // Technician Diagnosis Section
  yPos += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Technician Diagnosis", leftCol, yPos);

  yPos += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const diagnosisLines = doc.splitTextToSize(data.technicianDiagnosis || "N/A", 180);
  doc.text(diagnosisLines, leftCol, yPos);
  yPos += diagnosisLines.length * 5;

  // Service Summary Section
  yPos += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Service Summary", leftCol, yPos);

  yPos += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const summaryLines = doc.splitTextToSize(data.serviceSummary || "N/A", 180);
  doc.text(summaryLines, leftCol, yPos);
  yPos += summaryLines.length * 5;

  // Cost Summary Section
  yPos += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Cost Summary", leftCol, yPos);

  yPos += 8;
  doc.setFontSize(10);

  // Service Cost
  doc.setFont("helvetica", "bold");
  doc.text("Service Cost:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(`Php ${data.serviceCost}`, midCol, yPos);

  yPos += 6;

  // Parts Used
  doc.setFont("helvetica", "bold");
  doc.text("Parts Used:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.partsUsed || "N/A", midCol, yPos);

  yPos += 6;

  // Discount
  doc.setFont("helvetica", "bold");
  doc.text("Discount:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(`Php ${data.discount}`, midCol, yPos);

  yPos += 6;

  // Total Cost
  doc.setFont("helvetica", "bold");
  doc.text("Total Cost:", leftCol, yPos);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Php ${data.totalCost}`, midCol, yPos);

  // Footer
  yPos += 15;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const footerText =
    "This document is automatically generated after the technician completes the final diagnosis and quotation. Once received, please review our Terms and Conditions and send your approval. By submitting the form, you acknowledge that all information provided is accurate and consent to the servicing of your device. Any changes or additional findings will be communicated through your preferred channel of communication.";
  const footerLines = doc.splitTextToSize(footerText, 180);
  doc.text(footerLines, leftCol, yPos);

  // Return as blob
  return doc.output("blob");
};
