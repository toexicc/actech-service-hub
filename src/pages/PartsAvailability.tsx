import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, RefreshCw, Search, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/useDebounce";
import { useInventory } from "@/hooks/useInventory";
import { InventoryItemsTable, type ItemsSortField } from "@/components/inventory/InventoryItemsTable";
import { PageGuide } from "@/components/PageGuide";
import { CHECK_PARTS_GUIDE } from "@/lib/pageGuides";

const PAGE_SIZE = 25;
type Availability = "all" | "available" | "low" | "out";

/**
 * Check Parts: a read-only, searchable view of the parts list so technicians and admins can see
 * whether a part is in stock. No costs and no stock buttons; changes happen in Inventory Management.
 */
export default function PartsAvailability() {
  const navigate = useNavigate();
  const { data: inventory = [], isLoading, isFetching, refetch } = useInventory();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 200);
  const [deviceType, setDeviceType] = useState("all");
  const [availability, setAvailability] = useState<Availability>("all");
  const [sortField, setSortField] = useState<ItemsSortField>("partName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const deviceTypes = useMemo(
    () => [...new Set(inventory.map((i) => i.deviceType).filter(Boolean))].sort(),
    [inventory],
  );

  const filtered = useMemo(() => {
    const tokens = debounced.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = inventory.filter((item) => {
      if (deviceType !== "all" && item.deviceType !== deviceType) return false;
      if (availability === "available" && item.quantity <= 0) return false;
      if (availability === "low" && item.status !== "Low Stock") return false;
      if (availability === "out" && item.quantity > 0) return false;
      if (!tokens.length) return true;
      const haystack = [item.partId, item.partName, item.brand, item.deviceType, item.model, item.color, item.partType]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });
    rows.sort((a, b) => {
      const cmp =
        sortField === "partId"
          ? a.partId.localeCompare(b.partId)
          : sortField === "quantity"
            ? a.quantity - b.quantity
            : sortField === "lastUpdated"
              ? (a.lastUpdated || "").localeCompare(b.lastUpdated || "")
              : a.partName.localeCompare(b.partName);
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [inventory, debounced, deviceType, availability, sortField, sortOrder]);

  useEffect(() => setPage(1), [debounced, deviceType, availability, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const inStockCount = filtered.filter((i) => i.quantity > 0).length;

  const onSort = (field: ItemsSortField) => {
    if (field === sortField) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortOrder(field === "quantity" || field === "lastUpdated" ? "desc" : "asc");
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Check Parts</h1>
          <p className="text-muted-foreground">See if a part is in stock. This page is view-only.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PageGuide guide={CHECK_PARTS_GUIDE} />
          <Button variant="outline" size="sm" onClick={() => navigate("/request-for-parts")}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Request a part
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                className="pl-9 pr-8"
                placeholder="Search SKU, part name, model, brand…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={deviceType} onValueChange={setDeviceType}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All device types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All device types</SelectItem>
                {deviceTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={availability} onValueChange={(v) => setAvailability(v as Availability)}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any stock</SelectItem>
                <SelectItem value="available">In stock (1+)</SelectItem>
                <SelectItem value="low">Low stock</SelectItem>
                <SelectItem value="out">Out of stock</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} title="Reload">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              No parts match. Try fewer words, or request the part if we don't carry it.
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {filtered.length} part{filtered.length === 1 ? "" : "s"} · {inStockCount} in stock
              </p>
              <InventoryItemsTable
                items={pageItems}
                readOnly
                sortField={sortField}
                sortOrder={sortOrder}
                onSort={onSort}
              />
              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
