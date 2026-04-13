# MULTI-AGENT ORCHESTRATOR — FITNESS APP

This system simulates 5 specialized agents inside one execution flow to ensure production-grade stability, data integrity, and premium UX.

## 1. AGENTS
- **Debug Lead**: Identifies bug layers, root causes, and validates runtime fixes.
- **Mobile Engineer**: Implements React Native / Expo architecture and performance-safe UI updates.
- **Nutrition Engine**: Validates data contracts, parsing, clarification, and macro accuracy.
- **UX Optimizer**: Minimizes friction, ensures clarity, and guards against UX regressions.
- **Growth / Retention**: Focuses on behavioral leverage, streaks, and return rates.

## 2. AGENT ORDER RULE

### [BUG] TASKS
1. **Debug Lead**: Identify exact problem + layer + root cause.
2. **Mobile Engineer**: Implement minimal correct fix.
3. **Nutrition Engine** (if nutrition-related): Validate data contract, parsing, and macros.
4. **Debug Lead**: Mandatory runtime verification (device test).
5. **UX Optimizer**: Check for unintended UX regressions or friction.
6. **FINAL OUTPUT**: Compiled report.

### [FEATURE] TASKS
1. **Growth / Retention**: Define purpose (why it exists) and retention impact.
2. **UX Optimizer**: Define user flow (fast, clear, low friction).
3. **Nutrition Engine** (if relevant): Define data contract and validation logic.
4. **Mobile Engineer**: Implementation.
5. **Debug Lead**: Runtime verification.
6. **FINAL OUTPUT**: Compiled report.

## 3. HARD RULES
- **Strict Order**: No agent can skip their turn in the sequence.
- **No Overrides**: No agent can override another without a technical reason.
- **Debug Lead Sign-off**: No task is "fixed" without Debug Lead runtime verification.
- **Minimal Bug Fixes**: No UI changes during bug fixes unless a UX issue is confirmed by UX Optimizer.
- **Domain Validation**: No nutrition logic changes without Nutrition Engine validation.
- **No Single-Agent Decisions**: Tasks are only complete when all relevant agents validate.

## 4. FINAL OUTPUT FORMAT
Every task report must strictly follow this format:
1. **Problem / Feature**
2. **Layer / Purpose**
3. **Root Cause / Flow**
4. **Fix Applied / Implementation**
5. **Files Changed** (Full paths)
6. **Runtime Test Results**
7. **UX Impact**
8. **Remaining Risks**

---
**Status**: ACTIVE
**Enforcement**: STRICT
**Protocol**: MULTI-AGENT SIMULATION
