import jsPDF from "jspdf";
import QRCode from "qrcode";
import { getLogoDataUrl } from "./pdfAssets";
import { formatPdfTimestamp, maskStaffName } from "./utils";
import {
  BORDER,
  CONTENT_W,
  COL_W,
  GUTTER,
  INK,
  M,
  MUTED,
  NAVY,
  PAGE_H,
  card,
  drawFooter,
  drawLetterhead,
  drawMetaCard,
  setDraw,
  setFill,
  setText,
  stackedCard,
  titledCard,
} from "./pdfPremiumKit";

export interface ReceiptLine {
  label: string;
  amount: number;
}

export interface ReceiptPayment {
  date: string;
  method: string;
  type: string;
  amount: number;
  reference?: string;
}

export interface ReceiptPDFData {
  serviceId: string;
  timestamp: string;
  receivedBy: string;
  adminRep?: string;
  technician?: string;
  clientName: string;
  phone: string;
  email: string;
  address: string;
  deviceType: string;
  brand: string;
  model: string;
  color: string;
  memory: string;
  serial: string;
  /** Client-approved service lines only. */
  lines: ReceiptLine[];
  /** Short repair summary shown above the approved service lines. */
  serviceSummary?: string;
  subtotal: number;
  discount: number;
  rushFee: number;
  vat: number;
  finalCost: number;
  payments: ReceiptPayment[];
  paid: number;
  balance: number;
  /** Public tracking URL encoded in the QR block. */
  trackUrl?: string;
}

const DISCLAIMER =
  "This receipt is automatically generated from the AC Tech Repair Ph service record and reflects the client-approved services, the finalized cost and every payment recorded for this ticket. Keep this document for your reference when claiming your device or when following up on your repair.";

const money = (n: number) =>
  (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const peso = (n: number) => `PHP ${money(n)}`;

const dateLabel = (raw?: string) => {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
};

/** Approved services table with a right-aligned amount column. */
const linesCard = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  lines: ReceiptLine[],
  summary?: string,
) => {
  const rows = lines.length ? lines : [{ label: "No approved service lines yet", amount: 0 }];
  const amountX = x + w - 4;
  const labelW = w - 40;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.4);
  const wrapped = rows.map((r) => doc.splitTextToSize(r.label || "Service", labelW));
  const heights = wrapped.map((lns) => Math.max(5.4, lns.length * 3.6 + 1.8));

  const summaryText = String(summary ?? "").trim();
  doc.setFontSize(8);
  const summaryLines = summaryText ? doc.splitTextToSize(summaryText, w - 8) : [];
  const summaryH = summaryLines.length ? summaryLines.length * 3.5 + 3.4 : 0;

  const bodyH = 6 + summaryH + heights.reduce((s, v) => s + v, 0);

  return titledCard(doc, x, y, w, "Approved Services", "clipboard", bodyH, (bx, by, bw) => {
    let headY = by;
    if (summaryLines.length) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      setText(doc, MUTED);
      doc.text(summaryLines, bx, headY + 2.6);
      headY += summaryH;
    }

    // Column heads
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4);
    setText(doc, MUTED);
    doc.text("SERVICE", bx, headY + 2.4);
    doc.text("AMOUNT", amountX, headY + 2.4, { align: "right" });
    setDraw(doc, BORDER);
    doc.setLineWidth(0.35);
    doc.line(bx, headY + 4.2, bx + bw, headY + 4.2);

    let ry = headY + 4.2;
    rows.forEach((row, i) => {
      const h = heights[i];
      if (i > 0) {
        setDraw(doc, BORDER);
        doc.setLineWidth(0.25);
        doc.line(bx, ry, bx + bw, ry);
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.4);
      setText(doc, INK);
      doc.text(wrapped[i], bx, ry + 4.2);
      doc.setFont("helvetica", "bold");
      setText(doc, NAVY);
      doc.text(money(row.amount), amountX, ry + 4.2, { align: "right" });
      ry += h;
    });
  });
};

/** Totals block: subtotal → discount → rush → VAT → total, then paid/balance. */
const totalsCard = (doc: jsPDF, x: number, y: number, w: number, data: ReceiptPDFData) => {
  const rows: [string, string, boolean][] = [["Subtotal", peso(data.subtotal), false]];
  if (data.discount > 0) rows.push(["Discount", `- ${peso(data.discount)}`, false]);
  if (data.rushFee > 0) rows.push(["Rush Fee (10%)", peso(data.rushFee), false]);
  if (data.vat > 0) rows.push(["VAT (12%)", peso(data.vat), false]);
  rows.push(["Total", peso(data.finalCost), true]);
  rows.push(["Amount Paid", peso(data.paid), false]);

  const rowH = 5.4;
  const h = 6 + rows.length * rowH + 12;
  card(doc, x, y, w, h);

  const rightX = x + w - 4;
  let ry = y + 7;
  rows.forEach(([label, value, strong]) => {
    doc.setFont("helvetica", strong ? "bold" : "normal");
    doc.setFontSize(strong ? 9 : 8.4);
    setText(doc, strong ? NAVY : MUTED);
    doc.text(label, x + 4, ry);
    doc.setFont("helvetica", "bold");
    setText(doc, strong ? NAVY : INK);
    doc.text(value, rightX, ry, { align: "right" });
    ry += rowH;
  });

  // Balance due strip
  const stripY = y + h - 11;
  setFill(doc, data.balance > 0 ? [252, 240, 240] : [237, 247, 240]);
  setDraw(doc, BORDER);
  doc.setLineWidth(0.35);
  doc.roundedRect(x + 3, stripY, w - 6, 9, 1.6, 1.6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.6);
  setText(doc, data.balance > 0 ? [176, 40, 48] : [22, 110, 62]);
  doc.text("BALANCE DUE", x + 6, stripY + 6);
  doc.text(peso(data.balance), rightX - 3, stripY + 6, { align: "right" });

  return y + h;
};

/** Recorded payments, newest last, with method and reference. */
const paymentsCard = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  payments: ReceiptPayment[],
) => {
  const rows = payments.length ? payments : [];
  const rowH = 5.2;
  const bodyH = 6 + Math.max(1, rows.length) * rowH;
  const amountX = x + w - 4;

  return titledCard(doc, x, y, w, "Payments Received", "money", bodyH, (bx, by, bw) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4);
    setText(doc, MUTED);
    doc.text("DATE", bx, by + 2.4);
    doc.text("PAYMENT", bx + 24, by + 2.4);
    doc.text("AMOUNT", amountX, by + 2.4, { align: "right" });
    setDraw(doc, BORDER);
    doc.setLineWidth(0.35);
    doc.line(bx, by + 4.2, bx + bw, by + 4.2);

    if (!rows.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.2);
      setText(doc, MUTED);
      doc.text("No payment recorded yet.", bx, by + 9);
      return;
    }

    let ry = by + 8.6;
    rows.forEach((p) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setText(doc, MUTED);
      doc.text(dateLabel(p.date), bx, ry);
      setText(doc, INK);
      const label = [p.type, p.method].filter(Boolean).join(" · ");
      doc.text(doc.splitTextToSize(label, bw - 52)[0] ?? label, bx + 24, ry);
      doc.setFont("helvetica", "bold");
      setText(doc, NAVY);
      doc.text(money(p.amount), amountX, ry, { align: "right" });
      ry += rowH;
    });
  });
};

const signatureBlock = (doc: jsPDF, y: number) => {
  const w = 70;
  const x = M + CONTENT_W - w;
  setDraw(doc, BORDER);
  doc.setLineWidth(0.4);
  doc.line(x, y + 10, x + w, y + 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  setText(doc, NAVY);
  doc.text("CLIENT PRINTED NAME AND SIGNATURE", x + w / 2, y + 14, { align: "center" });
  return y + 16;
};

const drawQr = (doc: jsPDF, qr: string) => {
  if (!qr) return;
  const s = 22;
  const x = M + CONTENT_W - s;
  const y = 6;
  try {
    doc.addImage(qr, "PNG", x, y, s, s);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    setText(doc, MUTED);
    doc.text("SCAN TO TRACK", x + s / 2, y + s + 2.6, { align: "center" });
  } catch {
    /* QR optional */
  }
};

export const generateReceiptPDF = async (data: ReceiptPDFData): Promise<Blob> => {
  const doc = new jsPDF({ format: "letter", unit: "mm" });

  let logo = "";
  try {
    logo = await getLogoDataUrl();
  } catch {
    /* proceed without logo */
  }

  let qr = "";
  if (data.trackUrl) {
    try {
      qr = await QRCode.toDataURL(data.trackUrl, { width: 320, margin: 0 });
    } catch {
      qr = "";
    }
  }

  let y = drawLetterhead(doc, logo, "Service Invoice - Receipt");
  drawQr(doc, qr);

  y = drawMetaCard(
    doc,
    y,
    [
      ["person", "Received By:", maskStaffName(data.receivedBy)],
      ["person", "Admin Representative/s:", maskStaffName(data.adminRep ?? "")],
      ["wrench", "Technician/s:", maskStaffName(data.technician ?? "")],
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
      ["Name:", data.clientName],
      ["Phone:", data.phone],
      ["Email:", data.email],
      ["Address:", data.address],
    ],
    1,
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
    1,
  );

  y = Math.max(clientBottom, deviceBottom) + 3.5;

  y = linesCard(doc, M, y, CONTENT_W, data.lines) + 3.5;

  const payBottom = paymentsCard(doc, leftX, y, COL_W, data.payments);
  const totalsBottom = totalsCard(doc, rightX, y, COL_W, data);
  y = Math.max(payBottom, totalsBottom) + 4;

  const limit = PAGE_H - 52;
  signatureBlock(doc, Math.min(y, limit));

  drawFooter(doc, DISCLAIMER);

  return doc.output("blob");
};
