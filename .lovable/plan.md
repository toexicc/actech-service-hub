## Goal
Make the Service Calendar section a strict 70/30 split: calendar card takes 70% width, "services due" card takes 30%. Fix the UI so the calendar actually fills its 70% column instead of shrinking to `w-fit`.

## Why it's been failing
`src/components/DueDateCalendar.tsx` sets the Calendar wrapper to `w-fit` and each day cell to a fixed pixel width. Even when the grid column is 70%, the calendar renders at its intrinsic width and leaves whitespace, so visually it doesn't look 70/30.

## Changes (single file: `src/components/DueDateCalendar.tsx`)

1. **Grid split — hard 70/30**
   - Replace the current `md:grid-cols-[minmax(520px,2fr)_minmax(260px,1fr)] lg:grid-cols-[minmax(640px,3fr)_minmax(280px,1fr)]` with `md:grid-cols-[70%_30%]`.
   - Keep mobile as single column stack.

2. **Calendar fills its column**
   - Change calendar wrapper from `w-fit` + `overflow-x-auto` to `w-full`.
   - Change Calendar root `className` from `w-fit` to `w-full`.
   - Change `table` classNames from `w-fit` to `w-full`.
   - Change `head_row` and `row` from `flex w-fit` to `flex w-full justify-between`.
   - Change `head_cell`, `cell`, `day` widths from fixed `w-12/w-14` to `flex-1` so the 7 columns evenly divide the available width.
   - Keep the compact row height (`h-10 lg:h-11`) so the calendar doesn't get taller — only wider.

3. **Right card — 30% column, centered empty state**
   - Keep `flex flex-col` with the empty state `flex-1 items-center justify-center` so "No services due on this day." stays vertically centered.
   - Ensure the card has `h-full` so its height matches the calendar card.

## What stays the same
- Section header, "X active tickets" label, date heading, due count, list rendering, and click-through behavior are unchanged.
- No changes to any other file, hook, or business logic.

## Result
Calendar visibly occupies ~70% of the row and stretches its day cells to fill; the due-services card occupies ~30% with its empty-state text vertically and horizontally centered. Row height stays compact.
