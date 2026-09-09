/**
 * Print / download helpers shared by the document rows on the tracking page and
 * the POS document actions. Both always work off the real PDF bytes so the
 * saved file is the document itself, and printing uses rendered pages (the same
 * approach as the in-app viewer) so it works in every browser.
 */

import { loadPdfBytes, renderPdfToImages } from "./pdfViewer";

export const downloadPdfFromUrl = async (
  url: string | null | undefined,
  filename = "document.pdf",
): Promise<boolean> => {
  const bytes = await loadPdfBytes(url);
  if (!bytes) return false;
  const objectUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  return true;
};

export const printPdfFromUrl = async (
  url: string | null | undefined,
  title = "Document",
): Promise<boolean> => {
  const bytes = await loadPdfBytes(url);
  if (!bytes) return false;
  const pages = await renderPdfToImages(bytes);
  if (!pages.length) return false;
  const w = window.open("", "_blank");
  if (!w) return false;
  const imgs = pages
    .map((p) => `<img src="${p.src}" style="width:100%;display:block;page-break-after:always" />`)
    .join("");
  w.document.write(
    `<html><head><title>${title}</title><style>@page{margin:0}body{margin:0}</style></head><body>${imgs}<script>window.onload=function(){window.focus();window.print();}</script></body></html>`,
  );
  w.document.close();
  return true;
};
