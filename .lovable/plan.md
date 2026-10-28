# Inventory Items: smarter search, Duplicate action, "Similar parts" suggestions

## 1. Search across every column
The Items tab search currently only checks Part ID, Part Name and Model. Expand it to match any visible column:
Part ID, Part Name, Brand, Device Type, Model, Color, Part Type, Supplier, Location, Status, Notes.
- Multi-word search: every word must match somewhere (e.g. "iphone 13 black screen").
- Case-insensitive, ignores extra spaces.
- Placeholder: "Search ID, name, brand, model, color, type...".
- Search box moved to the top of the Items table so it's always visible (filters stay as they are).

## 2. Duplicate action on each row
New copy icon next to Edit / Delete in the Actions column (only for people who can edit inventory).
- Opens the existing "Add New Part" form pre-filled with that part's details (name, brand, device type, model, color, part type, supplier, location, prices, reorder level, notes).
- Quantity starts at 0; a new Part ID is generated as usual.
- Title shows "Duplicate of <Part ID>" so the officer just changes the model/color/type and saves.
- Saved like a normal add, so it goes through the existing stock-movement approval/audit.

## 3. "Similar existing parts" suggestions in Add New Part
While typing the Part Name (and brand/model), a small panel under the form lists up to 5 existing parts that look alike (same/similar name, same brand or model).
- Each suggestion shows Part ID, name, brand, model, color, part type, quantity.
- Two buttons per suggestion:
  - **Use as template** — fills the form with that part's details so they only change what differs.
  - **Open** — jumps to that part's Edit, in case it's actually the same part (avoid creating a duplicate).
- Exact match warning: if name + brand + model + color + part type all match an existing part, show "This part already exists" with an Open button (save still allowed).

## Technical details
- All changes in `src/pages/InventoryManagement.tsx` (frontend only, no database change).
- Extend the `filteredInventory` search predicate to a tokenized match over a joined lowercase haystack of all item fields.
- Duplicate: reuse add-dialog state; add `prefillFrom(item)` helper that sets new-part form state and opens `isAddDialogOpen`.
- Suggestions: `useMemo` scoring over `inventory` (token overlap on name + bonus for brand/model match), debounced on form fields, top 5 with score threshold.
