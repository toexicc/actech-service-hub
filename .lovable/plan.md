# Admin + Inventory access for Kenneth Perez

## What changes
- New access type **Admin + Inventory**: everything an Admin can do, plus full Inventory Management editing (add/edit parts, stock, pre-ordered parts, part requests). Today Admins only see Inventory read-only.
- Kenneth Perez is currently set as **Management**. He will be moved to **Admin + Inventory**, so he loses management-only pages (Transaction Tracker, Salary Disbursement, Reports, Ordered toggle, etc.). The Kenn Perez technician account is not touched.
- Staff management screen gets the new option so it can be given to others later.

## Suggested dashboard for Admin + Inventory (his home on /menu)
Top row of cards (tap to open filtered inventory):
1. **Low Stock**: parts at or below reorder level
2. **For Ordering**: pre-ordered parts waiting to be bought
3. **Ordered / In Transit**: tickets marked Ordered, with days waiting
4. **Waiting for Parts**: tickets paused for parts, showing the technician's parts note

Below the cards:
- **Open Part Requests** list from technicians (newest first) with quick Ordering / Ordered / Received buttons
- **Recent Stock Movement**: the last 10 inventory log entries
- Smaller **Services** summary at the bottom (his assigned tickets), so admin work is still reachable

Mobile bottom bar: Dashboard, Inventory, Tracker, Manage Client.

## Stock movement approvals
- Whenever anyone adds a part, changes stock, removes a part, or uses one on a service, a **movement** record is created with status **Pending**, and Kenneth gets an alert right away (bell + push).
- New **Movements** tab in Inventory Management lists every movement: who did it, which part, the amount up or down, the linked ticket, and when. Filters: Pending / Approved / Rejected, type, staff, date.
- Kenneth (and management) can **Approve** or **Reject** each one, or approve several at once. Rejecting needs a reason and alerts the person who made the change. Stock changes as soon as a movement is made, so work is never blocked. Rejecting puts the stock back to the earlier amount.

## Parts Requests inbox
- When a technician adds a part to a service or requests one, Kenneth gets a prompt: "New part request: AC… needs [part]".
- A new **Requests** page/tab (his main work queue) goes through: New, then Received/Acknowledged, then Ordering, Ordered, Received, Released to technician. Each step alerts the technician and the assigned admin.
- Opening a request shows the ticket, device, the technician's parts note and stock on hand, with a one-tap "Reserve from stock" when the part is available.

## Making Inventory Management more organized
- Tabs: **Overview, Items, Requests, Movements (Logs), Pre-Ordered, Suppliers**.
- **Overview**: stock value, low-stock count, pending approvals, open requests, and most-used parts in the last 30 days.
- **Items**: search, category/brand/model filters, low-stock highlight, stock-level badges, and a part history drawer (every movement for that part).
- **Movements/Logs**: one unified, searchable timeline with CSV export, replacing the current plain log.
- **Suppliers**: supplier list with the parts each one supplies and when they last ordered.
- Reorder suggestions: parts below reorder level, plus fast-moving parts likely to run out within 7 days.


## Technical details
- Add `inventory` to the `app_role` enum and store it as an extra row in user_roles (admin + inventory), so all existing admin checks keep working unchanged.
- Auth context exposes `hasInventoryAccess` (management or inventory role). InventoryManagement uses it instead of the admin read-only rule. Sidebar and command palette get the label "Admin + Inventory".
- Database: inventory write policies already allow admins. No other policy changes are needed.
- Data change: remove Kenneth's management role and add admin + inventory.
- Menu.tsx: when the user has the inventory role, render the new InventoryDashboard section above a reduced service summary.
