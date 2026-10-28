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

## Technical details
- Add `inventory` to the `app_role` enum and store it as an extra row in user_roles (admin + inventory), so all existing admin checks keep working unchanged.
- Auth context exposes `hasInventoryAccess` (management or inventory role). InventoryManagement uses it instead of the admin read-only rule. Sidebar and command palette get the label "Admin + Inventory".
- Database: inventory write policies already allow admins. No other policy changes are needed.
- Data change: remove Kenneth's management role and add admin + inventory.
- Menu.tsx: when the user has the inventory role, render the new InventoryDashboard section above a reduced service summary.
