"""
test_dashboard_logic.py — Python unit tests for To-Do List Life Dashboard

Tests the pure logic extracted from js/app.js, covering:
  - StorageUtil round-trip (simulated via json.dumps / json.loads)
  - GreetingWidget._getGreeting for all 24 hours
  - FocusTimerWidget._render for all values 0–1500
  - TodoListWidget._addTask / _toggleTask / _deleteTask logic
  - QuickLinksWidget._addLink validation

Run with:  python -m pytest tests/test_dashboard_logic.py -v
       or:  python tests/test_dashboard_logic.py
"""

import json
import math
import unittest
import uuid


# ─── Mirrors of JS pure functions ────────────────────────────────────────────

def get_greeting(hour: int) -> str:
    """Mirror of GreetingWidget._getGreeting(hour)."""
    if 5 <= hour <= 11:
        return 'Good Morning'
    if 12 <= hour <= 17:
        return 'Good Afternoon'
    if 18 <= hour <= 21:
        return 'Good Evening'
    return 'Good Night'  # 22–23 and 0–4


def timer_format(total_seconds: int) -> str:
    """Mirror of FocusTimerWidget._render formatting (returns MM:SS string)."""
    minutes = total_seconds // 60
    seconds = total_seconds % 60
    return f'{minutes:02d}:{seconds:02d}'


def storage_round_trip(data):
    """Mirror of StorageUtil.save + StorageUtil.load (JSON serialization)."""
    serialized = json.dumps(data)
    return json.loads(serialized)


def generate_id() -> str:
    """Mirror of generateId() — collision-resistant string ID."""
    return str(uuid.uuid4())


# ─── Minimal TodoListWidget state machine ────────────────────────────────────

class TodoListWidget:
    """Pure-logic mirror of TodoListWidget (no DOM)."""

    def __init__(self):
        self._tasks = []
        self._last_error = None
        self._last_save_data = None

    def _save(self, fail=False):
        if fail:
            self._last_save_data = None
            return False
        self._last_save_data = storage_round_trip(self._tasks)
        return True

    def _add_task(self, raw_description: str, storage_fail=False) -> bool:
        description = raw_description.strip()
        if len(description) == 0:
            self._last_error = 'Task description cannot be empty.'
            return False
        if len(description) > 500:
            self._last_error = 'Task description must be 500 characters or fewer.'
            return False
        task = {'id': generate_id(), 'description': description, 'complete': False}
        self._tasks.append(task)
        self._last_error = None
        self._save(fail=storage_fail)
        return True

    def _toggle_task(self, task_id: str):
        task = next((t for t in self._tasks if t['id'] == task_id), None)
        if task is None:
            return
        task['complete'] = not task['complete']
        self._save()

    def _delete_task(self, task_id: str):
        self._tasks = [t for t in self._tasks if t['id'] != task_id]
        self._save()

    def _edit_task(self, task_id: str, new_desc: str) -> bool:
        description = new_desc.strip()
        if len(description) == 0:
            self._last_error = 'Task description cannot be empty.'
            return False
        if len(description) > 500:
            self._last_error = 'Task description must be 500 characters or fewer.'
            return False
        task = next((t for t in self._tasks if t['id'] == task_id), None)
        if task:
            task['description'] = description
        self._save()
        return True


# ─── Minimal QuickLinksWidget state machine ──────────────────────────────────

class QuickLinksWidget:
    """Pure-logic mirror of QuickLinksWidget (no DOM)."""

    def __init__(self):
        self._links = []
        self._last_error = None
        self._save_called = False

    def _save(self):
        self._save_called = True
        storage_round_trip(self._links)

    def _reset_save_flag(self):
        self._save_called = False

    def _add_link(self, raw_label: str, raw_url: str) -> bool:
        label = raw_label.strip()
        url   = raw_url.strip()
        if len(label) == 0:
            self._last_error = 'Label cannot be empty.'
            return False
        if len(url) == 0:
            self._last_error = 'URL cannot be empty.'
            return False
        if not (url.startswith('http://') or url.startswith('https://')):
            self._last_error = 'URL must start with http:// or https://'
            return False
        link = {'id': generate_id(), 'label': label, 'url': url}
        self._links.append(link)
        self._last_error = None
        self._save()
        return True

    def _delete_link(self, link_id: str):
        self._links = [l for l in self._links if l['id'] != link_id]
        self._save()


# ─── Test Cases ───────────────────────────────────────────────────────────────

class TestStorageRoundTrip(unittest.TestCase):
    """Property 2 & 7: serialization round-trips."""

    def test_task_round_trip_preserves_all_fields(self):
        tasks = [
            {'id': 'abc', 'description': 'Buy milk', 'complete': False},
            {'id': 'def', 'description': 'Write tests', 'complete': True},
        ]
        result = storage_round_trip(tasks)
        self.assertEqual(len(result), 2)
        for orig, loaded in zip(tasks, result):
            self.assertEqual(loaded['id'],          orig['id'])
            self.assertEqual(loaded['description'], orig['description'])
            self.assertEqual(loaded['complete'],    orig['complete'])

    def test_link_round_trip_preserves_all_fields(self):
        links = [
            {'id': 'l1', 'label': 'GitHub', 'url': 'https://github.com'},
            {'id': 'l2', 'label': 'MDN',    'url': 'https://developer.mozilla.org'},
        ]
        result = storage_round_trip(links)
        self.assertEqual(len(result), 2)
        for orig, loaded in zip(links, result):
            self.assertEqual(loaded['id'],    orig['id'])
            self.assertEqual(loaded['label'], orig['label'])
            self.assertEqual(loaded['url'],   orig['url'])

    def test_empty_array_round_trip(self):
        self.assertEqual(storage_round_trip([]), [])

    def test_null_loads_back_as_none(self):
        result = json.loads(json.dumps(None))
        self.assertIsNone(result)

    def test_malformed_json_raises(self):
        with self.assertRaises(json.JSONDecodeError):
            json.loads('{invalid}')


class TestGreetingWidget(unittest.TestCase):
    """Property 1: greeting classification covers all hours."""

    VALID_GREETINGS = {'Good Morning', 'Good Afternoon', 'Good Evening', 'Good Night'}

    def test_all_24_hours_return_valid_greeting(self):
        for h in range(24):
            with self.subTest(hour=h):
                result = get_greeting(h)
                self.assertIn(result, self.VALID_GREETINGS)

    def test_morning_hours_5_to_11(self):
        for h in range(5, 12):
            with self.subTest(hour=h):
                self.assertEqual(get_greeting(h), 'Good Morning')

    def test_afternoon_hours_12_to_17(self):
        for h in range(12, 18):
            with self.subTest(hour=h):
                self.assertEqual(get_greeting(h), 'Good Afternoon')

    def test_evening_hours_18_to_21(self):
        for h in range(18, 22):
            with self.subTest(hour=h):
                self.assertEqual(get_greeting(h), 'Good Evening')

    def test_night_hours_22_23_and_0_to_4(self):
        for h in [22, 23, 0, 1, 2, 3, 4]:
            with self.subTest(hour=h):
                self.assertEqual(get_greeting(h), 'Good Night')

    def test_boundary_hour_5_is_morning_not_night(self):
        self.assertEqual(get_greeting(5),  'Good Morning')
        self.assertEqual(get_greeting(4),  'Good Night')

    def test_boundary_hour_12_is_afternoon_not_morning(self):
        self.assertEqual(get_greeting(12), 'Good Afternoon')
        self.assertEqual(get_greeting(11), 'Good Morning')

    def test_boundary_hour_18_is_evening_not_afternoon(self):
        self.assertEqual(get_greeting(18), 'Good Evening')
        self.assertEqual(get_greeting(17), 'Good Afternoon')

    def test_boundary_hour_22_is_night_not_evening(self):
        self.assertEqual(get_greeting(22), 'Good Night')
        self.assertEqual(get_greeting(21), 'Good Evening')


class TestFocusTimerWidget(unittest.TestCase):
    """Property 9: timer format is always valid MM:SS."""

    def test_1500_seconds_formats_as_25_00(self):
        self.assertEqual(timer_format(1500), '25:00')

    def test_0_seconds_formats_as_00_00(self):
        self.assertEqual(timer_format(0), '00:00')

    def test_90_seconds_formats_as_01_30(self):
        self.assertEqual(timer_format(90), '01:30')

    def test_61_seconds_formats_as_01_01(self):
        self.assertEqual(timer_format(61), '01:01')

    def test_59_seconds_formats_as_00_59(self):
        self.assertEqual(timer_format(59), '00:59')

    def test_all_values_0_to_1500_match_mm_ss_pattern(self):
        import re
        pattern = re.compile(r'^\d{2}:\d{2}$')
        for s in range(0, 1501):
            with self.subTest(seconds=s):
                result = timer_format(s)
                self.assertRegex(result, pattern)

    def test_minutes_and_seconds_are_correct(self):
        for s in range(0, 1501):
            with self.subTest(seconds=s):
                result = timer_format(s)
                mm, ss = result.split(':')
                expected_mm = s // 60
                expected_ss = s % 60
                self.assertEqual(int(mm), expected_mm)
                self.assertEqual(int(ss), expected_ss)

    def test_seconds_part_never_exceeds_59(self):
        for s in range(0, 1501):
            with self.subTest(seconds=s):
                _, ss = timer_format(s).split(':')
                self.assertLessEqual(int(ss), 59)


class TestTodoListWidgetAdd(unittest.TestCase):
    """Property 3 & 4: adding valid/invalid tasks."""

    def setUp(self):
        self.widget = TodoListWidget()

    def test_add_valid_task_grows_list_by_one(self):
        before = len(self.widget._tasks)
        self.widget._add_task('Buy milk')
        self.assertEqual(len(self.widget._tasks), before + 1)

    def test_added_task_has_complete_false(self):
        self.widget._add_task('New task')
        self.assertFalse(self.widget._tasks[0]['complete'])

    def test_added_task_description_equals_trimmed_input(self):
        self.widget._add_task('  trimmed  ')
        self.assertEqual(self.widget._tasks[0]['description'], 'trimmed')

    def test_added_task_has_unique_string_id(self):
        self.widget._add_task('Task A')
        self.widget._add_task('Task B')
        ids = [t['id'] for t in self.widget._tasks]
        self.assertEqual(len(ids), len(set(ids)))  # all unique
        for i in ids:
            self.assertIsInstance(i, str)
            self.assertGreater(len(i), 0)

    def test_empty_string_rejected(self):
        self.widget._add_task('')
        self.assertEqual(len(self.widget._tasks), 0)

    def test_whitespace_only_rejected(self):
        for ws in ['   ', '\t', '\n', '\r\n', ' \t ']:
            with self.subTest(ws=repr(ws)):
                w = TodoListWidget()
                w._add_task(ws)
                self.assertEqual(len(w._tasks), 0)

    def test_description_over_500_chars_rejected(self):
        self.widget._add_task('x' * 501)
        self.assertEqual(len(self.widget._tasks), 0)

    def test_description_exactly_500_chars_accepted(self):
        self.widget._add_task('x' * 500)
        self.assertEqual(len(self.widget._tasks), 1)

    def test_invalid_add_does_not_call_save(self):
        self.widget._last_save_data = 'sentinel'
        self.widget._add_task('')
        # _save only sets _last_save_data; verify it was NOT overwritten
        self.assertEqual(self.widget._last_save_data, 'sentinel')

    def test_multiple_tasks_added_sequentially(self):
        for i in range(10):
            self.widget._add_task(f'Task {i}')
        self.assertEqual(len(self.widget._tasks), 10)


class TestTodoListWidgetToggle(unittest.TestCase):
    """Property 5: completion toggle is its own inverse."""

    def setUp(self):
        self.widget = TodoListWidget()
        self.widget._add_task('Toggle me')
        self.task_id = self.widget._tasks[0]['id']

    def test_toggle_marks_incomplete_task_as_complete(self):
        self.widget._toggle_task(self.task_id)
        self.assertTrue(self.widget._tasks[0]['complete'])

    def test_toggle_marks_complete_task_as_incomplete(self):
        self.widget._toggle_task(self.task_id)  # → True
        self.widget._toggle_task(self.task_id)  # → False
        self.assertFalse(self.widget._tasks[0]['complete'])

    def test_double_toggle_restores_original_state(self):
        orig = self.widget._tasks[0]['complete']
        self.widget._toggle_task(self.task_id)
        self.widget._toggle_task(self.task_id)
        self.assertEqual(self.widget._tasks[0]['complete'], orig)

    def test_toggle_unknown_id_is_noop(self):
        self.widget._toggle_task('nonexistent')
        self.assertFalse(self.widget._tasks[0]['complete'])

    def test_toggle_only_affects_target_task(self):
        self.widget._add_task('Other task')
        id2 = self.widget._tasks[1]['id']
        self.widget._toggle_task(self.task_id)
        self.assertTrue(self.widget._tasks[0]['complete'])
        self.assertFalse(self.widget._tasks[1]['complete'])


class TestTodoListWidgetDelete(unittest.TestCase):
    """Property 6: deleted task is absent from the list."""

    def setUp(self):
        self.widget = TodoListWidget()
        self.widget._add_task('Task A')
        self.widget._add_task('Task B')
        self.id_a = self.widget._tasks[0]['id']
        self.id_b = self.widget._tasks[1]['id']

    def test_delete_removes_task_from_list(self):
        self.widget._delete_task(self.id_a)
        self.assertEqual(len(self.widget._tasks), 1)

    def test_deleted_id_absent_from_tasks(self):
        self.widget._delete_task(self.id_a)
        ids = [t['id'] for t in self.widget._tasks]
        self.assertNotIn(self.id_a, ids)

    def test_other_tasks_unaffected_by_delete(self):
        self.widget._delete_task(self.id_a)
        self.assertEqual(self.widget._tasks[0]['id'], self.id_b)

    def test_delete_nonexistent_id_is_noop(self):
        self.widget._delete_task('ghost-id')
        self.assertEqual(len(self.widget._tasks), 2)


class TestTodoListWidgetEdit(unittest.TestCase):
    """Edit task validation."""

    def setUp(self):
        self.widget = TodoListWidget()
        self.widget._add_task('Original')
        self.task_id = self.widget._tasks[0]['id']

    def test_edit_updates_description(self):
        self.widget._edit_task(self.task_id, 'Updated')
        self.assertEqual(self.widget._tasks[0]['description'], 'Updated')

    def test_edit_trims_whitespace(self):
        self.widget._edit_task(self.task_id, '  trimmed  ')
        self.assertEqual(self.widget._tasks[0]['description'], 'trimmed')

    def test_edit_with_empty_string_rejected(self):
        self.widget._edit_task(self.task_id, '')
        self.assertEqual(self.widget._tasks[0]['description'], 'Original')

    def test_edit_with_whitespace_only_rejected(self):
        self.widget._edit_task(self.task_id, '   ')
        self.assertEqual(self.widget._tasks[0]['description'], 'Original')

    def test_edit_over_500_chars_rejected(self):
        self.widget._edit_task(self.task_id, 'x' * 501)
        self.assertEqual(self.widget._tasks[0]['description'], 'Original')

    def test_edit_exactly_500_chars_accepted(self):
        self.widget._edit_task(self.task_id, 'x' * 500)
        self.assertEqual(self.widget._tasks[0]['description'], 'x' * 500)


class TestQuickLinksWidget(unittest.TestCase):
    """Property 8: invalid link submissions always rejected."""

    def setUp(self):
        self.widget = QuickLinksWidget()

    # ── Invalid submissions ────────────────────────────────────────────────

    def test_empty_label_rejected(self):
        self.widget._add_link('', 'https://example.com')
        self.assertEqual(len(self.widget._links), 0)

    def test_whitespace_label_rejected(self):
        self.widget._add_link('   ', 'https://example.com')
        self.assertEqual(len(self.widget._links), 0)

    def test_empty_url_rejected(self):
        self.widget._add_link('Example', '')
        self.assertEqual(len(self.widget._links), 0)

    def test_url_without_scheme_rejected(self):
        self.widget._add_link('Example', 'example.com')
        self.assertEqual(len(self.widget._links), 0)

    def test_ftp_scheme_rejected(self):
        self.widget._add_link('Example', 'ftp://example.com')
        self.assertEqual(len(self.widget._links), 0)

    def test_invalid_submission_does_not_call_save(self):
        self.widget._reset_save_flag()
        self.widget._add_link('', 'https://example.com')
        self.widget._add_link('Label', 'not-a-url')
        self.widget._add_link('Label', '')
        self.assertFalse(self.widget._save_called)

    def test_invalid_submission_sets_error_message(self):
        self.widget._add_link('', 'https://example.com')
        self.assertIsNotNone(self.widget._last_error)
        self.assertGreater(len(self.widget._last_error), 0)

    # ── Valid submissions ──────────────────────────────────────────────────

    def test_valid_http_link_added(self):
        self.widget._add_link('Example', 'http://example.com')
        self.assertEqual(len(self.widget._links), 1)
        self.assertEqual(self.widget._links[0]['url'], 'http://example.com')

    def test_valid_https_link_added(self):
        self.widget._add_link('GitHub', 'https://github.com')
        self.assertEqual(len(self.widget._links), 1)
        self.assertEqual(self.widget._links[0]['label'], 'GitHub')

    def test_valid_link_has_unique_id(self):
        self.widget._add_link('A', 'https://a.com')
        self.widget._add_link('B', 'https://b.com')
        ids = [l['id'] for l in self.widget._links]
        self.assertEqual(len(ids), len(set(ids)))

    def test_valid_add_clears_error(self):
        self.widget._add_link('', 'https://example.com')  # trigger error
        self.widget._add_link('Valid', 'https://example.com')
        self.assertIsNone(self.widget._last_error)

    # ── Delete ─────────────────────────────────────────────────────────────

    def test_delete_removes_link(self):
        self.widget._add_link('Site', 'https://example.com')
        link_id = self.widget._links[0]['id']
        self.widget._delete_link(link_id)
        self.assertEqual(len(self.widget._links), 0)

    def test_deleted_link_id_absent(self):
        self.widget._add_link('Site', 'https://example.com')
        link_id = self.widget._links[0]['id']
        self.widget._delete_link(link_id)
        ids = [l['id'] for l in self.widget._links]
        self.assertNotIn(link_id, ids)


if __name__ == '__main__':
    unittest.main(verbosity=2)
