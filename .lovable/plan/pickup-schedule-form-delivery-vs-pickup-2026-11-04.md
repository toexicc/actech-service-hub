# Pickup Schedule form: Delivery vs Pickup

The Add/Edit dialog changes its fields based on the Type. Existing fields (date, client, contact, address, city/zone, time window, notes, cost) stay, so current entries and the rider's screen keep working.

## Delivery (shop → client)
1. **Service ID search** at the top: type an ID and pick from matching tickets. When you choose one, these fill in automatically:
   - Client Name, Contact Number (from the ticket)
   - Device Brand - Model (read-only)
   - Technician(s) (read-only)
   - Inclusion: filled from the ticket's accessories and still editable
   - Payment for Repair: worked out from the ticket balance ("Paid" / "Not yet paid – ₱X balance"), still editable
2. Manual fields: Address, City (zone), Available Date/Time to Deliver (date + time window), Client Instructions (e.g. "Drop at the lobby"), Delivery Payment (e.g. Paid / Free / Collect ₱X), Cost.
3. Status: **Pending / Rescheduled / Delivered**.

## Pickup (client → shop, mostly manual)
Client Name, Contact Number, Address, City, Available Date/Time for Pickup, Client Instructions (e.g. "Pickup at the lobby"), Delivery Payment (e.g. Free), Cost, and Status (Pending / Rescheduled / Picked up). Service ID stays optional.

## Display
- Day list and rider (Delivery) cards show the new info compactly: device, inclusion, instructions, and both payment lines.
- Status labels: scheduled shows as "Pending"; done shows as "Delivered" for deliveries and "Picked up" for pickups. Existing entries carry over without changes.

## Technical details
- Migration adds nullable columns to `pickup_schedules`: `device_label`, `technician`, `inclusion`, `client_instructions`, `delivery_payment`, `repair_payment`. Existing `notes` stays as internal notes.
- Service lookup: an `ilike` search on `services.service_id` (limit 8). Payment status comes from the existing shared paid-total helper, which excludes non-payment transaction types.
- Status values stay `scheduled/rescheduled/done/cancelled` in storage; only the labels change, so the rider flow and logs don't change.
- Logs record the new fields in the change details.
