# Plan: Premium Mobile App Experience + PWA

## Goal
Make ACTech Hub feel like a real installed mobile app on phones while preserving the current desktop dashboard/workbench experience and all existing repair, POS, inventory, reports, attendance, notification, and staff workflows.

## What changes for users
- Phones get a dedicated app-style shell instead of the current mobile header plus side menu pattern.
- Desktop keeps the current professional sidebar/workbench layout.
- Data-heavy pages keep readable tables where tables are the best format, with controlled horizontal scrolling on mobile.
- Long forms and dialogs become phone-friendly workflows with large controls, sticky actions, and bottom/full-screen sheets.
- The app becomes installable with offline app-shell support, icons, splash/loading polish, and standalone launch behavior.

## Current state confirmed
- The app already has desktop and mobile branches in the main layout.
- The current mobile shell still uses a hamburger-triggered side sheet plus workbench tabs.
- A manifest, app icons, Apple touch icon, install page, splash screen, and OneSignal push workers already exist.
- There is no app-shell PWA plugin currently enabled; the config explicitly leaves the old PWA plugin disabled for OneSignal.
- Major data-heavy screens include Service Tracker, Inventory, Reports, Salary Disbursement, Attendance, Transaction Tracker, Customer Management, Completed Services, and Requests for Parts.
- The project already includes a Drawer primitive, so mobile bottom-sheet patterns can be added without changing business logic.

## Implementation approach

### 1. Mobile app shell
- Keep the desktop shell unchanged for tablet/desktop.
- Replace the phone shell with:
  - compact safe-area-aware top bar,
  - persistent bottom navigation for the most important destinations,
  - a More sheet for secondary destinations,
  - mobile search/notifications/messages as contextual top actions,
  - bottom padding so content never hides behind the home indicator.
- Use role-aware navigation:
  - Management/Admin: Dashboard, POS, Intake, Tracker, More.
  - Technician: Dashboard, Update, Tracking, Parts, More.
- Keep existing routing and workbench tab behavior behind the scenes so opened screens and data loading still work.

### 2. Mobile dashboard redesign
- Rework the mobile dashboard only:
  - greeting/current context,
  - most important operational metric,
  - thumb-friendly primary actions,
  - horizontally swipeable shortcuts,
  - compact “due today / overdue / recent” sections,
  - management-only operational summaries where relevant.
- Keep the desktop dashboard layout and cards intact.

### 3. Mobile table treatment
- Create reusable mobile table wrappers for data-heavy pages:
  - contained horizontal scrolling,
  - no page-wide sideways overflow,
  - readable minimum column widths,
  - comfortable row height,
  - optional sticky first column for ticket/client/transaction identifiers,
  - subtle edge cue that more columns exist.
- Apply this to high-density tables first: Service Tracker, Inventory, Reports, Salary Disbursement, Attendance, Transaction Tracker, Customer Management, Completed Services, Requests for Parts.
- Convert only simple action-oriented lists into mobile cards/rows where it is clearly better than a table.

### 4. Mobile search, filters, and sorting
- Move cramped filter rows on phone into a clean pattern:
  - always-visible search where important,
  - compact filter chips for common filters,
  - “Filter & Sort” bottom sheet for advanced filters,
  - clear/reset actions.
- Preserve all existing filter logic, date ranges, cut-off presets, sorting, pagination, and role-based behavior.

### 5. Mobile forms and workflows
- Improve mobile versions of major form-heavy screens without changing their saved data:
  - Client Intake / Queue Intake,
  - Manage Client,
  - Service Update,
  - POS transaction flows,
  - Inventory item/request flows,
  - Staff and attendance forms.
- Use one-column grouped sections on phone, larger inputs, proper keyboard types, and sticky Save/Submit action bars for long workflows.
- Use full-screen sheets for complex work and bottom sheets for quick selections/actions.

### 6. Mobile modal system
- Add a responsive wrapper/pattern for dialogs:
  - desktop remains centered dialog,
  - phone uses bottom sheet for short actions,
  - phone uses full-screen sheet for long forms or previews.
- Prioritize the current high-use modals first: service preview, payment/receipt/warranty actions, service update dialogs, inventory/request dialogs, salary review/deductions, transaction edit/void/logs, photo galleries.

### 7. Touch, safe areas, and motion
- Standardize mobile touch targets around 44px or larger.
- Add safe-area spacing to fixed headers, bottom navigation, and sticky action bars.
- Add fast, subtle transitions for page/content changes, sheet open/close, tabs, pressed buttons, and collapsible sections.
- Avoid hover-only controls on mobile and keep desktop hover behavior intact.

### 8. PWA upgrade
- Keep existing app name/branding: ACTech Hub / AC Tech Repair.
- Keep and refine the manifest, app icons, Apple metadata, theme/background colors, and splash/loading experience.
- Add guarded offline app-shell support using the standard PWA plugin path:
  - generated `/sw.js`,
  - no service worker registration in Lovable preview, iframe preview, or local development,
  - `?sw=off` kill switch,
  - navigation requests use network-first behavior,
  - hashed static assets use cache-first behavior,
  - OAuth/auth callback paths are excluded from navigation fallback/caching.
- Preserve existing OneSignal push workers and avoid replacing them.
- Make sure installed-app routing still opens authenticated and public routes correctly.

### 9. Install experience
- Polish the existing Install page and add a low-pressure install CTA where appropriate.
- Detect standalone/installed mode and avoid repeatedly showing install prompts.
- Keep iOS guidance for Add to Home Screen.
- Do not interrupt active repair/POS workflows with aggressive prompts.

### 10. QA and verification
- Check phone widths: 320, 375, 390, and 430.
- Check tablet and desktop widths.
- Verify no unintended page-wide horizontal scroll.
- Verify mobile table containers scroll horizontally on their own.
- Verify bottom navigation, More sheet, notifications/messages, search, forms, filters, sorting, pagination, and sticky actions.
- Verify service update/manage-client workflows still save correctly.
- Verify install metadata, standalone launch behavior, service worker guards, and routing.
- Verify dark mode-compatible tokens and avoid hardcoded visual colors in new UI code.

## Technical notes
- No database, authentication, API, reporting formula, salary, POS, notification, or repair-status business-rule changes are planned.
- New visual styles will use existing semantic design tokens and any needed new tokens in the global design system.
- Existing OneSignal push notification files stay in place.
- Offline support will be limited to the app shell and static assets; live repair data still depends on network access.
