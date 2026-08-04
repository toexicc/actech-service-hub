import jsPDF from "jspdf";
import { PDFDocument } from "pdf-lib";
import { getLogoDataUrl, getTermsPdfBytes } from "./pdfAssets";
import { formatPdfTimestamp, maskStaffName } from "./utils";

export interface QuotationPDFData {
  serviceId: string;
  timestamp: string;
  adminRep: string;
  technician: string;
  receivingStaff?: string;
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
  serviceBreakdown?: { label: string; amount?: string | number }[];
  isUpdated?: boolean;
}

/* ------------------------------------------------------------------ tokens */

const NAVY: [number, number, number] = [15, 38, 92];
const ACCENT: [number, number, number] = [30, 91, 198];
const INK: [number, number, number] = [38, 45, 58];
const MUTED: [number, number, number] = [120, 132, 150];
const BORDER: [number, number, number] = [220, 227, 238];
const BADGE: [number, number, number] = [234, 240, 251];
const GREEN: [number, number, number] = [206, 238, 214];
const WHITE: [number, number, number] = [255, 255, 255];

const PAGE_W = 215.9;
const PAGE_H = 279.4;
const M = 12;
const CONTENT_W = PAGE_W - M * 2;
const GUTTER = 4;
const COL_W = (CONTENT_W - GUTTER) / 2;

const CONTACT_PHONE = "0945 647 9905";
const CONTACT_EMAIL = "actechrepairph@gmail.com";
const CONTACT_SITE = "https://actechrepairph.com/";

/* ----------------------------------------------------------------- helpers */

const setFill = (doc: jsPDF, c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
const setDraw = (doc: jsPDF, c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
const setText = (doc: jsPDF, c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);

const card = (doc: jsPDF, x: number, y: number, w: number, h: number) => {
  setFill(doc, WHITE);
  setDraw(doc, BORDER);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
};

/** Filled navy header bar with a white icon badge + title. */
const panelHeader = (doc: jsPDF, x: number, y: number, w: number, title: string, glyph: Glyph) => {
  setFill(doc, NAVY);
  doc.roundedRect(x, y, w, 9, 2, 2, "F");
  setFill(doc, NAVY);
  doc.rect(x, y + 6, w, 3, "F");
  iconBadge(doc, x + 3, y + 1.6, 5.8, glyph, true);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setText(doc, WHITE);
  doc.text(title.toUpperCase(), x + 11.5, y + 5.9);
};

type Glyph =
  | "calendar"
  | "ticket"
  | "person"
  | "device"
  | "search"
  | "clipboard"
  | "warning"
  | "wrench"
  | "shield"
  | "note"
  | "phone"
  | "mail"
  | "globe";

/** Rounded badge with a minimal vector glyph. */
const iconBadge = (doc: jsPDF, x: number, y: number, s: number, glyph: Glyph, onNavy = false) => {
  if (onNavy) {
    setFill(doc, WHITE);
    doc.roundedRect(x, y, s, s, 1.2, 1.2, "F");
    setDraw(doc, NAVY);
  } else {
    setFill(doc, BADGE);
    doc.roundedRect(x, y, s, s, 1.2, 1.2, "F");
    setDraw(doc, NAVY);
  }
  doc.setLineWidth(0.3);
  drawGlyph(doc, x, y, s, glyph);
};

const drawGlyph = (doc: jsPDF, x: number, y: number, s: number, glyph: Glyph) => {
  const p = s * 0.24; // padding
  const gx = x + p;
  const gy = y + p;
  const gw = s - p * 2;
  const gh = s - p * 2;
  setFill(doc, NAVY);

  switch (glyph) {
    case "calendar": {
      doc.rect(gx, gy + gh * 0.15, gw, gh * 0.85);
      doc.setLineWidth(0.45);
      doc.line(gx, gy + gh * 0.42, gx + gw, gy + gh * 0.42);
      doc.setLineWidth(0.3);
      doc.line(gx + gw * 0.25, gy, gx + gw * 0.25, gy + gh * 0.25);
      doc.line(gx + gw * 0.75, gy, gx + gw * 0.75, gy + gh * 0.25);
      break;
    }
    case "ticket":
    case "clipboard": {
      doc.rect(gx + gw * 0.12, gy + gh * 0.12, gw * 0.76, gh * 0.88);
      doc.rect(gx + gw * 0.32, gy, gw * 0.36, gh * 0.18, "F");
      doc.line(gx + gw * 0.28, gy + gh * 0.45, gx + gw * 0.72, gy + gh * 0.45);
      doc.line(gx + gw * 0.28, gy + gh * 0.65, gx + gw * 0.72, gy + gh * 0.65);
      break;
    }
    case "note": {
      doc.rect(gx + gw * 0.1, gy, gw * 0.8, gh);
      doc.line(gx + gw * 0.25, gy + gh * 0.3, gx + gw * 0.75, gy + gh * 0.3);
      doc.line(gx + gw * 0.25, gy + gh * 0.55, gx + gw * 0.75, gy + gh * 0.55);
      doc.line(gx + gw * 0.25, gy + gh * 0.78, gx + gw * 0.6, gy + gh * 0.78);
      break;
    }
    case "person": {
      doc.circle(gx + gw / 2, gy + gh * 0.28, gw * 0.22, "F");
      doc.roundedRect(gx + gw * 0.12, gy + gh * 0.58, gw * 0.76, gh * 0.42, gw * 0.2, gw * 0.2, "F");
      break;
    }
    case "device": {
      doc.roundedRect(gx + gw * 0.22, gy, gw * 0.56, gh, gw * 0.12, gw * 0.12);
      doc.line(gx + gw * 0.4, gy + gh * 0.87, gx + gw * 0.6, gy + gh * 0.87);
      break;
    }
    case "search": {
      doc.circle(gx + gw * 0.42, gy + gh * 0.4, gw * 0.3);
      doc.setLineWidth(0.45);
      doc.line(gx + gw * 0.66, gy + gh * 0.64, gx + gw, gy + gh);
      break;
    }
    case "warning": {
      doc.triangle(gx + gw / 2, gy, gx, gy + gh, gx + gw, gy + gh);
      setFill(doc, WHITE);
      doc.rect(gx + gw * 0.45, gy + gh * 0.4, gw * 0.1, gh * 0.3, "F");
      doc.rect(gx + gw * 0.45, gy + gh * 0.78, gw * 0.1, gh * 0.1, "F");
      break;
    }
    case "wrench": {
      doc.setLineWidth(0.55);
      doc.line(gx + gw * 0.25, gy + gh * 0.8, gx + gw * 0.8, gy + gh * 0.25);
      doc.setLineWidth(0.3);
      doc.circle(gx + gw * 0.18, gy + gh * 0.86, gw * 0.16);
      doc.circle(gx + gw * 0.85, gy + gh * 0.18, gw * 0.16);
      break;
    }
    case "shield": {
      doc.lines(
        [
          [gw, 0],
          [0, gh * 0.45],
          [-gw / 2, gh * 0.55],
          [-gw / 2, -gh * 0.55],
          [0, -gh * 0.45],
        ],
        gx,
        gy,
      );
      break;
    }
    case "phone": {
      doc.roundedRect(gx + gw * 0.15, gy + gh * 0.15, gw * 0.7, gh * 0.7, gw * 0.25, gw * 0.25, "F");
      break;
    }
    case "mail": {
      doc.rect(gx, gy + gh * 0.2, gw, gh * 0.6);
      doc.line(gx, gy + gh * 0.2, gx + gw / 2, gy + gh * 0.55);
      doc.line(gx + gw, gy + gh * 0.2, gx + gw / 2, gy + gh * 0.55);
      break;
    }
    case "globe": {
      doc.circle(gx + gw / 2, gy + gh / 2, gw / 2);
      doc.line(gx, gy + gh / 2, gx + gw, gy + gh / 2);
      doc.ellipse(gx + gw / 2, gy + gh / 2, gw * 0.22, gh / 2);
      break;
    }
  }
};

const dottedRule = (doc: jsPDF, x1: number, y: number, x2: number) => {
  setDraw(doc, BORDER);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([0.7, 0.8], 0);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0);
};

/** label + value pair; label navy bold, value ink. Returns height used. */
const labelValue = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  labelW: number,
  valueColor: [number, number, number] = INK,
) => {
  doc.setFontSize(7.6);
  doc.setFont("helvetica", "bold");
  setText(doc, NAVY);
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  setText(doc, valueColor);
  const lines = doc.splitTextToSize(value || "N/A", Math.max(10, w - labelW));
  doc.text(lines, x + labelW, y);
  return Math.max(4.4, lines.length * 3.4);
};

/* ------------------------------------------------------- diagnosis parsing */

const cleanDiagnosisText = (text: string): string => {
  if (!text || text === "N/A") return "N/A";
  let cleaned = text;

  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]/gu, "");
  cleaned = cleaned.replace(/[📱💻🔧🔍👤❗⚠️✅💡📋]/g, "");

  const headersToRemove = [
    /Customer Name:.*$/gm,
    /Device Type:.*$/gm,
    /^Model:.*$/gm,
    /Service ID:.*$/gm,
    /^Technician:.*$/gm,
    /AC TECH DEVICE DIAGNOSIS/g,
  ];
  for (const pattern of headersToRemove) cleaned = cleaned.replace(pattern, "");

  // Drop the internal service breakdown / proceed CTA blocks only.
  for (const marker of ["Service Breakdown:", "SERVICE BREAKDOWN:"]) {
    const idx = cleaned.indexOf(marker);
    if (idx > -1) cleaned = cleaned.substring(0, idx);
  }

  cleaned = cleaned.replace(/[#*_`]/g, "");
  cleaned = cleaned.replace(/-{3,}/g, "");

  cleaned = cleaned
    .split("\n")
    .map((line) => {
      const matches = line.match(/\b\w\s+\w/g);
      if (matches && matches.length > 3) return line.replace(/(\w)\s+(?=\w)/g, "$1");
      return line;
    })
    .join("\n");

  cleaned = cleaned.replace(/ {2,}/g, " ");
  cleaned = cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");

  return cleaned.trim();
};

const SECTION_GLYPHS: { test: RegExp; glyph: Glyph }[] = [
  { test: /finding/i, glyph: "clipboard" },
  { test: /cause|issue/i, glyph: "warning" },
  { test: /solution|repair plan/i, glyph: "wrench" },
  { test: /recommend/i, glyph: "shield" },
  { test: /warrant/i, glyph: "shield" },
  { test: /note/i, glyph: "note" },
  { test: /summary/i, glyph: "search" },
];

interface Block {
  h: number;
  gapBefore: number;
  draw: (x: number, y: number, w: number) => void;
  keepWithNext?: boolean;
}

const isSectionHeader = (line: string) =>
  /:$/.test(line) &&
  line.length < 70 &&
  /finding|cause|issue|solution|recommend|note|summary|warrant|observ/i.test(line);

const buildDiagnosisBlocks = (
  doc: jsPDF,
  raw: string,
  innerW: number,
  scale = 1,
): Block[] => {
  const BODY = 7.2 * scale;
  const HEAD = 7.8 * scale;
  const LEAD = 3.15 * scale;
  const cleaned = cleanDiagnosisText(raw);
  const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
  const blocks: Block[] = [];
  let first = true;

  for (const line of lines) {
    if (isSectionHeader(line)) {
      const upper = /^[A-Z\s&/]+:$/.test(line);
      const glyph = SECTION_GLYPHS.find((g) => g.test.test(line))?.glyph ?? "clipboard";
      const label = line.replace(/:$/, "");
      const gapBefore = first ? 0 : 3.6 * scale;
      first = false;

      if (upper) {
        // Section band (IMPORTANT NOTE, SUMMARY)
        blocks.push({
          h: 5.4 * scale,
          gapBefore,
          keepWithNext: true,
          draw: (x, y, w) => {
            dottedRule(doc, x, y - 2.4, x + w);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(HEAD);
            setText(doc, NAVY);
            doc.text(label.toUpperCase() + ":", x, y + 2.6);
          },
        });
      } else {
        blocks.push({
          h: 6.2 * scale,
          gapBefore,
          keepWithNext: true,
          draw: (x, y, w) => {
            dottedRule(doc, x, y - 2.2, x + w);
            iconBadge(doc, x, y, 5.6, glyph);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(HEAD);
            setText(doc, ACCENT);
            doc.text(label + ":", x + 7.6, y + 4);
          },
        });
      }
      continue;
    }

    first = false;
    const bulletMatch = line.match(/^([-•·*]|\d+[.)])\s+(.*)$/);
    if (bulletMatch) {
      const body = bulletMatch[2];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(BODY);
      const wrapped = doc.splitTextToSize(body, innerW - 3.4);
      blocks.push({
        h: wrapped.length * LEAD + 0.8,
        gapBefore: 0.6,
        draw: (x, y) => {
          setFill(doc, ACCENT);
          doc.circle(x + 1, y + 1.15, 0.55, "F");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(BODY);
          setText(doc, INK);
          doc.text(wrapped, x + 3.4, y + 2);
        },
      });
      continue;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY);
    const wrapped = doc.splitTextToSize(line, innerW);
    blocks.push({
      h: wrapped.length * LEAD,
      gapBefore: 0.6,
      draw: (x, y) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(BODY);
        setText(doc, INK);
        doc.text(wrapped, x, y + 2);
      },
    });
  }

  if (blocks.length === 0) {
    blocks.push({
      h: 5,
      gapBefore: 0,
      draw: (x, y) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(BODY);
        setText(doc, MUTED);
        doc.text("N/A", x, y + 2);
      },
    });
  }
  return blocks;
};

/* --------------------------------------------------------------- sections */

const drawLetterhead = (doc: jsPDF, logo: string, isUpdated?: boolean) => {
  // The source logo PNG has large transparent padding (content sits between
  // 27.7% and 67.4% of its height). Draw it oversized with a negative offset so
  // the visible mark sits tight against the top margin without empty space.
  const BOX = 58;
  const TOP_FRAC = 0.2769;
  const BOTTOM_FRAC = 0.6741;
  const contentTop = 4;
  const boxY = contentTop - TOP_FRAC * BOX;
  try {
    doc.addImage(logo, "PNG", (PAGE_W - BOX) / 2, boxY, BOX, BOX);
  } catch {
    /* logo optional */
  }
  let y = boxY + BOTTOM_FRAC * BOX + 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
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

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  setText(doc, NAVY);
  doc.text("SERVICE QUOTATION FORM", PAGE_W / 2, y, { align: "center" });

  y += 2;
  setDraw(doc, ACCENT);
  doc.setLineWidth(0.7);
  doc.line(PAGE_W / 2 - 32, y, PAGE_W / 2 + 32, y);

  if (isUpdated) {
    y += 5;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 40, 55);
    doc.text("*** UPDATED VERSION ***", PAGE_W / 2, y, { align: "center" });
  }

  return y + 4;
};

const drawMetaCard = (doc: jsPDF, y: number, data: QuotationPDFData) => {
  const rows: [Glyph, string, string][] = [
    ["calendar", "Date and Time:", formatPdfTimestamp(data.timestamp)],
    ["ticket", "Service ID:", data.serviceId],
    ["person", "Admin Representative/s:", maskStaffName(data.adminRep)],
    ["person", "Handling Staff:", maskStaffName(data.receivingStaff)],
    ["wrench", "Technician/s:", maskStaffName(data.technician)],
  ];

  const badgeS = 6;
  const textX = M + 3 + badgeS + 3;
  const labelW = 36;
  const valueW = CONTENT_W - (textX - M) - 6;

  doc.setFontSize(7.6);
  let h = 4.5;
  const heights = rows.map(([, , v]) => {
    const lines = doc.splitTextToSize(v || "N/A", Math.max(20, valueW - labelW));
    return Math.max(4.6, lines.length * 3.4);
  });
  h += heights.reduce((s2, v) => s2 + v, 0) + 2.5;

  card(doc, M, y, CONTENT_W, h);

  let ry = y + 5.4;
  rows.forEach(([glyph, label, value], i) => {
    iconBadge(doc, M + 3, ry - 3.4, badgeS, glyph);
    labelValue(doc, textX, ry, valueW, label, value, labelW, ACCENT);
    ry += heights[i];
  });

  return y + h + 3.5;
};

const drawInfoCards = (doc: jsPDF, y: number, data: QuotationPDFData) => {
  const clientRows: [string, string, string, string][] = [
    ["Client Type:", data.clientType, "Priority:", data.priority],
    ["Name:", data.clientName, "Username:", data.username],
    ["Phone:", data.phone, "Email:", data.email],
  ];
  const deviceRows: [string, string, string, string][] = [
    ["Device Type:", data.deviceType, "Serial No.:", data.serial],
    ["Brand:", data.brand, "Color:", data.color],
    ["Model:", data.model, "Storage:", data.memory],
  ];

  const leftW = (COL_W - 8) * 0.55;
  const rightW = (COL_W - 8) * 0.45;
  const LW1 = 19;
  const LW2 = 17;

  const rowHeights = (rows: [string, string, string, string][]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    return rows.map(([, v1, , v2]) => {
      const a = doc.splitTextToSize(v1 || "N/A", Math.max(10, leftW - LW1)).length;
      const b = doc.splitTextToSize(v2 || "N/A", Math.max(10, rightW - LW2)).length;
      return Math.max(1, a, b) * 3.4 + 1.8;
    });
  };

  const clientH = rowHeights(clientRows);
  const deviceH = rowHeights(deviceRows);
  const bodyH = Math.max(
    clientH.reduce((s, v) => s + v, 0),
    deviceH.reduce((s, v) => s + v, 0),
  );
  const h = 16.5 - 0 + bodyH + 1;

  const drawCard = (
    x: number,
    title: string,
    glyph: Glyph,
    rows: [string, string, string, string][],
    heights: number[],
  ) => {
    card(doc, x, y, COL_W, h);
    iconBadge(doc, x + 3, y + 3.4, 6.2, glyph);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.6);
    setText(doc, NAVY);
    doc.text(title.toUpperCase(), x + 12, y + 8);
    setDraw(doc, BORDER);
    doc.setLineWidth(0.35);
    doc.line(x + 3, y + 11.5, x + COL_W - 3, y + 11.5);

    let ry = y + 16.5;
    rows.forEach(([l1, v1, l2, v2], i) => {
      labelValue(doc, x + 4, ry, leftW, l1, v1, LW1);
      labelValue(doc, x + 4 + leftW, ry, rightW, l2, v2, LW2);
      ry += heights[i];
    });
  };

  drawCard(M, "Client Information", "person", clientRows, clientH);
  drawCard(M + COL_W + GUTTER, "Device Information", "device", deviceRows, deviceH);

  return y + h + 3.5;
};

const drawSummaryBlocks = (doc: jsPDF, data: QuotationPDFData, innerW: number): Block[] => {
  const blocks: Block[] = [];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const summaryLines = doc.splitTextToSize(data.serviceSummary || "N/A", innerW);
  blocks.push({
    h: summaryLines.length * 3.6 + 2,
    gapBefore: 1,
    draw: (x, y) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setText(doc, INK);
      doc.text(summaryLines, x, y + 2.6);
    },
  });

  const money = (label: string, value: string) => {
    blocks.push({
      h: 5.4,
      gapBefore: 1.4,
      draw: (x, y, w) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.2);
        setText(doc, NAVY);
        doc.text(label, x, y + 3.4);
        doc.setFont("helvetica", "normal");
        setText(doc, INK);
        doc.text(`Php ${value}`, x + w * 0.45, y + 3.4);
      },
    });
  };

  blocks.push({
    h: 1,
    gapBefore: 3,
    draw: (x, y, w) => {
      setDraw(doc, BORDER);
      doc.setLineWidth(0.35);
      doc.line(x, y, x + w, y);
    },
  });

  money("Service Cost:", data.serviceCost);
  money("Discount:", data.discount);

  blocks.push({
    h: 10.5,
    gapBefore: 3,
    draw: (x, y, w) => {
      setFill(doc, GREEN);
      doc.roundedRect(x - 1.5, y, w + 3, 10.5, 1.6, 1.6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      setText(doc, NAVY);
      doc.text("Total Cost:", x + 1, y + 6.8);
      doc.setFontSize(12);
      doc.text(`Php ${data.totalCost}`, x + w * 0.45, y + 6.8);
    },
  });

  return blocks;
};

const parseBreakdownFromDiagnosis = (raw?: string): { label: string; amount?: string }[] => {
  if (!raw) return [];
  const marker = raw.search(/service breakdown\s*:/i);
  if (marker < 0) return [];
  const tail = raw.slice(marker);
  const lines = tail.split("\n").slice(1).map((l) => l.trim());
  const out: { label: string; amount?: string }[] = [];
  for (const line of lines) {
    if (!line) {
      if (out.length) break;
      continue;
    }
    if (/^[A-Z][A-Za-z\s&/]*:$/.test(line)) break;
    const cleaned = line.replace(/^([-•·*]|\d+[.)])\s*/, "").replace(/[#*_`]/g, "").trim();
    if (!cleaned) continue;
    const m = cleaned.match(/^(.*?)[\s-–:]*((?:Php|PHP|₱)\s*[^\s].*)$/);
    if (m) out.push({ label: m[1].replace(/[-–:\s]+$/, ""), amount: m[2].trim() });
    else out.push({ label: cleaned });
  }
  return out;
};

const buildBreakdownBlocks = (
  doc: jsPDF,
  data: QuotationPDFData,
  innerW: number,
): Block[] => {
  const items =
    (data.serviceBreakdown && data.serviceBreakdown.length
      ? data.serviceBreakdown.map((i) => ({
          label: i.label,
          amount:
            i.amount === undefined || i.amount === null || i.amount === ""
              ? undefined
              : `${i.amount}`.replace(/^(?!Php|PHP|₱)/, "Php "),
        }))
      : parseBreakdownFromDiagnosis(data.technicianDiagnosis));

  const blocks: Block[] = [];

  if (!items.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    const fallback = doc.splitTextToSize(
      data.serviceSummary || "Service breakdown will be provided with the final quotation.",
      innerW,
    );
    blocks.push({
      h: fallback.length * 3.3 + 2,
      gapBefore: 1,
      draw: (x, y) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.6);
        setText(doc, INK);
        doc.text(fallback, x, y + 2.4);
      },
    });
  } else {
    items.forEach((item, i) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.4);
      const amountW = item.amount ? Math.min(28, doc.getTextWidth(item.amount) + 2) : 0;
      const labelLines = doc.splitTextToSize(item.label, innerW - amountW - 5);
      blocks.push({
        h: Math.max(4.6, labelLines.length * 3.2 + 1.4),
        gapBefore: i === 0 ? 1 : 0.6,
        draw: (x, y, w) => {
          if (i > 0) dottedRule(doc, x, y - 0.6, x + w);
          setFill(doc, ACCENT);
          doc.circle(x + 1, y + 1.9, 0.55, "F");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.4);
          setText(doc, INK);
          doc.text(labelLines, x + 3.4, y + 2.6);
          if (item.amount) {
            doc.setFont("helvetica", "bold");
            setText(doc, NAVY);
            doc.text(item.amount, x + w, y + 2.6, { align: "right" });
          }
        },
      });
    });
  }

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.2);
  const note = doc.splitTextToSize(
    "This is the suggested repair for your service. We will be waiting for your approval.",
    innerW - 4,
  );
  blocks.push({
    h: note.length * 3.2 + 5,
    gapBefore: 3,
    draw: (x, y, w) => {
      setFill(doc, BADGE);
      doc.roundedRect(x - 1.5, y, w + 3, note.length * 3.2 + 5, 1.6, 1.6, "F");
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.2);
      setText(doc, NAVY);
      doc.text(note, x + 1, y + 4);
    },
  });

  return blocks;
};

const drawFooter = (doc: jsPDF) => {
  const barH = 12;
  const barY = PAGE_H - barH;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const disclaimer =
    "This document is automatically generated after the technician completes the final diagnosis and quotation. Once received, please review our Terms and Conditions and send your approval. By submitting the form, you acknowledge that all information provided is accurate and consent to the servicing of your device. Any changes or additional findings will be communicated through your preferred channel of communication.";
  const lines = doc.splitTextToSize(disclaimer, CONTENT_W - 8);
  const boxH = lines.length * 3.1 + 6;
  const boxY = barY - 4 - boxH;
  card(doc, M, boxY, CONTENT_W, boxH);
  setText(doc, MUTED);
  doc.text(lines, M + 4, boxY + 5);

  setFill(doc, NAVY);
  doc.rect(0, barY, PAGE_W, barH, "F");

  const items: [Glyph, string][] = [
    ["phone", CONTACT_PHONE],
    ["mail", CONTACT_EMAIL],
    ["globe", CONTACT_SITE],
  ];
  const slot = PAGE_W / 3;
  items.forEach(([glyph, label], i) => {
    const cx = slot * i + slot / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    const tw = doc.getTextWidth(label);
    const startX = cx - (tw + 8) / 2;
    iconBadge(doc, startX, barY + barH / 2 - 2.6, 5.2, glyph, true);
    setText(doc, WHITE);
    doc.text(label, startX + 7.4, barY + barH / 2 + 1.2);
    if (i < items.length - 1) {
      setDraw(doc, [80, 100, 145]);
      doc.setLineWidth(0.4);
      doc.line(slot * (i + 1), barY + 3, slot * (i + 1), barY + barH - 3);
    }
  });

  return boxY;
};

/** Flow a block list through one or more panel regions, paginating when needed. */
const flowPanel = (
  doc: jsPDF,
  blocks: Block[],
  opts: {
    x: number;
    w: number;
    startY: number;
    bottomLimit: number;
    title: string;
    glyph: Glyph;
    extraRegions?: { x: number; w: number; startY: number; bottomLimit: number; title: string }[];
    onNewPage: () => { startY: number; bottomLimit: number };
  },
): { lastPageBottom: number; pageCount: number } => {
  let { x, w, startY, bottomLimit, title } = opts;
  const queue = [...(opts.extraRegions ?? [])];
  let idx = 0;
  let pageCount = 0;
  let lastBottom = startY;

  while (idx < blocks.length) {
    pageCount += 1;
    const innerX = x + 3.5;
    const innerW = w - 7;
    panelHeader(doc, x, startY, w, title, opts.glyph);
    let y = startY + 9 + 3.5;
    const bodyTop = y;

    while (idx < blocks.length) {
      const b = blocks[idx];
      const nextH = b.keepWithNext && blocks[idx + 1] ? Math.min(blocks[idx + 1].h, 7) : 0;
      const needed = b.gapBefore + b.h + nextH;
      if (y + needed > bottomLimit && y > bodyTop) break;
      y += b.gapBefore;
      b.draw(innerX, y, innerW);
      y += b.h;
      idx += 1;
    }

    const panelH = y + 3.5 - startY;
    setDraw(doc, BORDER);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, startY, w, panelH, 2, 2, "S");
    lastBottom = startY + panelH;

    if (idx < blocks.length) {
      const region = queue.shift();
      if (region) {
        x = region.x;
        w = region.w;
        startY = region.startY;
        bottomLimit = region.bottomLimit;
        title = region.title;
      } else {
        const next = opts.onNewPage();
        startY = next.startY;
        bottomLimit = next.bottomLimit;
      }
    }
  }

  return { lastPageBottom: lastBottom, pageCount };
};

/* -------------------------------------------------------------- generator */

export const drawQuotation = (doc: jsPDF, data: QuotationPDFData, logo: string) => {
  let y = drawLetterhead(doc, logo, data.isUpdated);
  y = drawMetaCard(doc, y, data);
  y = drawInfoCards(doc, y, data);

  const footerReserve = 38;
  const bottomLimit = PAGE_H - footerReserve;

  const leftX = M;
  const rightX = M + COL_W + GUTTER;

  const availableFirstPage = PAGE_H - 38 - y;
  let diagBlocks = buildDiagnosisBlocks(doc, data.technicianDiagnosis, COL_W - 7);
  const totalH = (bs: Block[]) => bs.reduce((t, b) => t + b.gapBefore + b.h, 0) + 14;
  for (const sc of [0.94, 0.88, 0.82, 0.76, 0.7, 0.66]) {
    if (totalH(diagBlocks) <= availableFirstPage) break;
    diagBlocks = buildDiagnosisBlocks(doc, data.technicianDiagnosis, COL_W - 7, sc);
  }
  const sumBlocks = drawSummaryBlocks(doc, data, COL_W - 7);

  const panelTop = y;

  // Right column first so we know the minimum shared height on page 1.
  const summaryResult = flowPanel(doc, sumBlocks, {
    x: rightX,
    w: COL_W,
    startY: panelTop,
    bottomLimit,
    title: "Service Summary",
    glyph: "clipboard",
    onNewPage: () => {
      doc.addPage();
      return { startY: 16, bottomLimit: PAGE_H - footerReserve };
    },
  });

  const breakdownResult = flowPanel(doc, buildBreakdownBlocks(doc, data, COL_W - 7), {
    x: rightX,
    w: COL_W,
    startY: summaryResult.lastPageBottom + 3.5,
    bottomLimit,
    title: "Service Breakdown",
    glyph: "wrench",
    onNewPage: () => {
      doc.addPage();
      return { startY: 16, bottomLimit: PAGE_H - footerReserve };
    },
  });

  const diagResult = flowPanel(doc, diagBlocks, {
    x: leftX,
    w: COL_W,
    startY: panelTop,
    bottomLimit,
    title: "Technician Diagnosis",
    glyph: "search",
    onNewPage: () => {
      doc.addPage();
      return { startY: 16, bottomLimit: PAGE_H - footerReserve };
    },
  });

  // Equalize the two page-1 panels visually by extending the shorter border.
  const rightBottom = Math.max(summaryResult.lastPageBottom, breakdownResult.lastPageBottom);
  const target = Math.max(diagResult.lastPageBottom, rightBottom);
  if (
    diagResult.pageCount === 1 &&
    summaryResult.pageCount === 1 &&
    breakdownResult.pageCount === 1
  ) {
    setDraw(doc, BORDER);
    doc.setLineWidth(0.35);
    doc.roundedRect(leftX, panelTop, COL_W, target - panelTop, 2, 2, "S");
    panelHeader(doc, leftX, panelTop, COL_W, "Technician Diagnosis", "search");
  }

  drawFooter(doc);
};

export const generateQuotationPDF = async (data: QuotationPDFData): Promise<Blob> => {
  const doc = new jsPDF({ format: "letter", unit: "mm" });

  let logo = "";
  try {
    logo = await getLogoDataUrl();
  } catch {
    /* proceed without logo */
  }

  drawQuotation(doc, data, logo);

  const quotationBlob = doc.output("blob");

  try {
    const [quotationPdfBytes, termsPdfBytes] = await Promise.all([
      quotationBlob.arrayBuffer(),
      getTermsPdfBytes(),
    ]);

    const quotationPdfDoc = await PDFDocument.load(quotationPdfBytes);

    if (termsPdfBytes) {
      const termsPdfDoc = await PDFDocument.load(termsPdfBytes);
      const copiedPages = await quotationPdfDoc.copyPages(termsPdfDoc, termsPdfDoc.getPageIndices());
      copiedPages.forEach((page) => quotationPdfDoc.addPage(page));
    }

    const mergedPdfBytes = await quotationPdfDoc.save();
    return new Blob([new Uint8Array(mergedPdfBytes)], { type: "application/pdf" });
  } catch {
    return quotationBlob;
  }
};
