import jsPDF from "jspdf";
import { getLogoDataUrl } from "./pdfAssets";
import { formatPdfTimestamp, maskStaffName } from "./utils";

/**
 * A5 Warranty Card. Deliberately kept standalone from `pdfPremiumKit` (which is
 * hard-wired to the Letter page box) while reusing the same visual language:
 * navy headings, hairline cards, accent rule under the title.
 */

const NAVY: [number, number, number] = [15, 38, 92];
const ACCENT: [number, number, number] = [30, 91, 198];
const INK: [number, number, number] = [38, 45, 58];
const MUTED: [number, number, number] = [120, 132, 150];
const BORDER: [number, number, number] = [220, 227, 238];
const WHITE: [number, number, number] = [255, 255, 255];

const PAGE_W = 148;
const PAGE_H = 210;
const M = 10;
const CONTENT_W = PAGE_W - M * 2;

const CONTACT = "0945 647 9905  ·  actechrepairph@gmail.com  ·  actechrepairph.com";

export interface WarrantyLine {
  label: string;
  amount: number;
  term: string;
}

export interface WarrantyCardData {
  serviceId: string;
  timestamp: string;
  clientName: string;
  phone: string;
  email: string;
  deviceType: string;
  brand: string;
  model: string;
  serial: string;
  color: string;
  memory: string;
  lines: WarrantyLine[];
  total: number;
  /** Staff who processed the payment / release. */
  releasedBy: string;
}

const COVERAGE = [
  "Warranty covers only the specific service(s) listed above, starting on the release date.",
  "Warranty is void on physical or liquid damage, tampering, unauthorized repair, or removal of service seals.",
  "This card must be presented together with a valid ID when claiming any warranty service.",
  "Software issues, data loss, and consumable parts are not covered unless stated in the term.",
];

const setFill = (doc: jsPDF, c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
const setDraw = (doc: jsPDF, c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
const setText = (doc: jsPDF, c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);

const money = (n: number) =>
  (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const card = (doc: jsPDF, x: number, y: number, w: number, h: number) => {
  setFill(doc, WHITE);
  setDraw(doc, BORDER);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
};

const sectionTitle = (doc: jsPDF, x: number, y: number, w: number, title: string) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setText(doc, NAVY);
  doc.text(title.toUpperCase(), x, y);
  setDraw(doc, BORDER);
  doc.setLineWidth(0.35);
  doc.line(x, y + 1.8, x + w, y + 1.8);
  return y + 6;
};

const labelValue = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  labelW: number,
) => {
  doc.setFontSize(7.6);
  doc.setFont("helvetica", "bold");
  setText(doc, NAVY);
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  setText(doc, INK);
  const lines = doc.splitTextToSize(value || "N/A", Math.max(10, w - labelW));
  doc.text(lines, x + labelW, y);
  return Math.max(4.2, lines.length * 3.3);
};

export const generateWarrantyCardPDF = async (data: WarrantyCardData): Promise<Blob> => {
  const doc = new jsPDF({ format: "a5", unit: "mm" });

  let logo = "";
  try {
    logo = await getLogoDataUrl();
  } catch {
    /* logo optional */
  }

  // ------------------------------------------------------------ letterhead
  const BOX = 40;
  const TOP_FRAC = 0.2769;
  const BOTTOM_FRAC = 0.6741;
  const boxY = 3 - TOP_FRAC * BOX;
  try {
    if (logo) doc.addImage(logo, "PNG", (PAGE_W - BOX) / 2, boxY, BOX, BOX);
  } catch {
    /* logo optional */
  }
  let y = boxY + BOTTOM_FRAC * BOX + 3.6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.6);
  setText(doc, INK);
  doc.text(
    "AC TECH REPAIR INC. | UNIT 103, 1ST FLOOR, FBR ARCADE, KATIPUNAN AVE, QUEZON CITY",
    PAGE_W / 2,
    y,
    { align: "center" },
  );
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setText(doc, NAVY);
  doc.text("WARRANTY CARD", PAGE_W / 2, y, { align: "center" });
  y += 1.8;
  setDraw(doc, ACCENT);
  doc.setLineWidth(0.7);
  doc.line(PAGE_W / 2 - 24, y, PAGE_W / 2 + 24, y);
  y += 6;

  // ------------------------------------------------------------- meta card
  const metaH = 15;
  card(doc, M, y, CONTENT_W, metaH);
  let my = y + 5.4;
  labelValue(doc, M + 3, my, CONTENT_W / 2 - 6, "Service ID:", data.serviceId, 18);
  labelValue(
    doc,
    M + CONTENT_W / 2,
    my,
    CONTENT_W / 2 - 6,
    "Released:",
    formatPdfTimestamp(data.timestamp),
    17,
  );
  my += 5;
  labelValue(doc, M + 3, my, CONTENT_W / 2 - 6, "Released By:", maskStaffName(data.releasedBy), 18);
  labelValue(doc, M + CONTENT_W / 2, my, CONTENT_W / 2 - 6, "Total Paid:", `PHP ${money(data.total)}`, 17);
  y += metaH + 4;

  // -------------------------------------------------------- client / device
  y = sectionTitle(doc, M, y, CONTENT_W, "Client and Device");
  const halfW = CONTENT_W / 2 - 2;
  let ly = y;
  ly += labelValue(doc, M, ly, halfW, "Name:", data.clientName, 14);
  ly += labelValue(doc, M, ly, halfW, "Phone:", data.phone, 14);
  ly += labelValue(doc, M, ly, halfW, "Email:", data.email, 14);
  let ry = y;
  ry += labelValue(doc, M + CONTENT_W / 2 + 2, ry, halfW, "Device:", `${data.brand} ${data.model}`.trim(), 15);
  ry += labelValue(doc, M + CONTENT_W / 2 + 2, ry, halfW, "Serial:", data.serial, 15);
  ry += labelValue(
    doc,
    M + CONTENT_W / 2 + 2,
    ry,
    halfW,
    "Details:",
    [data.deviceType, data.color, data.memory].filter(Boolean).join(" · "),
    15,
  );
  y = Math.max(ly, ry) + 3;

  // ----------------------------------------------------- covered services
  y = sectionTitle(doc, M, y, CONTENT_W, "Covered Services");
  const rows = data.lines.length ? data.lines : [];
  const amountX = M + CONTENT_W - 22;
  const termX = M + CONTENT_W;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  setText(doc, MUTED);
  doc.text("SERVICE", M, y);
  doc.text("AMOUNT", amountX, y, { align: "right" });
  doc.text("WARRANTY", termX, y, { align: "right" });
  y += 1.6;
  setDraw(doc, BORDER);
  doc.setLineWidth(0.3);
  doc.line(M, y, M + CONTENT_W, y);
  y += 4;

  if (!rows.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    setText(doc, MUTED);
    doc.text("No approved service lines on this ticket.", M, y);
    y += 5;
  }

  rows.forEach((row, i) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    setText(doc, INK);
    const nameLines = doc.splitTextToSize(row.label || "Service", CONTENT_W - 52);
    doc.text(nameLines, M, y);
    doc.setFont("helvetica", "bold");
    setText(doc, NAVY);
    doc.text(money(row.amount), amountX, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    setText(doc, ACCENT);
    doc.text(doc.splitTextToSize(row.term || "No warranty", 26), termX, y, { align: "right" });
    const h = Math.max(5, nameLines.length * 3.3 + 1.6);
    y += h;
    if (i < rows.length - 1) {
      setDraw(doc, BORDER);
      doc.setLineWidth(0.2);
      doc.line(M, y - 2, M + CONTENT_W, y - 2);
    }
  });

  y += 2;

  // -------------------------------------------------------------- coverage
  y = sectionTitle(doc, M, y, CONTENT_W, "Terms of Coverage");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  setText(doc, MUTED);
  COVERAGE.forEach((note) => {
    const lines = doc.splitTextToSize(`•  ${note}`, CONTENT_W);
    doc.text(lines, M, y);
    y += lines.length * 2.9 + 1;
  });

  // ------------------------------------------------------------ signatures
  const sigY = PAGE_H - 30;
  const sigW = CONTENT_W / 2 - 6;
  setDraw(doc, BORDER);
  doc.setLineWidth(0.4);
  doc.line(M, sigY, M + sigW, sigY);
  doc.line(M + CONTENT_W - sigW, sigY, M + CONTENT_W, sigY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.6);
  setText(doc, NAVY);
  doc.text("RELEASED BY", M + sigW / 2, sigY + 3.4, { align: "center" });
  doc.text("RECEIVED BY (CLIENT)", M + CONTENT_W - sigW / 2, sigY + 3.4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.4);
  setText(doc, MUTED);
  doc.text(maskStaffName(data.releasedBy) || "—", M + sigW / 2, sigY + 6.6, { align: "center" });
  doc.text(data.clientName || "—", M + CONTENT_W - sigW / 2, sigY + 6.6, { align: "center" });

  // ------------------------------------------------------------ footer bar
  const barH = 9;
  setFill(doc, NAVY);
  doc.rect(0, PAGE_H - barH, PAGE_W, barH, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.4);
  setText(doc, WHITE);
  doc.text(CONTACT, PAGE_W / 2, PAGE_H - barH / 2 + 1, { align: "center" });

  return doc.output("blob");
};
