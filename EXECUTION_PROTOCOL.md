# FITNESS APP EXECUTION PROTOCOL

This protocol defines the mandatory operational lifecycle for every task, bug fix, or feature implementation.

## PHASE 1: PROBLEM DEFINITION (MANDATORY BEFORE CODE)
Identify and describe the following:
1. **Problem Type**: Bug | UX | Performance | Feature | Architectural.
2. **Layer**: UI | State | Network | Parser | Clarification | Save Pipeline | Storage | Render.
3. **Failure Description**: User Action -> Expected -> Actual.

## PHASE 2: IMPACT ANALYSIS
- **Scope**: Systems touched (Preview | Save | Totals | UI Sync).
- **Blast Radius**: Local or Cross-module.
- **Risk Assessment**: State any potential side effects.

## PHASE 3: MINIMAL'FIX'STRATEGY
- **Smallest Possible Fix**: Change only the required layer first.
- **No Refactors**: Do not touch unrelated code.
- **No Redesigns**: Do not redesign UI while fixing data flow.

## PHASE 4: IMPLEMENTATION STANDARDS
- **Explicit Logic**: No hidden side effects or implicit assumptions.
- **No Silent Fallbacks**: Fail early and loudly.
- **Single Source of Truth**: No duplicate state sources.

## PHASE 5: RUNTIME VERIFICATION (MANDATORY)
Test at least the following:
1. **Simple Case**: e.g., "100g yulaf".
2. **Ambiguous Case**: e.g., "1 tabak pilav".
3. **Full Flow**: Input -> Preview -> Save -> Daily Totals -> UI Update.
4. **Confirm**: Preview works, clarification works, save works, UI updates instantly.

## PHASE 6: REPORTING FORMAT
Every task report must strictly follow this format:
1. **Problem Identified**
2. **Layer Affected**
3. **Root Cause**
4. **Files Changed** (Full paths)
5. **Exact Fix Applied**
6. **Runtime Test Results**
7. **Remaining Risks**

## PHASE 7: REGRESSION CHECK
Confirm that the change does NOT break:
- Previously working flows.
- Other meal types.
- Daily summary/Detail view.

## GLOBAL RULES
- **No Silent Failures**: Every error must be user-facing and logged.
- **No Fake Success UI**: Do not show success before confirmation.
- **No Unverified Fixes**: Runtime validation is mandatory.
- **No Multi-layer Random Edits**: Fix only what is identified.
- **Correctness > Speed**.

---
**Status**: ACTIVE
**Enforcement**: STRICT
**Owner**: Fitness Product Engineer
