---
description: Resolve detailed bug reports from the user without them needing to code
---

# Debug Incident Workflow

Use this workflow when the User/CEO reports a functional bug (e.g. "The temperature alert says 20 but should be 90").

## Philosophy: Test-Driven Debugging
Never fix a bug blindly. Always prove it first.

## Steps

### 1. Replicate (The "Sneeze" Test)
Creates a minimal test case that reproduces the reported error.
*   **Action**: Create `tests/repro_issue_NAME.py`.
*   **Content**: A unit test that inputs the data the user described and asserts the *wrong* behavior (or asserts the *correct* behavior and expects it to fail).
*   **Run**: `pytest tests/repro_issue_NAME.py` -> **MUST FAIL** (RED).

### 2. Diagnose (The Doctor)
Analyze *why* the test failed.
*   Is it a logic error in `execution/`?
*   Is it a wrong configuration in `.tmp/mocks`?
*   Is the Directive wrong?

### 3. Fix (The Surgeon)
Modify the code to satisfy the test.
*   **Action**: Edit the code.
*   **Run**: `pytest tests/repro_issue_NAME.py` -> **MUST PASS** (GREEN).

### 4. Verify & Merge
*   **Run All Tests**: Ensure the fix didn't break anything else.
*   **Clean Up**: Rename `repro_issue_NAME.py` to `tests/test_issue_NAME.py` and keep it forever (prevent regression).

### 5. Report to CEO
"Incidente Resuelto. He creado un test que replicaba tu caso (Temp 20). He corregido la lógica en `alert_rules.py`. El test ahora pasa."
