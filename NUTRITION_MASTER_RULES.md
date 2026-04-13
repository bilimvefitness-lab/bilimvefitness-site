# NUTRITION MASTER RULES & SAFETY PROTOCOL

This document defines the production-grade standards for the Nutrition Module. All modifications, debugging, and verification must strictly adhere to these rules.

## 1. SINGLE SOURCE OF TRUTH (ROOT) RULE
All work must be conducted exclusively in these paths. Any duplicates or experiment folders are INVALID.
- **Frontend Root**: `C:\Users\emres\OneDrive\Belgeler\Playground\mobile`
- **Backend Root**: `C:\Users\emres\OneDrive\Belgeler\Playground`

**Reporting**: Every edit report must specify the EXACT full file path changed.

## 2. MANDATORY RUNTIME'VERIFICATION RULE
No fix is "fixed" until verified on the running app.
- **Protocol**: 
    1. Restart Expo: `npx expo start --clear` (inside `mobile`)
    2. Confirm UI appears correctly on the device.
    3. Test at least one real user flow (e.g., Simple meal and Clarification meal).
    4. Report actual results on device.

## 3. STRUCTURED'CLARIFICATION RULE
**NO STRING MUTATION**. The `mealText` must remain the user's original input.
- **State-Based**: Clarification decisions must be stored in structured state (e.g., `resolvedOverrides` keyed by item index).
- **Scope**: Portions, grams, variants, and ambiguities must use structured resolution.

## 4. ZERO'SILENT FAIL RULE
Failures must be loud and clear. For any failure (Network, Parse, Save, Sync):
1. **Stop** loading states immediately.
2. **Log** the exact technical reason to console/logs.
3. **Show** a user-facing error message (no generic "Error occurred").
4. **Avoid** fake success states or swallowing errors with empty `catch` blocks.

## 5. END-TO-END DATA CONTRACT RULE
The flow must follow this stable sequence:
`Input -> Preview -> Parse -> Clarification -> Calculate -> Submit -> Save -> Local Persistence -> Daily Summary -> Macro Cards/List`

**Pre-Save Validation**:
- `previewData` exists.
- `items` array is not empty.
- All clarifications for specific items are resolved.
- Totals are present or computed.

**Post-Save Sync**:
- Immediate update of `mealList`.
- Recalculate and update `dailyTotals` and `macroCards`.
- Reflect the active date correctly.

---

## NUTRITION CHANGE SAFETY PROTOCOL (NCSP)
Before any edit:
1. **Identify** the bug layer: UI | Network | Parser | Clarification | State Sync | Save Pipeline.
2. **Change** only the required layer first.
3. **Wait**: Do not redesign UI while fixing data flow.
4. **Verify**: Test one simple case and one ambiguous case.
5. **Proceed**: Move to the next issue only after the current layer is solid.

---
**Status**: ACTIVE
**Enforcement**: STRICT
