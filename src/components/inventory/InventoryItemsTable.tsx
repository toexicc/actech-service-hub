import { Fragment, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ClipboardPlus,
  Copy,
  Edit,
  History,
  MoreHorizontal,
  QrCode,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ItemsSortField = "partId" | "partName" | "quantity" | "lastUpdated";

/** The fields the list shows; InventoryManagement's items and useInventory rows both fit. */
export interface InventoryRow {
  partId: string;
  partName: string;
  deviceType?: string;
  brand?: string;
  model?: string;
  color?: string;
  partType?: string;
  quantity: number;
  reorderLevel?: number;
  costPerUnit?: string;
  sellingPrice?: number;
  supplier?: string;
  dateOrdered?: string;
  status: string;
  lastUpdated: string;
  remarks?: string;
}

export interface InventoryRowLog {
  logId: string;
  partId: string;
  transactionType: string;
  quantityChanged?: number | string;
  previousQuantity?: number | string;
  newQuantity?: number | string;
  username?: string;
  role?: string;
  dateTime: string;
  remarks?: string;
}

export interface InventoryRowActions<T> {
  onAdjust?: (item: T) => void;
  onReceive?: (item: T) => void;
  onEdit?: (item: T) => void;
  onDuplicate?: (item: T) => void;
  onDelete?: (item: T) => void;
  onShowQr?: (item: T) => void;
  /** Record this part on a ticket (Assign to Ticket). */
  onAssign?: (item: T) => void;
}

interface Props<T extends InventoryRow> {
  items: T[];
  /** Recent history shown when a row is opened; leave out to show details only. */
  logs?: InventoryRowLog[];
  /** No stock buttons or menu (view-only admins, the Check Parts page). QR stays if onShowQr is given. */
  readOnly?: boolean;
  /** Cost and selling price in the row details. */
  showCost?: boolean;
  sortField: ItemsSortField;
  sortOrder: "asc" | "desc";
  onSort: (field: ItemsSortField) => void;
  actions?: InventoryRowActions<T>;
  busy?: boolean;
}

const STATUS_TONE: Record<string, string> = {
  "In Stock": "bg-success/10 text-success border-success/25",
  "Low Stock": "bg-warning/10 text-warning border-warning/25",
  "Out of Stock": "bg-destructive/10 text-destructive border-destructive/25",
};

export function StockStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_TONE[status] ?? "bg-primary/10 text-primary border-primary/25",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

const qtyTone = (item: InventoryRow) =>
  item.quantity <= 0 || item.status === "Out of Stock"
    ? "text-destructive"
    : item.status === "Low Stock"
      ? "text-warning"
      : "text-foreground";

const deviceLine = (item: InventoryRow) => [item.brand, item.model].filter(Boolean).join(" · ");

const manila = (value: string, opts: Intl.DateTimeFormatOptions) => {
  const d = new Date(value);
  if (!value || isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", ...opts }).format(d);
};
const shortDate = (value: string) => manila(value, { month: "short", day: "numeric", year: "numeric" });
const shortTime = (value: string) => manila(value, { hour: "numeric", minute: "2-digit" });

const peso = (value: number) => `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

function SortButton({
  field,
  current,
  order,
  onSort,
  children,
  className,
}: {
  field: ItemsSortField;
  current: ItemsSortField;
  order: "asc" | "desc";
  onSort: (field: ItemsSortField) => void;
  children: ReactNode;
  className?: string;
}) {
  const active = current === field;
  const Icon = !active ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={cn(
        "inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground",
        active && "text-foreground",
        className,
      )}
    >
      {children}
      <Icon className={cn("h-3.5 w-3.5", !active && "opacity-40")} />
    </button>
  );
}

function Detail({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="break-words text-sm">{value || "—"}</p>
    </div>
  );
}

function RowDetails<T extends InventoryRow>({
  item,
  logs,
  showCost,
}: {
  item: T;
  logs?: InventoryRowLog[];
  showCost?: boolean;
}) {
  const history = (logs ?? [])
    .filter((l) => l.partId === item.partId)
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
    .slice(0, 10);
  const cost = Number(String(item.costPerUnit ?? "").replace(/[^0-9.]/g, "")) || 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Detail label="Re-order level" value={item.reorderLevel ? String(item.reorderLevel) : "None"} />
        {showCost && <Detail label="Cost" value={cost ? peso(cost) : undefined} />}
        {showCost && <Detail label="Selling price" value={item.sellingPrice ? peso(item.sellingPrice) : undefined} />}
        <Detail label="Supplier" value={item.supplier} />
        <Detail label="Date ordered" value={item.dateOrdered} />
        <Detail label="Colour" value={item.color} />
        <div className="col-span-2 sm:col-span-3 lg:col-span-6">
          <Detail label="Remarks" value={item.remarks} />
        </div>
      </div>
      {logs && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <History className="h-3.5 w-3.5" />
            Recent activity
          </p>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {history.map((log) => (
                <div key={log.logId} className="rounded-md border bg-background px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-primary">{log.transactionType}</span>
                    <span className="text-muted-foreground">{log.dateTime}</span>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">
                    {log.quantityChanged !== undefined && log.quantityChanged !== "" && <>{log.quantityChanged} unit(s) · </>}
                    {log.previousQuantity !== undefined && log.newQuantity !== undefined && log.previousQuantity !== "" && (
                      <>
                        stock {log.previousQuantity} → {log.newQuantity} ·{" "}
                      </>
                    )}
                    {log.username || "System"}
                  </p>
                  {log.remarks && <p className="mt-0.5">{log.remarks}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RowActionsCell<T extends InventoryRow>({
  item,
  actions,
  busy,
}: {
  item: T;
  actions: InventoryRowActions<T>;
  busy?: boolean;
}) {
  const onOrder = item.status === "On Order";
  const hasMenu = actions.onAssign || actions.onEdit || actions.onDuplicate || actions.onShowQr || actions.onDelete;
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {onOrder && actions.onReceive ? (
        <Button size="sm" className="h-8 bg-success text-success-foreground hover:bg-success/90" disabled={busy} onClick={() => actions.onReceive?.(item)}>
          Receive
        </Button>
      ) : actions.onAdjust ? (
        <Button size="sm" variant="outline" className="h-8" onClick={() => actions.onAdjust?.(item)}>
          Adjust
        </Button>
      ) : null}
      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`More actions for ${item.partId}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {actions.onAssign && (
              <DropdownMenuItem onClick={() => actions.onAssign?.(item)}>
                <ClipboardPlus className="mr-2 h-4 w-4" />
                Assign to ticket
              </DropdownMenuItem>
            )}
            {actions.onEdit && (
              <DropdownMenuItem onClick={() => actions.onEdit?.(item)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {actions.onDuplicate && (
              <DropdownMenuItem onClick={() => actions.onDuplicate?.(item)}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
            )}
            {actions.onShowQr && (
              <DropdownMenuItem onClick={() => actions.onShowQr?.(item)}>
                <QrCode className="mr-2 h-4 w-4" />
                QR code
              </DropdownMenuItem>
            )}
            {actions.onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => actions.onDelete?.(item)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/**
 * Inventory parts list: a compact table on wider screens and cards on phones. Tap a row for
 * details (supplier, remarks, cost when allowed) and recent activity.
 */
export function InventoryItemsTable<T extends InventoryRow>({
  items,
  logs,
  readOnly,
  showCost,
  sortField,
  sortOrder,
  onSort,
  actions,
  busy,
}: Props<T>) {
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));
  const rowActions: InventoryRowActions<T> | undefined = actions
    ? readOnly
      ? { onShowQr: actions.onShowQr }
      : actions
    : undefined;
  const showActions = !!rowActions && Object.values(rowActions).some(Boolean);
  const columns = 6 + (showActions ? 1 : 0);

  return (
    <>
      {/* Phones: one card per part */}
      <div className="space-y-2 md:hidden">
        {items.map((item) => {
          const open = openId === item.partId;
          return (
            <div
              key={item.partId}
              role="button"
              tabIndex={0}
              onClick={() => toggle(item.partId)}
              onKeyDown={(e) => e.key === "Enter" && toggle(item.partId)}
              className={cn("rounded-lg border bg-card p-3 transition-colors", open && "border-primary/40")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{item.partName}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{item.partId}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn("text-xl font-semibold tabular-nums leading-none", qtyTone(item))}>{item.quantity}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">in stock</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <StockStatusBadge status={item.status} />
                {item.partType && <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">{item.partType}</span>}
                <span>{[item.deviceType, deviceLine(item)].filter(Boolean).join(" · ")}</span>
              </div>
              {showActions && rowActions && (
                <div className="mt-2 border-t pt-2">
                  <RowActionsCell item={item} actions={rowActions} busy={busy} />
                </div>
              )}
              {open && (
                <div className="mt-3 border-t pt-3" onClick={(e) => e.stopPropagation()}>
                  <RowDetails item={item} logs={logs} showCost={showCost} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tablets and computers: compact table */}
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="text-xs text-muted-foreground hover:bg-transparent [&_th]:h-10 [&_th]:font-medium">
              <TableHead className="min-w-[260px]">
                <div className="flex items-center gap-3">
                  <SortButton field="partName" current={sortField} order={sortOrder} onSort={onSort}>
                    Part
                  </SortButton>
                  <SortButton field="partId" current={sortField} order={sortOrder} onSort={onSort} className="normal-case">
                    SKU
                  </SortButton>
                </div>
              </TableHead>
              <TableHead className="uppercase tracking-wide">Device</TableHead>
              <TableHead className="uppercase tracking-wide">Type</TableHead>
              <TableHead className="text-right">
                <SortButton field="quantity" current={sortField} order={sortOrder} onSort={onSort}>
                  Stock
                </SortButton>
              </TableHead>
              <TableHead className="uppercase tracking-wide">Status</TableHead>
              <TableHead>
                <SortButton field="lastUpdated" current={sortField} order={sortOrder} onSort={onSort}>
                  Updated
                </SortButton>
              </TableHead>
              {showActions && <TableHead className="w-[1%]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const open = openId === item.partId;
              return (
                <Fragment key={item.partId}>
                  <TableRow
                    className={cn("cursor-pointer align-top [&_td]:py-3", open && "bg-muted/40 hover:bg-muted/40")}
                    onClick={() => toggle(item.partId)}
                  >
                    <TableCell>
                      <div className="max-w-[420px]">
                        <p className="font-medium leading-snug text-foreground">{item.partName}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{item.partId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="w-[150px] lg:w-[200px]">
                        <p className="truncate text-sm">{item.deviceType || "—"}</p>
                        {deviceLine(item) && (
                          <p className="truncate text-xs text-muted-foreground" title={deviceLine(item)}>
                            {deviceLine(item)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[90px]">
                      {item.partType ? (
                        <span className="whitespace-nowrap rounded bg-muted px-1.5 py-0.5 text-xs">{item.partType}</span>
                      ) : !item.color ? (
                        <span className="text-muted-foreground">—</span>
                      ) : null}
                      {item.color && <p className="mt-1 text-xs text-muted-foreground">{item.color}</p>}
                    </TableCell>
                    <TableCell className="text-right">
                      <p className={cn("text-base font-semibold tabular-nums leading-tight", qtyTone(item))}>{item.quantity}</p>
                      {item.reorderLevel ? (
                        <p className="whitespace-nowrap text-[11px] text-muted-foreground">re-order at {item.reorderLevel}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <StockStatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <p className="text-sm">{shortDate(item.lastUpdated) || "—"}</p>
                      <p className="text-xs text-muted-foreground">{shortTime(item.lastUpdated)}</p>
                    </TableCell>
                    {showActions && rowActions && (
                      <TableCell className="text-right">
                        <RowActionsCell item={item} actions={rowActions} busy={busy} />
                      </TableCell>
                    )}
                  </TableRow>
                  {open && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={columns} className="px-4 py-4">
                        <RowDetails item={item} logs={logs} showCost={showCost} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
