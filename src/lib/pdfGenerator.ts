import jsPDF from "jspdf";
import { PDFDocument } from "pdf-lib";
import { getLogoDataUrl, getTermsPdfBytes } from "./pdfAssets";

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
  receivingStaff?: string;
}

export const generateServicePDF = async (data: PDFData): Promise<Blob> => {
  const doc = new jsPDF({
    format: "letter",
    unit: "mm",
  });

  // Use cached logo for faster generation
  const logoImg = await getLogoDataUrl();

  // Center logo at top with proper aspect ratio (square logo)
  doc.addImage(logoImg, "PNG", 80, 10, 50, 50);

  let yPos = 55;

  // Header text
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("AC TECH REPAIR INC. | UNIT 103, 1ST FLOOR, FBR ARCADE, 5 a KATIPUNAN AVE, QUEZON CITY", 105, yPos, {
    align: "center",
  });
  yPos += 4;
  doc.text("MONDAY TO SATURDAY (10:00 PM - 7:00 PM)", 105, yPos, { align: "center" });

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

  // One name per line so multiple selected staff don't overlap. Tight 3.6mm
  // line height keeps the details block on a single page.
  const drawStackedRow = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(label, leftCol, yPos);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const items = (value || "")
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const list = items.length ? items : [""];
    list.forEach((name, i) => {
      doc.text(name, midCol, yPos + i * 3.6);
    });
    yPos += Math.max(5, list.length * 3.6 + 1.2);
    doc.setFontSize(10);
  };

  drawStackedRow("Admin Representative/s:", data.adminRep);
  drawStackedRow("Handling Staff:", (data as any).receivingStaff || "");
  drawStackedRow("Technician/s:", data.technician);

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

  // Cost, Time Frame and Signature in one row
  yPos += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Estimated Cost:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(`PHP ${data.estimatedCost.toLocaleString()}`, midCol, yPos);

  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Estimated Time Frame:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.timeFrame, midCol, yPos);

  // Signature beside cost/time frame (Column AK)
  if (data.signatureUrl) {
    const sigWidth = 50;
    const sigHeight = 25;
    const sigX = rightCol;
    const sigY = yPos - 15;
    doc.addImage(data.signatureUrl, "PNG", sigX, sigY, sigWidth, sigHeight);
  }

  // Footer - ALWAYS on first page
  yPos += 15;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const footerText =
    "This document is automatically generated after you submitted the digital form. Please note that by completing the form, you have already acknowledged and agreed to the Terms and Conditions of AC Tech Repair Ph, confirmed the accuracy of all information provided, and consented to the servicing of your device with costs to be finalized based on the final diagnosis.";
  const footerLines = doc.splitTextToSize(footerText, 180);
  doc.text(footerLines, leftCol, yPos);

  // Device Initial Condition Reference Section (if annotation provided) - PAGE 2
  if (data.annotationImageUrl) {
    // Add new page for Device Initial Condition Reference
    doc.addPage();
    yPos = 20; // Reset Y position for new page
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Device Initial Condition Reference:", leftCol, yPos);
    
    yPos += 8;
    // Add annotation image - scale to fit width while maintaining aspect ratio
    const imgWidth = 180;
    const imgHeight = 135; // Maintain 4:3 aspect ratio
    doc.addImage(data.annotationImageUrl, "PNG", leftCol, yPos, imgWidth, imgHeight);
    yPos += imgHeight + 5;
    
    // Additional Comments title and notes (Column AX)
    if (data.annotationNotes) {
      yPos += 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Additional Comments:", leftCol, yPos);
      
      yPos += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const notesLines = doc.splitTextToSize(data.annotationNotes, 180);
      doc.text(notesLines, leftCol, yPos);
      yPos += notesLines.length * 5;
    }
  }

  // Convert jsPDF to blob first
  const intakeBlob = doc.output("blob");

  // Merge with Terms and Conditions PDF using cached terms
  try {
    // Load the intake PDF and get cached terms in parallel
    const [intakePdfBytes, termsPdfBytes] = await Promise.all([
      intakeBlob.arrayBuffer(),
      getTermsPdfBytes(),
    ]);
    
    const intakePdfDoc = await PDFDocument.load(intakePdfBytes);

    if (termsPdfBytes) {
      const termsPdfDoc = await PDFDocument.load(termsPdfBytes);
      
      // Copy all pages from Terms PDF to the intake PDF
      const copiedPages = await intakePdfDoc.copyPages(termsPdfDoc, termsPdfDoc.getPageIndices());
      copiedPages.forEach((page) => {
        intakePdfDoc.addPage(page);
      });
    }

    // Save the merged PDF
    const mergedPdfBytes = await intakePdfDoc.save();
    return new Blob([new Uint8Array(mergedPdfBytes)], { type: 'application/pdf' });
  } catch (error) {
    console.error('Error merging PDFs:', error);
    // Return intake PDF without terms if merging fails
    return intakeBlob;
  }
};
