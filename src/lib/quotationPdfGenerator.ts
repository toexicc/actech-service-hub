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
  serviceCost: string;
  partsUsed: string;
  discount: string;
  totalCost: string;
  isUpdated?: boolean;
}

// Helper function to completely clean diagnosis text
const cleanDiagnosisText = (text: string): string => {
  if (!text || text === "N/A") return "N/A";
  
  let cleaned = text;
  
  // Remove emoji characters and their placeholders
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
  cleaned = cleaned.replace(/[❗🔍⚠️✅💡📋ØÛñ@]/g, '');
  
  // Remove special character artifacts (W, &b, etc. from emoji encoding)
  cleaned = cleaned.replace(/^[W&@Ø#]\s*/gm, '');
  
  // Remove all markdown symbols
  cleaned = cleaned.replace(/^#+\s*/gm, '');
  cleaned = cleaned.replace(/\*\*/g, '');
  
  // Remove metadata lines
  const lines = cleaned.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    // Skip customer metadata
    if (/^(Customer Name|Device Type|Model|Service ID|Technician):/i.test(trimmed)) return false;
    if (trimmed === 'AC TECH DEVICE DIAGNOSIS') return false;
    // Skip lines that are just special characters
    if (/^[=Ø]+$/.test(trimmed)) return false;
    return true;
  });
  
  cleaned = filteredLines.join('\n');
  
  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n\n\n+/g, '\n\n');
  cleaned = cleaned.trim();
  
  return cleaned;
};

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

  // Two-column layout: Diagnosis on left, Service Summary on right
  yPos += 10;
  
  const diagnosisColStart = leftCol;
  const diagnosisColWidth = 85;
  const summaryColStart = diagnosisColStart + diagnosisColWidth + 10;
  const summaryColWidth = 85;
  
  // Draw borders for the two-column layout
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  
  // Left column (Technician Diagnosis)
  const diagnosisStartY = yPos;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Technician Diagnosis", diagnosisColStart + 2, yPos + 5);
  
  // Right column (Service Summary)
  doc.text("Service Summary", summaryColStart + 2, yPos + 5);
  
  yPos += 10;
  
  // Diagnosis content (left column)
  let diagnosisY = yPos;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  
  const cleanedDiagnosis = cleanDiagnosisText(data.technicianDiagnosis);
  const diagnosisParagraphs = cleanedDiagnosis.split('\n\n');
  
  for (const paragraph of diagnosisParagraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    
    // Check if it's a section header (ends with colon)
    const isHeader = trimmed.endsWith(':') && trimmed.length < 80 && !trimmed.includes('.');
    
    if (isHeader) {
      diagnosisY += 2;
      doc.setFont("helvetica", "bold");
    } else {
      doc.setFont("helvetica", "normal");
    }
    
    const lines = doc.splitTextToSize(trimmed, diagnosisColWidth - 4);
    doc.text(lines, diagnosisColStart + 2, diagnosisY);
    diagnosisY += lines.length * 4 + 2;
  }
  
  const diagnosisHeight = diagnosisY - yPos + 5;
  
  // Service Summary content (right column)
  let summaryY = yPos;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  
  // Service Cost
  doc.setFont("helvetica", "bold");
  doc.text("Service Cost:", summaryColStart + 2, summaryY);
  doc.setFont("helvetica", "normal");
  doc.text(`Php ${data.serviceCost}`, summaryColStart + 45, summaryY);
  summaryY += 6;
  
  // Parts Used
  doc.setFont("helvetica", "bold");
  doc.text("Parts Used:", summaryColStart + 2, summaryY);
  doc.setFont("helvetica", "normal");
  const partsLines = doc.splitTextToSize(data.partsUsed, summaryColWidth - 47);
  doc.text(partsLines, summaryColStart + 45, summaryY);
  summaryY += Math.max(6, partsLines.length * 4 + 2);
  
  // Discount
  doc.setFont("helvetica", "bold");
  doc.text("Discount:", summaryColStart + 2, summaryY);
  doc.setFont("helvetica", "normal");
  doc.text(`Php ${data.discount}`, summaryColStart + 45, summaryY);
  summaryY += 6;
  
  // Total Cost
  doc.setFont("helvetica", "bold");
  doc.text("Total Cost:", summaryColStart + 2, summaryY);
  doc.setFontSize(10);
  doc.text(`Php ${data.totalCost}`, summaryColStart + 45, summaryY);
  summaryY += 6;
  
  const summaryHeight = summaryY - yPos + 5;
  const maxHeight = Math.max(diagnosisHeight, summaryHeight);
  
  // Draw borders
  // Left column border
  doc.rect(diagnosisColStart, diagnosisStartY, diagnosisColWidth, maxHeight);
  // Right column border
  doc.rect(summaryColStart, diagnosisStartY, summaryColWidth, maxHeight);
  
  yPos = diagnosisStartY + maxHeight + 10;

  // Footer - ensure it doesn't overflow
  yPos += 15;
  
  // Check if footer will fit, if not add new page
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const footerText =
    "This document is automatically generated after the technician completes the final diagnosis and quotation. Once received, please review our Terms and Conditions and send your approval. By submitting the form, you acknowledge that all information provided is accurate and consent to the servicing of your device. Any changes or additional findings will be communicated through your preferred channel of communication.";
  const footerLines = doc.splitTextToSize(footerText, 180);
  doc.text(footerLines, leftCol, yPos);

  // Return as blob
  return doc.output("blob");
};
