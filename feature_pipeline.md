# FEATURE PIPELINE — FITNESS APP

This pipeline controls how new features are proposed, prioritized, implemented, and verified.

## FEATURE STAGES
- **BACKLOG**: Captured idea, not analyzed yet.
- **SCOPING**: Purpose and impact being defined.
- **DESIGNING**: UX flow + contract being designed.
- **READY**: Approved for implementation.
- **IN BUILD**: Actively being implemented.
- **VERIFYING**: Built, awaiting runtime/device confirmation.
- **SHIPPED**: Confirmed working on running app.
- **MONITORING**: Live and watched for regression or friction.
- **REJECTED**: Intentionally not moving forward.

## PRIORITY DEFINITIONS
- **P0**: Directly affects trust, core USE, or retention engine.
- **P1**: Strong product improvement, noticeable usage impact.
- **P2**: Useful but not urgent.
- **P3**: Nice to have.

---

## ACTIVE FEATURE PIPELINE

### RET-003 — Next Target System
**Stage**: READY  
**Priority**: P1  
**Mode**: FULL  
**Type**: retention system  
**Owner Agents**: Growth / Retention, UX Optimizer, Mobile Engineer, Debug Lead  
**Problem**: Users see progress but do not feel urgency to return tomorrow.  
**Purpose**: Increase daily action probability through short-term target framing.  
**Retention Effect**: Makes streak progression feel closer and more actionable.  
**Friction Effect**: No extra clicks; pure messaging improvement.  
**User Flow**: 1. Dash opens, 2. Streak shown, 3. Remaining days as immediate target.  
**Data Contract**: streak state -> remaining count -> message renderer  
**Implementation Scope**: screen(s): dashboard, context/state: streak display only  
**API/backend**: none, storage: none, analytics: optional  
**Success Criteria**: Users instantly understand how close they are to next level.  
**Runtime Verification**: 
- happy path: streak 5/6 shows 1 day left
- edge case: streak complete hides message
- regression check: old level display not broken
**Files Changed**: Pending  
**Final Result**: Pending

---
**Pipeline Status**: ACTIVE
