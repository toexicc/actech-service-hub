import jsPDF from "jspdf";
import { PDFDocument } from "pdf-lib";
import { getLogoDataUrl, getTermsPdfBytes } from "./pdfAssets";
import { formatPdfTimestamp, maskStaffName } from "./utils";
import {
  BORDER,
  COL_W,
  CONTENT_W,
  GUTTER,
  Glyph,
  INK,
  M,
  MUTED,
  NAVY,
  PAGE_H,
  drawFooter,
  drawLetterhead,
  drawMetaCard,
  iconBadge,
  setDraw,
  setText,
  stackedCard,
  titledCard,
} from "./pdfPremiumKit";

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

const DISCLAIMER =
  "This document is automatically generated after you submitted the digital form. Please note that by completing the form, you have already acknowledged and agreed to the Terms and Conditions of AC Tech Repair Ph, confirmed the accuracy of all information provided, and consented to the servicing of your device with costs to be finalized based on the final diagnosis.";

/** Simple paragraph card that auto-sizes to its text. */
const paragraphCard = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  title: string,
  glyph: Glyph,
  text: string,
  fontSize = 8,
) => {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text || "N/A", w - 8);
  return titledCard(doc, x, y, w, title, glyph, lines.length * 3.5 + 2, (bx, by) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    setText(doc, text ? INK : MUTED);
    doc.text(lines, bx, by + 2.4);
  });
};

/** Icon rows for Estimated Cost / Estimated Time Frame. */
const metricsCard = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  rows: [Glyph, string, string][],
) => {
  const rowH = 9.5;
  const h = 5 + rows.length * rowH;
  const badgeS = 6.6;
  // Plain card body (no title row) — rows carry their own icon badges.
  doc.setFillColor(255, 255, 255);
  setDraw(doc, BORDER);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");

  let ry = y + 5;
  rows.forEach(([glyph, label, value], i) => {
    if (i > 0) {
      setDraw(doc, BORDER);
      doc.setLineWidth(0.35);
      doc.line(x + 4, ry - 0.6, x + w - 4, ry - 0.6);
    }
    iconBadge(doc, x + 4, ry + 0.6, badgeS, glyph);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.6);
    setText(doc, NAVY);
    doc.text(label.toUpperCase(), x + 4 + badgeS + 4, ry + 5.2);
    doc.setFont("helvetica", "normal");
    setText(doc, INK);
    doc.text(value || "N/A", x + Math.min(w * 0.55, 58), ry + 5.2);
    ry += rowH;
  });

  return y + h;
};

export const drawIntake = (doc: jsPDF, data: PDFData, logo: string) => {
  let y = drawLetterhead(doc, logo, "Diagnosis Report | Client Intake Form", data.isUpdated);

  y = drawMetaCard(
    doc,
    y,
    [
      ["person", "Admin Representative/s:", maskStaffName(data.adminRep)],
      ["person", "Handling Staff:", maskStaffName(data.receivingStaff)],
      ["wrench", "Technician/s:", maskStaffName(data.technician)],
    ],
    [
      ["calendar", "Date and Time:", formatPdfTimestamp(data.timestamp)],
      ["ticket", "Service ID:", data.serviceId],
    ],
  );

  const leftX = M;
  const rightX = M + COL_W + GUTTER;

  const clientBottom = stackedCard(
    doc,
    leftX,
    y,
    COL_W,
    "Client Information",
    "person",
    [
      ["Client Type:", data.clientType],
      ["Priority:", data.priority],
      ["Name:", data.clientName],
      ["Facebook Name/Instagram Username:", data.username],
      ["Phone:", data.phone],
      ["Email:", data.email],
    ],
    2,
  );
  const deviceBottom = stackedCard(
    doc,
    rightX,
    y,
    COL_W,
    "Device Information",
    "device",
    [
      ["Device Type:", data.deviceType],
      ["Brand:", data.brand],
      ["Model:", data.model],
      ["Serial No.:", data.serial],
      ["Color:", data.color],
      ["Storage:", data.memory],
    ],
    2,
  );

  y = Math.max(clientBottom, deviceBottom) + 3.5;

  y = paragraphCard(
    doc,
    M,
    y,
    CONTENT_W,
    "Chief Complaint",
    "note",
    data.chiefComplaint || "N/A",
  ) + 3.5;

  const deviceNotes: string[] = [];
  if (data.dents) deviceNotes.push("Dents");
  if (data.scratches) deviceNotes.push("Scratches");
  if (data.missingParts) deviceNotes.push("Missing Parts");
  if (data.physicalDamage) deviceNotes.push("Physical Damage");
  if (data.importantFiles) deviceNotes.push("Important Files");
  if (data.noPower) deviceNotes.push("No Power");
  if (data.repairHistory) deviceNotes.push("With Repair History");

  y =
    paragraphCard(
      doc,
      M,
      y,
      CONTENT_W,
      "Device Notes",
      "clipboard",
      deviceNotes.length ? deviceNotes.join(", ") : "None noted",
    ) + 3.5;

  const bottomLimit = PAGE_H - 40;
  const metricRows: [Glyph, string, string][] = [
    ["money", "Estimated Cost:", `PHP ${Number(data.estimatedCost || 0).toLocaleString()}`],
    ["clock", "Estimated Time Frame:", data.timeFrame],
  ];

  if (data.annotationImageUrl) {
    // Variant A — annotation present: reference image on the left, cost +
    // comments stacked on the right.
    const imgW = COL_W - 8;
    const room = bottomLimit - y - 18;
    const imgH = Math.min(imgW * 0.75, Math.max(50, room));

    titledCard(
      doc,
      leftX,
      y,
      COL_W,
      "Device Initial Condition Reference",
      "search",
      imgH + 2,
      (bx, by) => {
        try {
          doc.addImage(data.annotationImageUrl!, "PNG", bx, by, imgW, imgH);
        } catch {
          /* annotation optional */
        }
      },
    );

    let ry = metricsCard(doc, rightX, y, COL_W, metricRows) + 3.5;
    if (data.annotationNotes) {
      ry = paragraphCard(
        doc,
        rightX,
        ry,
        COL_W,
        "Additional Comments",
        "note",
        data.annotationNotes,
        7.6,
      ) + 3.5;
    }
    if (data.signatureUrl) {
      titledCard(doc, rightX, ry, COL_W, "Client Signature", "person", 26, (bx, by, bw) => {
        try {
          doc.addImage(data.signatureUrl!, "PNG", bx + (bw - 48) / 2, by, 48, 24);
        } catch {
          /* signature optional */
        }
      });
    }
  } else {
    // Variant B — no annotation: metrics span the full width.
    const nextY = metricsCard(doc, M, y, CONTENT_W, metricRows) + 3.5;
    if (data.signatureUrl) {
      titledCard(doc, rightX, nextY, COL_W, "Client Signature", "person", 26, (bx, by, bw) => {
        try {
          doc.addImage(data.signatureUrl!, "PNG", bx + (bw - 48) / 2, by, 48, 24);
        } catch {
          /* signature optional */
        }
      });
    }
  }

  drawFooter(doc, DISCLAIMER);
};

export const generateServicePDF = async (data: PDFData): Promise<Blob> => {
  const doc = new jsPDF({ format: "letter", unit: "mm" });

  let logo = "";
  try {
    logo = await getLogoDataUrl();
  } catch {
    /* proceed without logo */
  }

  drawIntake(doc, data, logo);

  const intakeBlob = doc.output("blob");

  try {
    const [intakePdfBytes, termsPdfBytes] = await Promise.all([
      intakeBlob.arrayBuffer(),
      getTermsPdfBytes(),
    ]);

    const intakePdfDoc = await PDFDocument.load(intakePdfBytes);

    if (termsPdfBytes) {
      const termsPdfDoc = await PDFDocument.load(termsPdfBytes);
      const copiedPages = await intakePdfDoc.copyPages(termsPdfDoc, termsPdfDoc.getPageIndices());
      copiedPages.forEach((page) => intakePdfDoc.addPage(page));
    }

    const mergedPdfBytes = await intakePdfDoc.save();
    return new Blob([new Uint8Array(mergedPdfBytes)], { type: "application/pdf" });
  } catch {
    return intakeBlob;
  }
};
