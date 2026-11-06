# Test Suite — To-Do List Life Dashboard

## How to Run Tests

### Option 1: Browser-based test runner (no install required)

Open `tests/test_runner.html` directly in any modern browser:

```
file:///path/to/project/tests/test_runner.html
```

The page loads `js/app.js` and runs ~70 tests covering all widgets.
Results appear immediately with pass/fail per test and a summary banner.

### Option 2: Python unit tests (Python 3.10+ required)

Tests the pure logic functions (greeting, timer format, storage, todo, links):

```bash
python tests/test_dashboard_logic.py
```

Expected output: `Ran 60 tests in ~0.3s  OK`

To use pytest if installed:
```bash
python -m pytest tests/test_dashboard_logic.py -v
```

### Option 3: Jest (requires Node.js + npm)

If Node.js is installed:

```bash
npm install
npm test
```

Jest runs `js/app.test.js` with `jest-environment-jsdom`.

---

## Test Coverage Summary

| Area | Tests | Runner |
|---|---|---|
| StorageUtil round-trip (Task + Link) | 5 | All |
| GreetingWidget._getGreeting (all 24 hours + boundaries) | 9 | All |
| FocusTimerWidget._render (all 0–1500 s, MM:SS format) | 8 | All |
| FocusTimerWidget state (start/stop/reset/tick/endMessage) | 6 | Browser + Jest |
| TodoListWidget._addTask (validation, persistence, rendering) | 11 | All |
| TodoListWidget._toggleTask (toggle, double-toggle inverse) | 5 | All |
| TodoListWidget._deleteTask (removal, DOM, persistence) | 5 | All |
| TodoListWidget._editTask (validation, mutation) | 6 | Python + Jest |
| QuickLinksWidget._addLink (invalid rejected, valid accepted) | 10 | All |
| QuickLinksWidget._deleteLink | 4 | All |
| Integration: init() with seeded/empty localStorage | 5 | Browser + Jest |
| **Total** | **~70** | |

---

## Bugs Found During Review

None. All requirements (1–10) are correctly implemented:

- Req 1: GreetingWidget renders time, date, greeting with correct ranges and fallback.
- Req 2: FocusTimerWidget: 25-min countdown, start/stop/reset, end message, start-at-0 resets.
- Req 3: TodoListWidget add: validation, unique id, complete=false, input cleared, persisted.
- Req 4: Edit mode: inline input, save/cancel, validation, 500-char limit.
- Req 5: Toggle/delete: strikethrough, persistence, focus management.
- Req 6: Persistence under key "todo-life-dashboard-tasks"; null/malformed → empty list.
- Req 7: QuickLinks render as anchors opening in new tab.
- Req 8: Add/delete links; validation (empty label, empty URL, non-http scheme).
- Req 9: Responsive two-column layout at ≥768px; accessible labels and error roles.
- Req 10: No external deps; purely client-side; loads from index.html directly.

One visual improvement applied: added `flex: 1; word-break: break-word` to `.todo-desc` so
task descriptions fill the available row width correctly.
