# Company Intake: match the regular intake, per-device setup, Romar as default admin

## What changes for staff

**Shared section at the top (applies to the whole batch)**
- Batch (new or existing), Priority, Diagnostic Time Frame, Default Location/Site
- **Admin Rep: Romar Badilles by default** (can still be changed, same list as the regular intake)
- Receiving Staff: whoever is logged in (same as regular intake)
- Client, contact, email, address and Invoice/VAT still filled in automatically from the company
- Device Type and Technician Department are **removed from the shared section**

**Each device row (same fields and order as the regular intake)**
- Device Type (required, per device)
- Technician Department (picked automatically from that device's type, can be changed)
- Technician (shows who will be assigned automatically, e.g. "Auto: Jefferson"; can be overridden with only timed-in, not-on-leave techs)
- Serial, Brand, Color, Model, Storage (with the same brand/model/colour/storage suggestions and tidying as intake)
- Location/Site (defaults to the shared one)
- Chief Complaint (the company's reported issue) with the same **Format with AI** button
- Device Password
- Device Accessory toggle + picker (same options as intake)
- "Needs individual quote" checkbox (from the company sheet)

**Row layout**
- Each device is a compact numbered card (two rows of fields) instead of a cramped single line, so every field is readable
- "Add device" and "Duplicate this device" (copies device type, department, brand, model, colour, storage, location — not serial/complaint)
- A device missing Device Type, Model/Serial or Chief Complaint is highlighted before submitting

**Spreadsheet paste** keeps working using the sheet's column order (Location, Serial, Model, Reported Issue); pasted rows still need a device type, with a "set device type for all pasted rows" shortcut.

## Assignment rules (unchanged, now per device)
- Each device is assigned on its own by the same daily rotation as the regular intake (fewest tickets today, then longest since last ticket), only among technicians who timed in today and aren't on leave
- Rotation counts update as each device is assigned, so a batch spreads across the eligible techs of each department
- If a device's department has nobody available, that row is flagged and nothing is created until fixed
- Each ticket's admin rep = the chosen Admin Rep (Romar by default); new-ticket alerts go to the assigned technician and that admin

## Technical details
- `src/components/company/CompanyIntakeDialog.tsx`: move `deviceType`/`dept` into `Row`; add `technician` (auto/override), `color`, `memory`, `devicePassword`, `hasAccessory`, `accessories`, `needsIndividualQuote`; shared `adminRep` state defaulting to the staff record named "Romar Badilles" (fallback: logged-in user if not found).
- Per-row pool = active technicians in the row's department passing `availability.isAvailable`; preview computed by simulating `pickRoundRobin` over rows in order with today's `fetchTodayAssignments` counts; submit recomputes with fresh counts unless a row has a manual override.
- Payload to `create_service_atomic`: per-row `device_type`, `technician_departments`, `technicians`, `color`, `memory`, `device_password`, `admin_reps: [adminRep]`, `receiving_staff: actor`; follow-up update sets `company_*`, `vat_requested`, `has_device_accessory`, `device_accessories`, `needs_individual_quote`.
- Reuse existing intake pieces: `DeviceAccessoryPicker`, device catalog suggestion inputs, `format-complaint` AI function (detailed mode), `TIME_FRAME_OPTIONS`, `DEVICE_TYPES_BY_DEPARTMENT`.
- Activity log and `notifyNewServiceAssignment` per ticket with the row's device type, technician and the chosen admin rep.
- Add a small test for the per-row assignment simulation (different device types go to different department pools; load spreads within a department).
