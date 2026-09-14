# Editable Warranty Card on Manage Client

## What will change
- Change the existing Warranty Card action from **Update** to **Edit** when a card already exists.
- Open a focused modal listing every currently approved service line, its amount, and its saved warranty type.
- Pre-fill the modal from the warranty terms already stored on the ticket.
- On save, persist the edited warranty type for each approved line and recreate the A5 Warranty Card from current ticket data.
- Refresh the Ticket Documents row so View, Print, and Download immediately use the updated card.

## Technical details
- Extend the Ticket Documents component with a Warranty Card edit dialog using the existing warranty-field controls and document context loader.
- Keep **Generate** for a missing card; only an existing Warranty Card shows **Edit**.
- Reuse the existing regeneration path so approved lines, client details, payment state, staff signature, storage replacement behavior, and activity logging remain consistent.
- Disable saving when the ticket has no approved service lines and surface any fully-paid or generation failure clearly.

## Validation
- Verify saved custom and preset warranty terms reopen correctly.
- Verify saving regenerates the card and refreshes its available actions.
- Run the relevant project checks.
