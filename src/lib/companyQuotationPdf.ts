import jsPDF from "jspdf";
import { getLogoDataUrl } from "./pdfAssets";
import {
  ACCENT, BORDER, BADGE, CONTENT_W, INK, M, MUTED, NAVY, PAGE_H, PAGE_W, WHITE,
  card, drawFooter, drawLetterhead, drawMetaCard, setDraw, setFill, setText,
} from "./pdfPremiumKit";
import { lineAmount, lineUnitPrice, quoteTotals, type QuotePayload } from "./companyQuotation";

const peso = (n: number) =>
  "PHP " + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
};

const DISCLAIMER =
  "*This document is not valid for claim of input tax. Prices are VAT-inclusive where VAT is shown. " +
  "Parts are subject to availability. For queries please contact actechrepairph@gmail.com.";

const FOOTER_RESERVE = 34;

/** Billing statement in the same premium AC Tech layout as the quotation/intake forms. */
export const generateCompanyQuotationPdf = async (quotationNo: string, p: QuotePayload): Promise<Uint8Array> => {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  let logo = "";
  try { logo = await getLogoDataUrl(); } catch { /* optional */ }

  const startPage = () => {
    let y = drawLetterhead(doc, logo, "Billing Statement");
    y = drawMetaCard(
      doc, y,
      [["person", "Customer Name", p.customerName || "N/A"], ["clipboard", "Company Name", p.companyName || "N/A"]],
      [["ticket", "Quotation No.", quotationNo], ["calendar", "Date", fmtDate(p.date)]],
    );
    return y;
  };

  let y = startPage();
  const cols = { no: M + 3, desc: M + 12, price: M + CONTENT_W - 62, qty: M + CONTENT_W - 36, amt: M + CONTENT_W - 3 };
  const descW = cols.price - cols.desc - 6;

  const tableHeader = () => {
    setFill(doc, NAVY);
    doc.roundedRect(M, y, CONTENT_W, 8, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); setText(doc, WHITE);
    doc.text("NO.", cols.no, y + 5.3);
    doc.text("PRODUCT DESCRIPTION", cols.desc, y + 5.3);
    doc.text("PRICE", cols.price, y + 5.3);
    doc.text("QTY", cols.qty, y + 5.3);
    doc.text("AMOUNT", cols.amt, y + 5.3, { align: "right" });
    y += 10;
  };
  const ensure = (h: number, withHeader = true) => {
    if (y + h > PAGE_H - FOOTER_RESERVE) {
      drawFooter(doc, DISCLAIMER);
      doc.addPage();
      // Continuation pages: compact strip instead of the full letterhead.
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); setText(doc, NAVY);
      doc.text(`BILLING STATEMENT · ${quotationNo}`, M, M + 2);
      doc.setFont("helvetica", "normal"); setText(doc, MUTED);
      doc.text(`${p.companyName} · continued`, M + CONTENT_W, M + 2, { align: "right" });
      y = M + 7;
      if (withHeader) tableHeader();
    }
  };

  tableHeader();
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); setText(doc, NAVY);
  doc.text("Diagnosis and Quotation", cols.desc, y + 1); y += 5;

  p.lines.forEach((l, i) => {
    const parts: { t: string; bold?: boolean; color?: [number, number, number] }[] = [];
    parts.push({ t: `Serial Number: ${l.serial || "N/A"}   ·   Model: ${l.model || "N/A"}`, bold: true });
    if (l.serviceId) parts.push({ t: `Ticket: ${l.serviceId}`, color: MUTED });
    parts.push({ t: "Issue(s) reported:", bold: true, color: NAVY });
    parts.push({ t: l.issue || "N/A" });
    if (l.partsRequested) { parts.push({ t: "Part(s) requested:", bold: true, color: NAVY }); parts.push({ t: l.partsRequested }); }
    if (l.solutions.length) {
      parts.push({ t: "Solution:", bold: true, color: NAVY });
      l.solutions.forEach((s, k) => {
        parts.push({ t: `${k + 1}. ${s.name} — ${peso(s.cost)}${s.warranty ? ` · Warranty: ${s.warranty}` : ""}` });
      });
    }
    if (l.notes) l.notes.split("\n").forEach((n) => n.trim() && parts.push({ t: n.trim(), color: MUTED }));

    doc.setFontSize(7.8);
    const wrapped = parts.map((x) => ({ ...x, lines: doc.splitTextToSize(x.t, descW) as string[] }));
    const h = wrapped.reduce((s, x) => s + x.lines.length * 3.5, 0) + 5;
    ensure(h);
    if (i % 2 === 1) { setFill(doc, BADGE); doc.rect(M, y - 2, CONTENT_W, h, "F"); }
    doc.setFont("helvetica", "bold"); setText(doc, INK);
    doc.text(String(i + 1), cols.no, y + 1.5);
    doc.setFont("helvetica", "normal");
    doc.text(peso(lineUnitPrice(l)), cols.price, y + 1.5);
    doc.text(String(l.quantity || 1), cols.qty + 2, y + 1.5);
    doc.setFont("helvetica", "bold");
    doc.text(peso(lineAmount(l)), cols.amt, y + 1.5, { align: "right" });
    let ty = y + 1.5;
    wrapped.forEach((x) => {
      doc.setFont("helvetica", x.bold ? "bold" : "normal");
      setText(doc, x.color ?? INK);
      doc.text(x.lines, cols.desc, ty);
      ty += x.lines.length * 3.5;
    });
    y += h;
    setDraw(doc, BORDER); doc.setLineWidth(0.3); doc.line(M, y - 2, M + CONTENT_W, y - 2);
  });

  // Totals (right) and timeframe (left) share one row so short quotes fit on one page.
  const t = quoteTotals(p);
  const rows: [string, string][] = [];
  if (t.discount > 0) rows.push(["Discount", "- " + peso(t.discount)]);
  if (p.vatIncluded) { rows.push(["Sub Total", peso(t.subTotal)]); rows.push(["Add: VAT 12%", peso(t.vat)]); }
  const boxW = 84;
  const tfW = CONTENT_W - boxW - 4;
  doc.setFontSize(7.8);
  const wl = p.warranty ? (doc.splitTextToSize(`Warranty: ${p.warranty}`, boxW - 8) as string[]) : [];
  const h = rows.length * 5.5 + 15 + wl.length * 3.4;
  const tl = p.timeframe?.trim() ? (doc.splitTextToSize(p.timeframe, tfW - 8) as string[]) : [];
  const tfH = tl.length ? tl.length * 3.5 + 11 : 0;
  ensure(Math.max(h, tfH) + 4, false);
  y += 2;
  if (tl.length) {
    card(doc, M, y, tfW, tfH);
    doc.setFont("helvetica", "bold"); setText(doc, NAVY); doc.setFontSize(8.4);
    doc.text("ESTIMATED TIMEFRAME", M + 4, y + 5.5);
    doc.setFont("helvetica", "normal"); setText(doc, INK); doc.setFontSize(7.8);
    doc.text(tl, M + 4, y + 10);
  }
  const bx = M + CONTENT_W - boxW;
  card(doc, bx, y, boxW, h);
  let ry = y + 6;
  doc.setFontSize(8);
  rows.forEach(([k, v]) => {
    doc.setFont("helvetica", "normal"); setText(doc, MUTED); doc.text(k, bx + 4, ry);
    setText(doc, INK); doc.text(v, bx + boxW - 4, ry, { align: "right" });
    ry += 5.5;
  });
  setFill(doc, NAVY);
  doc.roundedRect(bx + 2, ry - 3.5, boxW - 4, 9, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); setText(doc, WHITE);
  doc.text("FINAL AMOUNT", bx + 5, ry + 2.3);
  doc.text(peso(t.finalAmount), bx + boxW - 5, ry + 2.3, { align: "right" });
  if (p.warranty) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.6); setText(doc, ACCENT);
    doc.text(wl, bx + 4, ry + 10);
  }

  drawFooter(doc, DISCLAIMER);
  void PAGE_W;
  return new Uint8Array(doc.output("arraybuffer"));
};
