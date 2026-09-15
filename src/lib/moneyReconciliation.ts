/**
 * One shared money walk so Completed Services, Transaction Tracker and Reports
 * can be reconciled instead of silently disagreeing.
 *
 * The three pages measure different things:
 *  - Completed Services: quoted value of tickets COMPLETED in the window
 *  - Transaction Tracker: cash actually COLLECTED in the window
 *  - Reports: tickets RECEIVED in the window
 *
 * This module bridges them with explicit, labelled lines.
 */

export interface ReconTicket {
  serviceId: string;
  quotedPrice: number;
  discount: number;
  partsCost: number;
}

export interface ReconTx {
  serviceId: string;
  type: string;
  status: string;
  amount: number;
}

const SALES_TYPES = new Set(["down payment", "full payment", "partial payment"]);
const REFUND_TYPE = "refund";
const EXPENSE_TYPES = new Set([
  "parts inventory",
  "rent",
  "miscellaneous expense",
  "salary disbursement",
]);

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
const isVoided = (t: ReconTx) => {
  const s = norm(t.status);
  return s === "void" || s === "voided" || norm(t.type).startsWith("void");
};

export const isSalesTx = (t: ReconTx) => SALES_TYPES.has(norm(t.type)) && !isVoided(t);
export const isRefundTx = (t: ReconTx) => norm(t.type) === REFUND_TYPE && !isVoided(t);
export const isExpenseTx = (t: ReconTx) => EXPENSE_TYPES.has(norm(t.type)) && !isVoided(t);

export interface MoneyReconciliation {
  ticketCount: number;
  quoted: number;
  discounts: number;
  billable: number;
  paidOnTickets: number;
  unpaid: number;
  cashCollected: number;
  refunds: number;
  cashFromWindowTickets: number;
  cashFromOtherTickets: number;
  partsConsumed: number;
  otherExpenses: number;
  partsPurchased: number;
  operatingProfit: number;
  quotedProfit: number;
}

/**
 * @param tickets    tickets completed inside the window
 * @param windowTx   every transaction dated inside the window
 * @param ticketTx   every transaction (any date) belonging to `tickets`
 */
export const buildMoneyReconciliation = (
  tickets: ReconTicket[],
  windowTx: ReconTx[],
  ticketTx: ReconTx[],
): MoneyReconciliation => {
  const ids = new Set(tickets.map((t) => t.serviceId).filter(Boolean));

  const quoted = tickets.reduce((s, t) => s + (t.quotedPrice || 0), 0);
  const discounts = tickets.reduce((s, t) => s + (t.discount || 0), 0);
  const partsConsumed = tickets.reduce((s, t) => s + (t.partsCost || 0), 0);
  const billable = quoted - discounts;

  const paidOnTickets = ticketTx
    .filter(isSalesTx)
    .reduce((s, t) => s + (t.amount || 0), 0);

  const salesInWindow = windowTx.filter(isSalesTx);
  const cashCollected = salesInWindow.reduce((s, t) => s + (t.amount || 0), 0);
  const cashFromWindowTickets = salesInWindow
    .filter((t) => ids.has(t.serviceId))
    .reduce((s, t) => s + (t.amount || 0), 0);

  const refunds = windowTx.filter(isRefundTx).reduce((s, t) => s + (t.amount || 0), 0);

  const expenseTx = windowTx.filter(isExpenseTx);
  const partsPurchased = expenseTx
    .filter((t) => norm(t.type) === "parts inventory")
    .reduce((s, t) => s + (t.amount || 0), 0);
  const otherExpenses = expenseTx
    .filter((t) => norm(t.type) !== "parts inventory")
    .reduce((s, t) => s + (t.amount || 0), 0);

  return {
    ticketCount: tickets.length,
    quoted,
    discounts,
    billable,
    paidOnTickets,
    unpaid: Math.max(0, billable - paidOnTickets),
    cashCollected,
    refunds,
    cashFromWindowTickets,
    cashFromOtherTickets: cashCollected - cashFromWindowTickets,
    partsConsumed,
    otherExpenses,
    partsPurchased,
    operatingProfit: cashCollected - refunds - partsConsumed - otherExpenses,
    quotedProfit: billable - partsConsumed,
  };
};
