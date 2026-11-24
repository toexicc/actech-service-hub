import { describe, expect, it } from "vitest";
import {
  initialRequestStatus,
  isDefectSettled,
  isPartsLocked,
  isPartsLogAction,
  partsLogFilter,
  noPartAdditions,
  returnableQty,
  returnReasonLabel,
  isApprovedRequest,
  isOpenRequest,
  matchesPartSearch,
  newRequestId,
  partsUsedText,
  requestStatusText,
  requestTone,
  stockLevel,
  stockText,
} from "./partRequests";

describe("initialRequestStatus", () => {
  it("waits for inventory when there's enough on hand", () => {
    expect(initialRequestStatus(5, 1)).toBe("Requested");
    expect(initialRequestStatus(2, 2)).toBe("Requested");
  });

  it("needs ordering when stock is short or the part isn't in the list", () => {
    expect(initialRequestStatus(1, 2)).toBe("For Ordering");
    expect(initialRequestStatus(0, 1)).toBe("For Ordering");
    expect(initialRequestStatus(null, 1)).toBe("For Ordering");
  });
});

describe("request status", () => {
  it("is open until approved or cancelled", () => {
    ["Requested", "For Ordering", "Ordering", "Ordered", "Received"].forEach((s) => expect(isOpenRequest(s)).toBe(true));
    ["Approved", "Released to technician", "Cancelled"].forEach((s) => expect(isOpenRequest(s)).toBe(false));
  });

  it("treats the old Released to technician as approved", () => {
    expect(isApprovedRequest("Released to technician")).toBe(true);
    expect(requestStatusText("Released to technician")).toBe("Approved, on this ticket");
  });

  it("has a word for every status", () => {
    expect(requestStatusText("Requested")).toBe("Waiting for inventory");
    expect(requestStatusText("Received")).toBe("Arrived, waiting for inventory to release it");
    expect(requestStatusText("Something new")).toBe("Something new");
  });

  it("groups statuses by tone", () => {
    expect(requestTone("Requested")).toBe("waiting");
    expect(requestTone("Ordered")).toBe("ordering");
    expect(requestTone("Received")).toBe("ready");
    expect(requestTone("Approved")).toBe("done");
    expect(requestTone("Cancelled")).toBe("cancelled");
  });
});

describe("stock for requesters", () => {
  it("shows in, low, out and on order", () => {
    expect(stockLevel(5, "In Stock")).toBe("in");
    expect(stockLevel(1, "Low Stock")).toBe("low");
    expect(stockLevel(0, "Out of Stock")).toBe("out");
    expect(stockLevel(0, "On Order")).toBe("order");
    expect(stockLevel(3, "On Order")).toBe("in");
  });

  it("says it in words", () => {
    expect(stockText(5, "In Stock")).toBe("In stock · 5");
    expect(stockText(1, "Low Stock")).toBe("Low · 1 left");
    expect(stockText(0, "Out of Stock")).toBe("Out of stock");
    expect(stockText(0, "On Order")).toBe("On order");
  });
});

describe("helpers", () => {
  it("makes RQ request numbers", () => {
    expect(newRequestId(1795398877352, 0)).toBe("RQ39887735210");
    expect(newRequestId(1795398877352, 0.999)).toBe("RQ39887735299");
  });

  it("finds parts when every typed word matches", () => {
    const fields = ["BAT-APL-IP13PM-OEM", "Battery - iPhone 13 Pro Max", "Apple", "Mobile (iPhone)", "13 Pro Max"];
    expect(matchesPartSearch(fields, "battery 13 pro")).toBe(true);
    expect(matchesPartSearch(fields, "bat-apl-ip13pm")).toBe(true);
    expect(matchesPartSearch(fields, "battery 14")).toBe(false);
    expect(matchesPartSearch(fields, "   ")).toBe(true);
  });

  it("reads parts used as a string or a list", () => {
    expect(partsUsedText(["A (1)", "B (2)"])).toBe("A (1), B (2)");
    expect(partsUsedText("A (1)")).toBe("A (1)");
    expect(partsUsedText(null)).toBe("");
  });
});

describe("locking and returns", () => {
  it("locks parts from Done Repair onward and on closed tickets", () => {
    ["Pending Diagnosis", "Ongoing Service", "Backjob", "Proceed Repair"].forEach((st) => expect(isPartsLocked(st)).toBe(false));
    ["Done Repair - Under Observation", "Done Repair - For Release", "Done Repair - Advise Client", "Completed", "Cancelled", "RTO - Client"].forEach(
      (st) => expect(isPartsLocked(st)).toBe(true),
    );
  });

  it("allows no new parts on cancelled and RTO tickets", () => {
    expect(noPartAdditions("RTO - ACTech")).toBe(true);
    expect(noPartAdditions("Cancelled")).toBe(true);
    expect(noPartAdditions("Completed")).toBe(false);
  });

  it("names return reasons and returns", () => {
    expect(returnReasonLabel("defective")).toBe("Defective");
    expect(returnReasonLabel("wrong_entry")).toBe("Wrong entry");
    expect(requestStatusText("Requested", "return")).toBe("Waiting for approval");
    expect(requestStatusText("Approved", "return")).toBe("Approved, taken off this ticket");
  });

  it("counts what can still be returned", () => {
    expect(returnableQty(2, 0)).toBe(2);
    expect(returnableQty(2, 1)).toBe(1);
    expect(returnableQty(1, 2)).toBe(0);
  });

  it("knows when a defective part is settled", () => {
    expect(isDefectSettled("Sent to supplier")).toBe(false);
    expect(isDefectSettled("Replaced")).toBe(true);
  });
});

describe("parts log filter", () => {
  it("picks out parts entries on a ticket's log", () => {
    [
      "Part requested: 1× LCD (LCD-A2681-OEM)",
      "Part return approved: BAT-1 (1) taken off the ticket · Defective",
      "Parts added directly (Assign to Ticket): LCD-1 (+1). Added by Kenneth Perez",
      "Parts used added from the Google Sheet Stock Out log",
      "Defective part BAT-1: Sent to supplier",
      "Waiting for Parts turned on",
      "Technician parts update saved",
      "Stock change on this ticket approved: LCD (-1) by Kenneth",
    ].forEach((a) => expect(isPartsLogAction(a)).toBe(true));
  });

  it("leaves other entries out", () => {
    ["Service updated (/manage-client)", "Notification sent: Ready for pickup", "Technician department changed", "Technician departments updated", "POS: payment"].forEach((a) =>
      expect(isPartsLogAction(a)).toBe(false),
    );
    expect(isPartsLogAction(null)).toBe(false);
  });

  it("builds the database filter from the same patterns", () => {
    expect(partsLogFilter()).toBe(
      "action.ilike.Part*,action.ilike.Defective*part*,action.ilike.Waiting*for*Parts*,action.ilike.Technician*parts*update*,action.ilike.Stock*change*",
    );
  });
});
