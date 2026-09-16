import jsPDF from "jspdf";
import { getLogoDataUrl } from "./pdfAssets";

/**
 * A4 commission payslip for service-based employees. Kept standalone from
 * `pdfPremiumKit` (hard-wired to Letter) while reusing the same visual language:
 * navy headings, hairline cards, accent rule under the title.
 */

const NAVY: [number, number, number] = [15, 38, 92];
const ACCENT: [number, number, number] = [30, 91, 198];
const INK: [number, number, number] = [38, 45, 58];
const MUTED: [number, number, number] = [120, 132, 150];
const BORDER: [number, number, number] = [220, 227, 238];
const SOFT: [number, number, number] = [244, 247, 252];
const WHITE: [number, number, number] = [255, 255, 255];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 14;
const CONTENT_W = PAGE_W - M * 2;

const CONTACT = "0945 647 9905  ·  actechrepairph@gmail.com  ·  actechrepairph.com";

export interface PayslipRow {
  completedDate: string;
  serviceId: string;
  clientName: string;
  amount: number;
}

export interface DeductionLine {
  description: string;
  amount: number;
}

export interface AttendanceSummary {
  daysPresent: number;
  workdays: number;
  hours: number;
  dailyRate: number;
  monthlySalary: number;
  gross: number;
  pagibig: number;
  sss: number;
  philhealth: number;
  otherDeductions: number;
}

export interface PayslipData {
  employeeName: string;
  department?: string;
  /** e.g. "September 1 - 15, 2026" */
  cutoffLabel: string;
  /** e.g. "15th Salary" */
  periodLabel: string;
  rows: PayslipRow[];
  total: number;
  preparedBy?: string;
  generatedAt: string;
  /** Extra deductions captured on the disbursement screen. */
  deductionLines?: DeductionLine[];
  /** Present for fixed-salary staff: replaces the ticket breakdown. */
  attendance?: AttendanceSummary;
  /** Overrides the document title. */
  title?: string;
}

const setFill = (doc: jsPDF, c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
const setDraw = (doc: jsPDF, c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
const setText = (doc: jsPDF, c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);

const money = (n: number) =>
  `Php ${(Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const card = (doc: jsPDF, x: number, y: number, w: number, h: number, fill = WHITE) => {
  setFill(doc, fill);
  setDraw(doc, BORDER);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
};

const drawHeader = (doc: jsPDF, logo: string) => {
  const BOX = 52;
  const TOP_FRAC = 0.2769;
  const BOTTOM_FRAC = 0.6741;
  const boxY = 5 - TOP_FRAC * BOX;
  try {
    if (logo) doc.addImage(logo, "PNG", (PAGE_W - BOX) / 2, boxY, BOX, BOX);
  } catch {
    /* logo optional */
  }
  let y = boxY + BOTTOM_FRAC * BOX + 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  setText(doc, INK);
  doc.text(
    "AC TECH REPAIR INC. | UNIT 103, 1ST FLOOR, FBR ARCADE, KATIPUNAN AVE, QUEZON CITY",
    PAGE_W / 2,
    y,
    { align: "center" },
  );
  y += 3.8;
  setText(doc, MUTED);
  doc.text("MONDAY TO SATURDAY (10:00 AM - 7:00 PM)", PAGE_W / 2, y, { align: "center" });

  y += 11;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  setText(doc, NAVY);
  const title = "COMMISSION PAYSLIP";
  doc.text(title, PAGE_W / 2, y, { align: "center" });
  y += 2;
  setDraw(doc, ACCENT);
  doc.setLineWidth(0.7);
  const half = doc.getTextWidth(title) / 2;
  doc.line(PAGE_W / 2 - half, y, PAGE_W / 2 + half, y);

  return y + 8;
};

const drawFooterBar = (doc: jsPDF) => {
  const barH = 10;
  const barY = PAGE_H - barH;
  setFill(doc, NAVY);
  doc.rect(0, barY, PAGE_W, barH, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  setText(doc, WHITE);
  doc.text(CONTACT, PAGE_W / 2, barY + barH / 2 + 1.2, { align: "center" });
};

const drawMeta = (doc: jsPDF, y: number, data: PayslipData) => {
  const h = 24;
  card(doc, M, y, CONTENT_W, h);
  const leftX = M + 5;
  const rightX = M + CONTENT_W / 2 + 3;

  const row = (x: number, ry: number, label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4);
    setText(doc, MUTED);
    doc.text(label.toUpperCase(), x, ry);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(doc, INK);
    doc.text(value || "-", x, ry + 4.4);
  };

  row(leftX, y + 6.5, "Employee", data.employeeName);
  row(leftX, y + 15.5, "Department", data.department || "Service Based");
  row(rightX, y + 6.5, "Cut-off Period", data.cutoffLabel);
  row(rightX, y + 15.5, "Payout Schedule", data.periodLabel);

  return y + h + 5;
};

const drawTotalBanner = (doc: jsPDF, y: number, total: number, count: number) => {
  const h = 17;
  card(doc, M, y, CONTENT_W, h, SOFT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  setText(doc, MUTED);
  doc.text("TOTAL ALLOCATED COMMISSION", M + 5, y + 6.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setText(doc, NAVY);
  doc.text(money(total), M + 5, y + 13.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setText(doc, MUTED);
  doc.text(`${count} completed ticket${count === 1 ? "" : "s"}`, M + CONTENT_W - 5, y + 11.5, {
    align: "right",
  });
  return y + h + 6;
};

const COLS = [
  { key: "date", label: "Completed Date", w: 34, align: "left" as const },
  { key: "id", label: "Service ID", w: 38, align: "left" as const },
  { key: "client", label: "Client Name", w: 62, align: "left" as const },
  { key: "amount", label: "Allocated Commission", w: CONTENT_W - 34 - 38 - 62, align: "right" as const },
];

const drawTableHead = (doc: jsPDF, y: number) => {
  const h = 8;
  setFill(doc, NAVY);
  doc.rect(M, y, CONTENT_W, h, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.6);
  setText(doc, WHITE);
  let x = M;
  COLS.forEach((c) => {
    const tx = c.align === "right" ? x + c.w - 3 : x + 3;
    doc.text(c.label.toUpperCase(), tx, y + h / 2 + 1.2, { align: c.align });
    x += c.w;
  });
  return y + h;
};

const drawRow = (doc: jsPDF, y: number, r: PayslipRow, zebra: boolean) => {
  const h = 7.6;
  if (zebra) {
    setFill(doc, SOFT);
    doc.rect(M, y, CONTENT_W, h, "F");
  }
  setDraw(doc, BORDER);
  doc.setLineWidth(0.25);
  doc.line(M, y + h, M + CONTENT_W, y + h);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  setText(doc, INK);
  const values = [r.completedDate || "-", r.serviceId || "-", r.clientName || "-", money(r.amount)];
  let x = M;
  COLS.forEach((c, i) => {
    const maxW = c.w - 6;
    let text = values[i];
    while (text.length > 4 && doc.getTextWidth(text) > maxW) text = text.slice(0, -2);
    if (text !== values[i]) text = `${text}...`;
    if (c.align === "right") {
      doc.setFont("helvetica", "bold");
      doc.text(text, x + c.w - 3, y + h / 2 + 1.2, { align: "right" });
      doc.setFont("helvetica", "normal");
    } else {
      doc.text(text, x + 3, y + h / 2 + 1.2);
    }
    x += c.w;
  });
  return y + h;
};

const drawTableTotal = (doc: jsPDF, y: number, total: number) => {
  const h = 9;
  setFill(doc, SOFT);
  setDraw(doc, BORDER);
  doc.setLineWidth(0.35);
  doc.rect(M, y, CONTENT_W, h, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.6);
  setText(doc, NAVY);
  doc.text("TOTAL", M + 3, y + h / 2 + 1.3);
  doc.text(money(total), M + CONTENT_W - 3, y + h / 2 + 1.3, { align: "right" });
  return y + h + 12;
};

const drawSignature = (doc: jsPDF, y: number, preparedBy?: string) => {
  const lineW = 66;
  const x = M + CONTENT_W - lineW;
  setDraw(doc, INK);
  doc.setLineWidth(0.4);
  doc.line(x, y, x + lineW, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.4);
  setText(doc, NAVY);
  doc.text("AC Tech Finance Management", x + lineW / 2, y + 4.4, { align: "center" });
  if (preparedBy) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4);
    setText(doc, MUTED);
    doc.text(`Prepared by ${preparedBy}`, x + lineW / 2, y + 8.6, { align: "center" });
  }
  return y + 14;
};

/** Draws one employee payslip onto the current page of `doc`. */
const drawPayslip = (doc: jsPDF, logo: string, data: PayslipData) => {
  let y = drawHeader(doc, logo);
  y = drawMeta(doc, y, data);
  y = drawTotalBanner(doc, y, data.total, data.rows.length);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setText(doc, NAVY);
  doc.text("COMMISSION BREAKDOWN", M, y);
  y += 3.5;

  y = drawTableHead(doc, y);

  const bottomLimit = PAGE_H - 34;
  if (!data.rows.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.4);
    setText(doc, MUTED);
    doc.text("No allocated commissions for this cut-off.", M + 3, y + 6);
    y += 11;
  } else {
    data.rows.forEach((r, i) => {
      if (y > bottomLimit) {
        drawFooterBar(doc);
        doc.addPage();
        y = M + 6;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        setText(doc, NAVY);
        doc.text(`${data.employeeName.toUpperCase()} — COMMISSION BREAKDOWN (CONTINUED)`, M, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.6);
        setText(doc, MUTED);
        doc.text(`${data.cutoffLabel} · ${data.periodLabel}`, M, y + 4.2);
        y += 8;
        y = drawTableHead(doc, y);
      }
      y = drawRow(doc, y, r, i % 2 === 1);
    });
  }

  y = drawTableTotal(doc, y, data.total);
  if (y > PAGE_H - 42) {
    drawFooterBar(doc);
    doc.addPage();
    y = M + 10;
  }
  drawSignature(doc, y, data.preparedBy);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  setText(doc, MUTED);
  doc.text(`Generated ${data.generatedAt}`, M, PAGE_H - 14);

  drawFooterBar(doc);
};

/** One payslip, or a multi-page batch when several employees are supplied. */
export const generateCommissionPayslipPdf = async (
  entries: PayslipData[],
): Promise<Uint8Array> => {
  const logo = await getLogoDataUrl().catch(() => "");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  entries.forEach((entry, i) => {
    if (i > 0) doc.addPage();
    drawPayslip(doc, logo, entry);
  });
  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
};
