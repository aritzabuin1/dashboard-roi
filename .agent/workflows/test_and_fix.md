---
description: Run all tests and fix failures automatically (self-annealing)
---

# Test and Fix Workflow

Run this workflow to execute tests and auto-fix failures.

## Steps

1. **Run All Tests**
   ```bash
   python -m pytest tests/ -v --tb=short
   ```

2. **If Tests PASS**
   - Report success and exit.

3. **If Tests FAIL**
   - Read the error message and stack trace.
   - Identify the failing function and the assertion that failed.
   - Fix the code in `execution/` or `shared/`.
   - **Do NOT modify the test itself** unless explicitly asked.
   - Re-run the test for that specific file:
     ```bash
     python -m pytest tests/test_FILENAME.py -v
     ```

4. **Repeat Until All Pass**
   - Maximum 3 iterations to avoid infinite loops.
   - If still failing after 3 attempts, report the issue to the user.

5. **Update Directive (Self-Annealing)**
   - If the fix revealed a new edge case, update the relevant directive in `directives/`.
   - Example: If we learned that WhatsApp rejects messages >1000 chars, update `directives/12_send_notifications.md`.
