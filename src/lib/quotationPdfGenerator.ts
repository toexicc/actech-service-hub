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

// Helper function to completely clean diagnosis text to basic plain text
const cleanDiagnosisText = (text: string): string => {
  if (!text || text === "N/A") return "N/A";
  
  let cleaned = text;
  
  // STEP 1: Remove all emojis and special unicode characters
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
  cleaned = cleaned.replace(/[📱💻🔧🔍👤❗⚠️✅💡📋]/g, '');
  
  // STEP 2: Remove metadata headers
  const headersToRemove = [
    /Customer Name:.*$/gm,
    /Device Type:.*$/gm,
    /Model:.*$/gm,
    /Service ID:.*$/gm,
    /Technician:.*$/gm,
    /AC TECH DEVICE DIAGNOSIS/g
  ];
  
  for (const pattern of headersToRemove) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // STEP 3: Remove footer sections
  const footerMarkers = [
    "To proceed with the service",
    "Professional Recommendations:",
    "📋 SUMMARY:",
    "SUMMARY:",
    "---"
  ];
  
  for (const marker of footerMarkers) {
    const idx = cleaned.indexOf(marker);
    if (idx > -1) {
      cleaned = cleaned.substring(0, idx);
    }
  }
  
  // STEP 4: Remove all # symbols (markdown headers)
  cleaned = cleaned.replace(/#/g, '');
  
  // STEP 5: Fix letter-spacing issues (e.g., "c o m p o n e n t" -> "component")
  // This detects words where each letter is separated by spaces
  cleaned = cleaned.replace(/\b(\w)(\s+\w)+\b/g, (match) => {
    // Only fix if ALL characters are single letters with spaces
    const chars = match.split(/\s+/);
    if (chars.every(c => c.length === 1)) {
      // Join without spaces
      return chars.join('');
    }
    return match; // Return unchanged if not letter-spaced
  });
  
  // STEP 6: Normalize whitespace
  // Replace multiple spaces with single space
  cleaned = cleaned.replace(/  +/g, ' ');
  
  // Replace multiple newlines with double newline (paragraph breaks)
  cleaned = cleaned.replace(/\n\n\n+/g, '\n\n');
  
  // Trim each line
  cleaned = cleaned.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
  
  return cleaned.trim();
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

  // Smaller logo for compact header
  doc.addImage(logoImg, "PNG", 85, 8, 40, 40);

  let yPos = 50;

  // Compact header text
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("AC TECH REPAIR INC. | UNIT 103, 1ST FLOOR, FBR ARCADE, KATIPUNAN AVE, QUEZON CITY", 105, yPos, {
    align: "center",
  });
  yPos += 3;
  doc.text("MONDAY TO SATURDAY (10:00 PM - 7:00 PM)", 105, yPos, { align: "center" });
  yPos += 3;
  doc.setFontSize(7);
  doc.text("ac tech repair powered by techbros", 105, yPos, { align: "center" });

  // Title
  yPos += 7;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("SERVICE QUOTATION FORM", 105, yPos, { align: "center" });

  // Add UPDATED watermark/badge if this is an updated PDF
  if (data.isUpdated) {
    yPos += 5;
    doc.setFontSize(9);
    doc.setTextColor(220, 53, 69); // Red color for visibility
    doc.setFont("helvetica", "bold");
    doc.text("*** UPDATED VERSION ***", 105, yPos, { align: "center" });
    doc.setTextColor(0, 0, 0); // Reset to black
  }

  // Compact info section with smaller spacing
  yPos += 7;
  const leftCol = 15;
  const midCol = 55;
  const rightCol = 115;
  const valueCol = 145;

  // Row 1: Date/Time and Service ID
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Date and Time:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.timestamp, midCol, yPos);

  doc.setFont("helvetica", "bold");
  doc.text("Service ID:", rightCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.serviceId, valueCol, yPos);

  yPos += 4;

  // Row 2: Admin Rep and Technician
  doc.setFont("helvetica", "bold");
  doc.text("Admin Representative:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.adminRep, midCol, yPos);

  doc.setFont("helvetica", "bold");
  doc.text("Technician:", rightCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.technician, valueCol, yPos);

  // Client Information Section - more compact
  yPos += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Client Information", leftCol, yPos);

  yPos += 5;
  doc.setFontSize(8);

  // Client Type and Priority
  doc.text("Client Type:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.clientType, midCol, yPos);

  doc.setFont("helvetica", "bold");
  doc.text("Priority:", rightCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.priority, valueCol, yPos);

  yPos += 4;

  // Name and Username
  doc.setFont("helvetica", "bold");
  doc.text("Name:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.clientName, midCol, yPos);

  doc.setFont("helvetica", "bold");
  doc.text("Username:", rightCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.username, valueCol, yPos);

  yPos += 4;

  // Phone and Email
  doc.setFont("helvetica", "bold");
  doc.text("Phone:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.phone, midCol, yPos);

  doc.setFont("helvetica", "bold");
  doc.text("Email:", rightCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.email, valueCol, yPos);

  // Device Information Section - more compact
  yPos += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Device Information", leftCol, yPos);

  yPos += 5;
  doc.setFontSize(8);

  // Device Type and Serial
  doc.text("Device Type:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.deviceType, midCol, yPos);

  doc.setFont("helvetica", "bold");
  doc.text("Serial No.:", rightCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.serial, valueCol, yPos);

  yPos += 4;

  // Brand and Color
  doc.setFont("helvetica", "bold");
  doc.text("Brand:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.brand, midCol, yPos);

  doc.setFont("helvetica", "bold");
  doc.text("Color:", rightCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.color, valueCol, yPos);

  yPos += 4;

  // Model and Memory
  doc.setFont("helvetica", "bold");
  doc.text("Model:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.model, midCol, yPos);

  doc.setFont("helvetica", "bold");
  doc.text("Memory:", rightCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.memory, valueCol, yPos);

  // Two-column layout: Diagnosis on left, Service Summary on right - more compact
  yPos += 8;
  
  const diagnosisColStart = leftCol;
  const diagnosisColWidth = 75; // Smaller columns
  const summaryColStart = diagnosisColStart + diagnosisColWidth + 8;
  const summaryColWidth = 75; // Smaller columns
  
  // Draw borders for the two-column layout
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  
  // Left column (Technician Diagnosis)
  const diagnosisStartY = yPos;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Technician Diagnosis", diagnosisColStart + 2, yPos + 4);
  
  // Right column (Service Summary)
  doc.text("Service Summary", summaryColStart + 2, yPos + 4);
  
  yPos += 8;
  
  // Diagnosis content (left column)
  let diagnosisY = yPos;
  doc.setFontSize(8);
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
    diagnosisY += lines.length * 3 + 1;
  }
  
  const diagnosisHeight = diagnosisY - yPos + 5;
  
  // Service Summary content (right column) - NO duplicate label
  let summaryY = yPos;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  
  // Column AA - Service Summary (NO label, just content)
  const serviceSummaryLines = doc.splitTextToSize(data.serviceSummary || "N/A", summaryColWidth - 4);
  doc.text(serviceSummaryLines, summaryColStart + 2, summaryY);
  summaryY += serviceSummaryLines.length * 3.5 + 3;
  
  // Service Cost
  doc.setFont("helvetica", "bold");
  doc.text("Service Cost:", summaryColStart + 2, summaryY);
  doc.setFont("helvetica", "normal");
  doc.text(`Php ${data.serviceCost}`, summaryColStart + 38, summaryY);
  summaryY += 4;
  
  // Parts Used
  doc.setFont("helvetica", "bold");
  doc.text("Parts Used:", summaryColStart + 2, summaryY);
  doc.setFont("helvetica", "normal");
  const partsLines = doc.splitTextToSize(data.partsUsed, summaryColWidth - 40);
  doc.text(partsLines, summaryColStart + 38, summaryY);
  summaryY += Math.max(4, partsLines.length * 3.5 + 2);
  
  // Discount
  doc.setFont("helvetica", "bold");
  doc.text("Discount:", summaryColStart + 2, summaryY);
  doc.setFont("helvetica", "normal");
  doc.text(`Php ${data.discount}`, summaryColStart + 38, summaryY);
  summaryY += 4;
  
  // Total Cost
  doc.setFont("helvetica", "bold");
  doc.text("Total Cost:", summaryColStart + 2, summaryY);
  doc.setFontSize(9);
  doc.text(`Php ${data.totalCost}`, summaryColStart + 38, summaryY);
  summaryY += 5;
  
  const summaryHeight = summaryY - yPos + 5;
  const maxHeight = Math.max(diagnosisHeight, summaryHeight);
  
  // Draw borders
  doc.rect(diagnosisColStart, diagnosisStartY, diagnosisColWidth, maxHeight);
  doc.rect(summaryColStart, diagnosisStartY, summaryColWidth, maxHeight);
  
  yPos = diagnosisStartY + maxHeight + 5;

  // Footer - keep on same page with minimal spacing
  yPos += 3;
  
  // Only add new page if absolutely necessary (less than 20mm left)
  if (yPos > 260) {
    doc.addPage();
    yPos = 20;
  }
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  const footerText =
    "This document is automatically generated after the technician completes the final diagnosis and quotation. Once received, please review our Terms and Conditions and send your approval. By submitting the form, you acknowledge that all information provided is accurate and consent to the servicing of your device. Any changes or additional findings will be communicated through your preferred channel of communication.";
  const footerLines = doc.splitTextToSize(footerText, 180);
  doc.text(footerLines, leftCol, yPos);

  // Return as blob
  return doc.output("blob");
};
