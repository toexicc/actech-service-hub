// Inventory CSV import: reads a CSV of parts and works out what importing it would change.
//
// Two layouts are accepted, found by their header row (it can sit below title rows):
//   • the old inventory Google Sheet's "Inventory Dashboard" tab, downloaded as CSV
//     (SKU, Product Name, Brand, Model Code, Condition, Current Qty. in Stock, Re-Order Level, …)
//   • this app's own "Download CSV" from Inventory Items
//     (Part ID, Part Name, Device Type, Brand, Model, Color, Part Type, Quantity, Re-Order Level, …)
// Rows are matched to existing parts by SKU / Part ID. An import never deletes parts.
import { DEVICE_TYPES } from "./constants";
import { deriveStockStatus } from "./stockStatus";

export type ImportMode = "details" | "stock";

export interface ExistingPart {
  partId: string;
  partName: string;
  deviceType: string;
  brand: string;
  model: string;
  partType?: string;
  color?: string;
  quantity: number;
  reorderLevel?: number | null;
  costPerUnit?: string | number | null;
  sellingPrice?: number | null;
  supplier?: string;
  remarks?: string;
  storedStatus?: string;
}

export interface ImportRow {
  rowNumber: number; // line number in the file (1 = first line)
  partId: string;
  partName: string;
  deviceType: string;
  brand: string;
  model: string;
  partType: string;
  color: string;
  quantity: number | null;
  reorderLevel: number | null;
  cost: number | null;
  price: number | null;
  supplier: string;
  remarks: string;
  statusFlag: string; // "On Order" / "For Ordering" carried over from an app CSV, else ""
}

export interface ImportIssue {
  rowNumber: number;
  partId: string;
  message: string;
}

export interface FieldChange {
  field: keyof ImportRow;
  label: string;
  from: string;
  to: string;
}

export interface PlannedUpdate {
  row: ImportRow;
  existing: ExistingPart;
  changes: FieldChange[]; // detail changes (not quantity)
  quantityFrom?: number;
  quantityTo?: number; // set only in stock-count mode when the count differs
}

export interface ImportPlan {
  layout: "sheet" | "app";
  headerRowNumber: number;
  rowsRead: number;
  creates: ImportRow[];
  updates: PlannedUpdate[];
  unchanged: number;
  errors: ImportIssue[];
}

// ---------------------------------------------------------------- CSV reading

/** Splits CSV text into rows of cells (handles quotes, "" escapes, CRLF and a leading BOM). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const delimiter = count("\t") > count(",") ? "\t" : count(";") > count(",") ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------- header matching

const normHeader = (s: string) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[.*:#]/g, "")
    .replace(/\s+/g, " ")
    .trim();

type ColumnKey =
  | "partId" | "partName" | "deviceType" | "brand" | "model" | "condition" | "partType" | "color"
  | "quantity" | "reorderLevel" | "cost" | "price" | "supplier" | "remarks" | "status";

// Aliases are listed in order of preference.
const COLUMN_ALIASES: Record<ColumnKey, string[]> = {
  partId: ["sku", "part id", "partid", "part_id", "part no", "part number"],
  partName: ["product name", "part name", "product", "name"],
  deviceType: ["device type"],
  brand: ["brand"],
  model: ["model code", "model"],
  condition: ["condition"],
  partType: ["part type"],
  color: ["color", "colour"],
  quantity: ["current qty in stock", "current qty", "current quantity", "quantity", "qty", "on hand", "stock"],
  reorderLevel: ["re-order level", "reorder level", "re-order", "reorder", "reorder point"],
  cost: ["cost per unit", "cost price", "unit cost", "cost"],
  price: ["price per unit", "selling price", "unit price", "price"],
  supplier: ["supplier"],
  remarks: ["remarks", "notes"],
  status: ["status"],
};

const mapColumns = (header: string[]): Partial<Record<ColumnKey, number>> => {
  const normalized = header.map(normHeader);
  const out: Partial<Record<ColumnKey, number>> = {};
  (Object.keys(COLUMN_ALIASES) as ColumnKey[]).forEach((key) => {
    for (const alias of COLUMN_ALIASES[key]) {
      const idx = normalized.indexOf(alias);
      if (idx >= 0) {
        out[key] = idx;
        break;
      }
    }
  });
  return out;
};

/** Finds the header row: the first row (within the first 60) that names both a SKU/Part ID and a name column. */
export function findHeader(rows: string[][]): { index: number; columns: Partial<Record<ColumnKey, number>> } | null {
  for (let i = 0; i < Math.min(rows.length, 60); i++) {
    const columns = mapColumns(rows[i]);
    if (columns.partId !== undefined && columns.partName !== undefined) return { index: i, columns };
  }
  return null;
}

// ---------------------------------------------------------------- value helpers

const SHEET_ERRORS = /^#(N\/A|VALUE!|REF!|DIV\/0!|ERROR!|NAME\?|NUM!|NULL!)$/i;

const clean = (s: string | undefined) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Parses "₱1,800.00", "1800" or "" (null). Returns NaN for anything that is not a number. */
export const parseNumber = (raw: string | undefined): number | null => {
  const s = clean(raw);
  if (!s) return null;
  if (SHEET_ERRORS.test(s)) return NaN;
  const n = Number(s.replace(/[₱$,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

const GRADE = /^(oem|original|orig|oled|donor|tester)\b/i;
const normalizeGrade = (g: string) => {
  const t = g.trim();
  if (/^oem$/i.test(t)) return "OEM";
  if (/^(original|orig)$/i.test(t)) return "Original";
  return t;
};

/** Splits the sheet's Condition into the app's Part Type (OEM / Original …) or Color. */
export function splitCondition(condition: string, productName: string): { partType: string; color: string } {
  let c = clean(condition);
  // A condition with " - " in it was typed wrong; the product name's last part has the real one.
  if (!c || c.includes(" - ")) {
    const segments = clean(productName).split(" - ");
    c = segments.length > 1 ? clean(segments[segments.length - 1]) : "";
  }
  if (!c) return { partType: "", color: "" };
  const withColour = c.match(/^(oem|original|orig)\s*\((.+)\)$/i);
  if (withColour) return { partType: normalizeGrade(withColour[1]), color: clean(withColour[2]) };
  if (GRADE.test(c)) return { partType: normalizeGrade(c), color: "" };
  return { partType: "", color: c };
}

const has = (s: string, words: string[]) => words.some((w) => s.includes(w));

/** Picks the app's Device Type from the product name and brand. */
export function deriveDeviceType(productName: string, brand: string): string {
  const s = ` ${productName.toLowerCase()} `;
  const b = brand.toLowerCase().trim();
  let type = "Others";
  if (has(s, ["macbook"])) type = "Laptop (Mac)";
  else if (has(s, ["imac"])) type = "Computer (iMac)";
  else if (has(s, ["mac mini"])) type = "Computer (Mac Mini)";
  else if (has(s, ["iphone"])) type = "Mobile (iPhone)";
  else if (has(s, ["ipad"])) type = "iPad";
  else if (has(s, ["airpods"])) type = "AirPods";
  else if (has(s, ["watch"]) && (b === "apple" || has(s, ["apple"]))) type = "Apple Watch";
  else if (has(s, ["galaxy tab", " tab "])) type = "Tablet (Android)";
  else if (has(s, ["nintendo", "switch", "playstation", "ps4", "ps5", "xbox"]) || b === "nintendo") type = "Gaming Consoles";
  else if (["asus", "lenovo", "acer", "dell", "hp", "msi", "gigabyte"].includes(b) || has(s, [" laptop "])) type = "Laptop (Windows)";
  else if (
    ["samsung", "google", "xiaomi", "oppo", "vivo", "realme", "huawei", "nothing", "infinix", "tecno", "poco", "honor", "oneplus"].includes(b) ||
    has(s, ["galaxy", "pixel", "redmi", "poco", "infinix", " hot "])
  )
    type = "Mobile (Android)";
  return (DEVICE_TYPES as readonly string[]).includes(type) ? type : "Others";
}

// ---------------------------------------------------------------- plan

const textOrBlank = (v: string) => (/^n\/?a$/i.test(v) ? "" : v);

const numText = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

export function buildImportPlan(text: string, existingParts: ExistingPart[], mode: ImportMode): ImportPlan {
  const rows = parseCsv(text);
  const header = findHeader(rows);
  if (!header) {
    throw new Error('No header row found. The file needs a "SKU" (or "Part ID") column and a "Product Name" (or "Part Name") column.');
  }
  const { index, columns } = header;
  const layout: "sheet" | "app" = normHeader(rows[index][columns.partId!]) === "sku" ? "sheet" : "app";
  const get = (r: string[], key: ColumnKey) => (columns[key] === undefined ? "" : clean(r[columns[key]!]));

  const errors: ImportIssue[] = [];
  const parsed: ImportRow[] = [];
  let rowsRead = 0;

  for (let i = index + 1; i < rows.length; i++) {
    const r = rows[i];
    const rowNumber = i + 1;
    const partId = get(r, "partId");
    const partName = get(r, "partName");
    if (!partId && !partName) continue; // blank or template row
    rowsRead++;
    const fail = (message: string) => errors.push({ rowNumber, partId: partId || "(no SKU)", message });

    if (SHEET_ERRORS.test(partId) || SHEET_ERRORS.test(partName)) {
      fail("SKU or name shows a sheet error");
      continue;
    }
    if (!partId) {
      fail(`"${partName}" has no SKU`);
      continue;
    }
    if (!partName) {
      fail("No product name");
      continue;
    }

    const quantity = parseNumber(get(r, "quantity"));
    const reorderLevel = parseNumber(get(r, "reorderLevel"));
    const cost = parseNumber(get(r, "cost"));
    const price = parseNumber(get(r, "price"));
    if (quantity !== null && (Number.isNaN(quantity) || !Number.isInteger(quantity))) {
      fail("Quantity is not a whole number");
      continue;
    }
    if (quantity !== null && quantity < 0) {
      fail(`Negative quantity (${quantity}) — recount this part first`);
      continue;
    }
    if (reorderLevel !== null && (Number.isNaN(reorderLevel) || reorderLevel < 0 || !Number.isInteger(reorderLevel))) {
      fail("Re-order level is not a whole number");
      continue;
    }
    if ((cost !== null && Number.isNaN(cost)) || (price !== null && Number.isNaN(price))) {
      fail("Cost or price is not a number");
      continue;
    }

    const brand = textOrBlank(get(r, "brand"));
    let partType = get(r, "partType");
    let color = get(r, "color");
    if (columns.partType === undefined && columns.color === undefined) {
      ({ partType, color } = splitCondition(get(r, "condition"), partName));
    }
    const statusText = get(r, "status");
    parsed.push({
      rowNumber,
      partId,
      partName,
      deviceType: columns.deviceType !== undefined ? get(r, "deviceType") : deriveDeviceType(partName, brand),
      brand,
      model: get(r, "model"),
      partType,
      color,
      quantity,
      reorderLevel,
      cost,
      price,
      supplier: get(r, "supplier"),
      remarks: get(r, "remarks"),
      statusFlag: statusText === "On Order" || statusText === "For Ordering" ? statusText : "",
    });
  }

  // The same SKU twice in one file is an error on every copy.
  const seen = new Map<string, number[]>();
  parsed.forEach((p) => {
    const k = p.partId.toLowerCase();
    seen.set(k, [...(seen.get(k) ?? []), p.rowNumber]);
  });
  const valid = parsed.filter((p) => {
    const lines = seen.get(p.partId.toLowerCase())!;
    if (lines.length > 1) {
      errors.push({ rowNumber: p.rowNumber, partId: p.partId, message: `Same SKU on rows ${lines.join(", ")}` });
      return false;
    }
    return true;
  });

  const byId = new Map(existingParts.map((e) => [e.partId.trim().toLowerCase(), e]));
  const creates: ImportRow[] = [];
  const updates: PlannedUpdate[] = [];
  let unchanged = 0;

  valid.forEach((row) => {
    const existing = byId.get(row.partId.toLowerCase());
    if (!existing) {
      creates.push(row);
      return;
    }
    const changes: FieldChange[] = [];
    const diffText = (field: keyof ImportRow, label: string, from: string | undefined, to: string) => {
      if (to && to !== clean(from)) changes.push({ field, label, from: clean(from), to });
    };
    const diffNumber = (field: keyof ImportRow, label: string, from: number | null | undefined, to: number | null) => {
      if (to !== null && Number(from ?? 0) !== to) changes.push({ field, label, from: numText(from ?? 0), to: numText(to) });
    };
    diffText("partName", "Name", existing.partName, row.partName);
    if (columns.deviceType !== undefined) diffText("deviceType", "Device type", existing.deviceType, row.deviceType);
    diffText("brand", "Brand", existing.brand, row.brand);
    diffText("model", "Model", existing.model, row.model);
    diffText("partType", "Part type", existing.partType, row.partType);
    diffText("color", "Color", existing.color, row.color);
    diffNumber("reorderLevel", "Re-order level", existing.reorderLevel, row.reorderLevel);
    diffNumber("cost", "Cost", parseNumber(String(existing.costPerUnit ?? "")), row.cost);
    diffNumber("price", "Selling price", existing.sellingPrice, row.price);
    diffText("supplier", "Supplier", existing.supplier, row.supplier);
    diffText("remarks", "Remarks", existing.remarks, row.remarks);

    const countChanged = mode === "stock" && row.quantity !== null && row.quantity !== existing.quantity;
    if (changes.length === 0 && !countChanged) {
      unchanged++;
      return;
    }
    updates.push({
      row,
      existing,
      changes,
      ...(countChanged ? { quantityFrom: existing.quantity, quantityTo: row.quantity! } : {}),
    });
  });

  errors.sort((a, b) => a.rowNumber - b.rowNumber);
  return { layout, headerRowNumber: index + 1, rowsRead, creates, updates, unchanged, errors };
}

// ---------------------------------------------------------------- database records

/** Row for inserting a new part into inventory_parts. */
export function toInsertRecord(row: ImportRow) {
  const quantity = row.quantity ?? 0;
  return {
    part_id: row.partId,
    part_name: row.partName,
    category: row.deviceType || "Others",
    brand: row.brand || null,
    device_model: row.model || null,
    part_type: row.partType || null,
    color: row.color || null,
    quantity,
    reorder_level: row.reorderLevel ?? 0,
    cost_price: row.cost ?? 0,
    selling_price: row.price ?? 0,
    supplier: row.supplier || null,
    notes: row.remarks || null,
    status: deriveStockStatus(quantity, row.reorderLevel ?? 0, row.statusFlag),
  };
}

const COLUMN_FOR: Partial<Record<keyof ImportRow, string>> = {
  partName: "part_name",
  deviceType: "category",
  brand: "brand",
  model: "device_model",
  partType: "part_type",
  color: "color",
  reorderLevel: "reorder_level",
  cost: "cost_price",
  price: "selling_price",
  supplier: "supplier",
  remarks: "notes",
};

/** Patch for updating an existing part: only the changed fields, plus the stock status they lead to. */
export function toUpdatePatch(update: PlannedUpdate): Record<string, string | number | null> {
  const patch: Record<string, string | number | null> = {};
  update.changes.forEach((c) => {
    const column = COLUMN_FOR[c.field];
    if (column) patch[column] = (update.row[c.field] as string | number | null) ?? null;
  });
  const quantity = update.quantityTo ?? update.existing.quantity;
  if (update.quantityTo !== undefined) patch.quantity = update.quantityTo;
  const reorder = update.row.reorderLevel ?? update.existing.reorderLevel ?? 0;
  patch.status = deriveStockStatus(quantity, reorder, update.existing.storedStatus);
  patch.updated_at = new Date().toISOString();
  return patch;
}
