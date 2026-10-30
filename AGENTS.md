# Project Architecture Rules
- Reports paginate date-scoped financial and completed-ticket queries, including the comparison period and older-intake completions; interpret picker days in Manila so totals are complete across browser timezones.

- Public quote response eligibility lives in a tested helper; reopened declines may respond only while Waiting to Proceed and unlocked, preserving completed approvals and partial-approval locks.

- Keep home-screen install metadata and OneSignal push, but do not use an app-shell service worker; stale offline shells caused recurring blank screens after releases.
- Store daily staff-duty acknowledgements in activity logs keyed by account and Manila date so dismissal follows the staff account across devices without a second state table.- Public /track reads tickets only through PIN-verified database functions (last 4 phone digits); the unverified snapshot is staff-only, so the check cannot be bypassed in the browser.
- Intake auto-assignment uses a daily round-robin (fewest tickets today, then longest since last assignment, then day-rotated roster); use the shared staff availability check for eligibility so intake and ticket-edit screens follow the same attendance rule.
- Inventory staff = admin role + extra 'inventory' role row; stock changes are captured by database triggers into stock_movements (auto-approved for inventory/management), so every code path that edits stock is audited without client changes.
