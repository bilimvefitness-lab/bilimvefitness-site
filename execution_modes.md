# EXECUTION MODES & OPERATIONAL RULES

This document defines the two operational modes and critical safety rules to optimize for both **Speed** and **Correctness**.

## 1. EXECUTION MODES

### MODE 1 — FAST MODE ⚡
Used for small UI bugs, obvious issues, and low-risk changes.
- **Flow**: Debug Lead → Mobile Engineer → Debug Lead (Verify).
- **Skips**: UX Optimizer, Growth, Nutrition Engine (unless relevant).
- **Goal**: Speed and iteration velocity.

### MODE 2 — FULL MODE 🧠
Used for nutrition logic, state sync, save pipeline, unclear bugs, and new feature development.
- **Flow**: Full multi-agent chain (Debug Lead, Mobile Engineer, Nutrition Engine, UX Optimizer, Growth/Retention).
- **Goal**: Absolute correctness, data integrity, and production safety.

---

## 2. TRANSITION RULES
- **Default**: FAST MODE.
- **Upgrade to FULL MODE if**:
    - The bug is not solved in the first iteration (**AUTO ESCALATION RULE**).
    - The task touches multiple layers (e.g., UI and State and Storage).
    - The task affects the Nutrition Module or Data Integrity.
    - The bug root cause is unclear.

---

## 3. CORE OPERATIONAL RULES

### AUTO ESCALATION RULE 🚀
If a task is not solved in one iteration:
1. **Automatically switch** to FULL MODE.
2. **Involve all agents** for a deep-dive analysis.
3. **Perform full layer analysis** before the next edit.
*No repeated blind fixes are permitted.*

### STABLE SYSTEM PROTECTION RULE 🔒
If a system or module is working correctly:
- **DO NOT** refactor it.
- **DO NOT** optimize it prematurely.
- **DO NOT** rewrite it for "cleanliness."
*Only touch broken parts or proven bottlenecks. Protect working flows aggressively.*

---
**Status**: ACTIVE
**Enforcement**: STRICT
**Priority**: Momentum + Safety
