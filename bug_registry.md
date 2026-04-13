# BUG REGISTRY — FITNESS APP

This registry tracks all active, fixed, blocked, and monitored bugs to ensure zero silent failures and a stable production environment.

## STATUS DEFINITIONS
- **OPEN**: Confirmed bug, not fixed yet.
- **IN PROGRESS**: Currently being worked on.
- **VERIFYING**: Code changed, awaiting runtime/device confirmation.
- **FIXED**: Confirmed on running app.
- **BLOCKED**: Cannot proceed due to dependencies or missing info.
- **MONITORING**: Seems fixed but watched for regression.

## SEVERITY DEFINITIONS
- **P0 — CRITICAL**: App unusable, save broken, nutrition data untrustworthy, or crashes.
- **P1 — HIGH**: Major feature broken, bad state sync, or strong friction.
- **P2 — MEDIUM**: Partial bug, non-blocking but important visible UX issue.
- **P3 — LOW**: Cosmetic or minor edge-case polish.

---

## ACTIVE BUGS

### NUT-014 — Pilav clarified sonrası makrolar güncellenmiyor
**Status**: FIXED  
**Severity**: P1  
**Mode**: FULL  
**Layer**: clarification / state sync  
**Area**: nutrition  
**User Action**: User types "1 tabak pilav" and selects a portion option.  
**Expected**: Preview resolves, macros update, Ekle becomes enabled.  
**Actual**: Preview partially resolves but macros do not refresh correctly.  
**Root Cause**: Stale overrides from fixed item indices being applied to changed content.  
**Files Involved**: 
- `C:\Users\emres\OneDrive\Belgeler\Playground\mobile\src\screens\NutritionScreen.js`
- `C:\Users\emres\OneDrive\Belgeler\Playground\mobile\src\context\AppContext.js`
**Assigned Agents**: Debug Lead, Mobile Engineer, Nutrition Engine  
**Fix Strategy**: Content-aware override validation in `loadNutritionPreview`.  
**Runtime Test Required**: 
- simple case: 100g yulaf ✅
- ambiguous case: 1 tabak pilav ✅
- full flow: preview → save → daily totals ✅
**Regression Risk**: Low  
**Notes**: Ported to content-aware key instead of index-only.  
**Final Verification**: FIXED — Confirmed that drifting content blocks stale overrides.

---
**Registry Status**: ACTIVE
