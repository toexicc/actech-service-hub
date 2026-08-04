import jsPDF from "jspdf";

/**
 * Shared drawing primitives for the "premium" AC Tech document layouts
 * (Service Quotation Form, Client Intake Form).
 */

export const NAVY: [number, number, number] = [15, 38, 92];
export const ACCENT: [number, number, number] = [30, 91, 198];
export const INK: [number, number, number] = [38, 45, 58];
export const MUTED: [number, number, number] = [120, 132, 150];
export const BORDER: [number, number, number] = [220, 227, 238];
export const BADGE: [number, number, number] = [234, 240, 251];
export const WHITE: [number, number, number] = [255, 255, 255];

export const PAGE_W = 215.9;
export const PAGE_H = 279.4;
export const M = 12;
export const CONTENT_W = PAGE_W - M * 2;
export const GUTTER = 4;
export const COL_W = (CONTENT_W - GUTTER) / 2;

const CONTACT_PHONE = "0945 647 9905";
const CONTACT_EMAIL = "actechrepairph@gmail.com";
const CONTACT_SITE = "https://actechrepairph.com/";

export type Glyph =
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
  | "money"
  | "clock"
  | "phone"
  | "mail"
  | "globe";

export const setFill = (doc: jsPDF, c: [number, number, number]) =>
  doc.setFillColor(c[0], c[1], c[2]);
export const setDraw = (doc: jsPDF, c: [number, number, number]) =>
  doc.setDrawColor(c[0], c[1], c[2]);
export const setText = (doc: jsPDF, c: [number, number, number]) =>
  doc.setTextColor(c[0], c[1], c[2]);

export const card = (doc: jsPDF, x: number, y: number, w: number, h: number) => {
  setFill(doc, WHITE);
  setDraw(doc, BORDER);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
};

const drawGlyph = (doc: jsPDF, x: number, y: number, s: number, glyph: Glyph) => {
  const p = s * 0.24;
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
    case "money": {
      doc.circle(gx + gw / 2, gy + gh / 2, gw / 2);
      doc.setLineWidth(0.45);
      doc.line(gx + gw * 0.38, gy + gh * 0.24, gx + gw * 0.38, gy + gh * 0.78);
      doc.line(gx + gw * 0.38, gy + gh * 0.24, gx + gw * 0.68, gy + gh * 0.34);
      doc.line(gx + gw * 0.68, gy + gh * 0.34, gx + gw * 0.38, gy + gh * 0.5);
      doc.line(gx + gw * 0.28, gy + gh * 0.62, gx + gw * 0.62, gy + gh * 0.62);
      doc.setLineWidth(0.3);
      break;
    }
    case "clock": {
      doc.circle(gx + gw / 2, gy + gh / 2, gw / 2);
      doc.setLineWidth(0.45);
      doc.line(gx + gw / 2, gy + gh / 2, gx + gw / 2, gy + gh * 0.22);
      doc.line(gx + gw / 2, gy + gh / 2, gx + gw * 0.76, gy + gh * 0.58);
      doc.setLineWidth(0.3);
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

export const iconBadge = (
  doc: jsPDF,
  x: number,
  y: number,
  s: number,
  glyph: Glyph,
  onNavy = false,
) => {
  setFill(doc, onNavy ? WHITE : BADGE);
  doc.roundedRect(x, y, s, s, 1.2, 1.2, "F");
  setDraw(doc, NAVY);
  doc.setLineWidth(0.3);
  drawGlyph(doc, x, y, s, glyph);
};

export const labelValue = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  labelW: number,
  valueColor: [number, number, number] = INK,
  fontSize = 7.6,
) => {
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "bold");
  setText(doc, NAVY);
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  setText(doc, valueColor);
  const lines = doc.splitTextToSize(value || "N/A", Math.max(10, w - labelW));
  doc.text(lines, x + labelW, y);
  return Math.max(4.4, lines.length * 3.4);
};

/** Card with a title row (icon badge + navy heading + rule) and a body callback. */
export const titledCard = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  title: string,
  glyph: Glyph,
  bodyH: number,
  body: (bx: number, by: number, bw: number) => void,
) => {
  const h = 15.5 + bodyH;
  card(doc, x, y, w, h);
  iconBadge(doc, x + 3, y + 3.4, 6.2, glyph);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.6);
  setText(doc, NAVY);
  doc.text(title.toUpperCase(), x + 12, y + 8);
  setDraw(doc, BORDER);
  doc.setLineWidth(0.35);
  doc.line(x + 3, y + 11.5, x + w - 3, y + 11.5);
  body(x + 4, y + 15.5, w - 8);
  return y + h;
};

/** Info card with a configurable column count; values wrap inside their column. */
export const stackedCard = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  title: string,
  glyph: Glyph,
  rows: [string, string][],
  columns = 1,
) => {
  const cols = Math.max(1, columns);
  const colGutter = cols > 1 ? 5 : 0;
  const innerW = w - 8;
  const colW = (innerW - colGutter * (cols - 1)) / cols;

  const perCol = Math.ceil(rows.length / cols);
  const groups: [string, string][][] = [];
  for (let c = 0; c < cols; c++) groups.push(rows.slice(c * perCol, (c + 1) * perCol));

  doc.setFontSize(7.6);
  const measure = (group: [string, string][]) => {
    const labelWidths = group.map(([label]) => {
      doc.setFont("helvetica", "bold");
      return doc.getTextWidth(label) + 1.8;
    });
    const heights = group.map(([, v], i) => {
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(v || "N/A", Math.max(12, colW - labelWidths[i]));
      return Math.max(4.4, lines.length * 3.4) + 0.6;
    });
    return { labelWidths, heights, total: heights.reduce((s, v) => s + v, 0) };
  };
  const measured = groups.map(measure);
  const bodyH = Math.max(0, ...measured.map((m) => m.total));

  return titledCard(doc, x, y, w, title, glyph, bodyH + 2, (bx, by) => {
    groups.forEach((group, c) => {
      const cx = bx + c * (colW + colGutter);
      let ry = by + 1;
      group.forEach(([label, value], i) => {
        labelValue(doc, cx, ry, colW, label, value, measured[c].labelWidths[i]);
        ry += measured[c].heights[i];
      });
    });
  });
};

/** Centered logo + address lines + document title. Returns the next free y. */
export const drawLetterhead = (doc: jsPDF, logo: string, title: string, isUpdated?: boolean) => {
  // The source logo PNG has large transparent padding (content sits between
  // 27.7% and 67.4% of its height); draw oversized with a negative offset.
  const BOX = 58;
  const TOP_FRAC = 0.2769;
  const BOTTOM_FRAC = 0.6741;
  const boxY = 4 - TOP_FRAC * BOX;
  try {
    if (logo) doc.addImage(logo, "PNG", (PAGE_W - BOX) / 2, boxY, BOX, BOX);
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
  doc.text(title.toUpperCase(), PAGE_W / 2, y, { align: "center" });

  y += 2;
  setDraw(doc, ACCENT);
  doc.setLineWidth(0.7);
  const half = Math.min(CONTENT_W / 2, doc.getTextWidth(title.toUpperCase()) / 2 - 6);
  doc.line(PAGE_W / 2 - half, y, PAGE_W / 2 + half, y);

  if (isUpdated) {
    y += 5;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 40, 55);
    doc.text("*** UPDATED VERSION ***", PAGE_W / 2, y, { align: "center" });
  }

  return y + 4;
};

/** Boxed disclaimer + navy contact bar pinned to the bottom of the page. */
export const drawFooter = (doc: jsPDF, disclaimer: string) => {
  const barH = 12;
  const barY = PAGE_H - barH;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
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

/** Two-column meta card: staff rows on the left, reference rows on the right. */
export const drawMetaCard = (
  doc: jsPDF,
  y: number,
  staffRows: [Glyph, string, string][],
  referenceRows: [Glyph, string, string][],
) => {
  const badgeS = 6;
  const innerX = M + 3;
  const innerW = CONTENT_W - 6;
  const metaGutter = 8;
  const leftW = innerW * 0.6;
  const rightW = innerW - leftW - metaGutter;
  const leftTextX = innerX + badgeS + 3;
  const rightX = innerX + leftW + metaGutter;
  const rightTextX = rightX + badgeS + 3;
  const rowH = 5.2;
  const rowCount = Math.max(staffRows.length, referenceRows.length);
  const h = 5 + rowCount * rowH + 2.5;

  card(doc, M, y, CONTENT_W, h);

  let ry = y + 5.4;
  staffRows.forEach(([glyph, label, value]) => {
    iconBadge(doc, innerX, ry - 3.4, badgeS, glyph);
    labelValue(doc, leftTextX, ry, leftW - badgeS - 3, label, value, 36, ACCENT);
    ry += rowH;
  });

  ry = y + 5.4;
  referenceRows.forEach(([glyph, label, value]) => {
    iconBadge(doc, rightX, ry - 3.4, badgeS, glyph);
    labelValue(doc, rightTextX, ry, rightW - badgeS - 3, label, value, 22, ACCENT);
    ry += rowH;
  });

  // Divider between the two columns.
  setDraw(doc, BORDER);
  doc.setLineWidth(0.35);
  doc.line(rightX - metaGutter / 2, y + 3, rightX - metaGutter / 2, y + h - 3);

  return y + h + 3.5;
};
