import { Wallet } from "lucide-react";
import { WorkspacePanel } from "./WorkspacePanel";
import { cn } from "@/lib/utils";
import { useServicePayments, derivePaymentTotals } from "@/hooks/useServicePayments";

interface ChargesBreakdownProps {
  serviceCost?: number | string;
  discount?: number | string;
  finalCost?: number | string;
  vatRequested?: boolean;
  initialPayment?: number | string;
  paymentStatus?: string;
  /** When provided, actual POS payments for this ticket are included. */
  serviceId?: string;
  showServiceCost?: boolean;
  showDiscount?: boolean;
  showFinal?: boolean;
  showPayment?: boolean;
  title?: string;
  className?: string;
}

const num = (v: any) => {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return isFinite(n) ? n : 0;
};

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ChargesBreakdown({
  serviceCost,
  discount,
  finalCost,
  vatRequested,
  initialPayment,
  paymentStatus,
  serviceId,
  showServiceCost = true,
  showDiscount = true,
  showFinal = true,
  showPayment = true,
  title = "Charges",
  className,
}: ChargesBreakdownProps) {
  const { data: paymentsSummary } = useServicePayments(serviceId);
  const sc = num(serviceCost);
  const dc = num(discount);
  const net = Math.max(0, sc - dc);
  const vat = vatRequested ? Math.round(net * 12) / 100 : 0;
  const fc = finalCost !== undefined ? num(finalCost) : net + vat;
  const ip = num(initialPayment);
  const totals = derivePaymentTotals(fc, ip, paymentsSummary?.transactionsPaid || 0);
  const balance = totals.balance;

  const rows: { label: string; value: string; strong?: boolean; muted?: boolean }[] = [];
  if (showServiceCost) rows.push({ label: "Service Cost", value: peso(sc) });
  if (showDiscount) rows.push({ label: "Discount", value: dc > 0 ? `- ${peso(dc)}` : peso(0), muted: dc === 0 });
  if (vatRequested) rows.push({ label: "VAT (12%)", value: peso(vat) });
  if (showFinal) rows.push({ label: "Final Cost", value: peso(fc), strong: true });
  if (showPayment) {
    if (ip > 0) rows.push({ label: "Initial Payment", value: peso(ip) });
    for (const p of paymentsSummary?.payments ?? []) {
      rows.push({
        label: `${p.type}${p.paymentMethod ? ` · ${p.paymentMethod}` : ""}`,
        value: peso(p.amount),
      });
    }
    rows.push({ label: "Total Paid", value: peso(totals.paid) });
    rows.push({ label: "Balance", value: peso(balance), strong: true });
  }


  return (
    <WorkspacePanel
      title={title}
      icon={<Wallet className="h-4 w-4" />}
      className={className}
      bodyClassName="p-0"
    >
      <div className="divide-y divide-border/50">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between px-4 py-2.5">
            <span className={cn("text-sm", r.muted ? "text-muted-foreground" : "text-muted-foreground")}>{r.label}</span>
            <span className={cn("text-sm tabular-nums", r.strong ? "font-semibold text-foreground" : "text-foreground")}>{r.value}</span>
          </div>
        ))}
        {paymentStatus && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Payment Status</span>
            <span className="text-xs font-semibold text-foreground">{paymentStatus}</span>
          </div>
        )}
      </div>
    </WorkspacePanel>
  );
}

export default ChargesBreakdown;
