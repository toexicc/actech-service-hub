# AI Diagnosis box: Clear button, matching fonts, correct option pricing

## 1. Replace Edit/Lock with Clear

The AI Diagnosis text is currently locked until you press "Edit". Remove that lock entirely: the AI Diagnosis box (and every other field in the section) is always editable.

In its place, a "Clear" button that empties all fields in the AI Diagnosis container in one click — AI Diagnosis, Service Breakdown (draft), Warranty, Other Notes and Summary — after a short confirm ("Clear all AI Diagnosis fields?"). Clearing only affects the form; nothing is saved until Update is pressed, so a mistaken clear can be undone by reloading.

Applies to both /manage-client and /service-update so the two pages behave the same.

## 2. Service Breakdown font

The draft Service Breakdown textarea uses a monospace font while every neighbouring box uses the normal UI font. Drop the monospace styling so it matches AI Diagnosis, Warranty, Other Notes and Summary.

## 3. Main service line must not carry an amount when it has options

When a service has Option A / Option B lines, the parent line should be the service name only:

```text
Battery Replacement
Option A - OEM: Php {Enter Amount}
Option B - Original: Php {Enter Amount}
LCD Replacement - Php {Enter Amount}
```

The AI prompt already says this, but the safety pass that guarantees every breakdown line ends with a price appends the placeholder to the parent line too, producing "Battery Replacement – Php {Enter Amount}" above its options. Fix that pass to look ahead: if the next non-blank breakdown line is an Option line, strip any amount/placeholder from the parent line instead of adding one. Lines with no options keep "- Php {Enter Amount}".

## Technical notes

- `src/pages/ManageClient.tsx` and `src/pages/ServiceUpdate.tsx`: remove `isEditingAIDiagnosis` state, the Edit/Lock button and the `disabled`/muted styling on the AI Diagnosis textarea; add the Clear button that resets the five diagnosis state values. Remove `font-mono` from the draft breakdown textarea.
- `supabase/functions/format-diagnosis/index.ts`: in `enforceAmountPlaceholders`, detect parent-with-options lines and strip rather than append the placeholder; redeploy the function.
