## Goal
On the public `/track` ticket card, make the Copy button copy the full tracking link and add a QR code modal next to it.

## Changes (all in `src/pages/ServiceTracking.tsx`)

1. Build the share URL as `https://actechrepair-service.com/track/{serviceId}` (using the resolved `serviceData.serviceId || serviceId`).
2. **Copy button**: copy the full share URL instead of just the ticket ID; toast says "Tracking link copied".
3. **New "QR" button** beside Copy (ghost, same size, with a QR icon) that opens a Dialog containing:
   - the generated QR code image (rendered via the already-installed `qrcode` package to a data URL)
   - the ticket ID and the share link text
   - actions: Copy link, Download QR (PNG), and native Share (when `navigator.share` is available)
4. Modal follows project modal rules (vertical flex, `max-h-[95dvh]`, internal scroll) and uses semantic tokens only — no hardcoded colors.

## Technical notes
- Use `QRCode.toDataURL(url, { width: 512, margin: 1 })` in a small `useEffect` triggered when the modal opens; store the data URL in local state.
- No backend, schema, or data-fetching changes.
