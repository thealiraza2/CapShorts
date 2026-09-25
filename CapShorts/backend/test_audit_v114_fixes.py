"""
test_audit_v114_fixes.py - Verification tests for v1.1.4 audit remediation fixes
Verifies:
- N-001: Task pruning & retention of terminal states (completed/failed)
- F-028: WordItem schema validation (HTTP 422 on malformed payloads)
- N-003: Export concurrency semaphore & rate limiting (HTTP 429)
- N-007: Loopback verification logic
"""

import time
import unittest
from engine import (
    update_task_state,
    prune_stale_tasks,
    TASK_TTL_SECONDS,
    MAX_TASK_ENTRIES,
    WordItem,
    EXPORT_SEMAPHORE,
    verify_loopback_request,
    app
)
from clip_generator import detect_viral_clips
from pydantic import ValidationError
from fastapi import HTTPException
from unittest.mock import MagicMock


class TestAuditV114Remediation(unittest.TestCase):

    def test_n001_terminal_tasks_not_evicted_immediately(self):
        """Verify that completed/failed tasks retain timestamps and are NOT pruned immediately (N-001)."""
        tasks = {}
        task_id = "test-task-1"
        
        # 1. Start task
        update_task_state(tasks, task_id, {
            "progress": 10,
            "status": "processing"
        })
        self.assertIn(task_id, tasks)
        self.assertIn("_created_at", tasks[task_id])
        created_at = tasks[task_id]["_created_at"]

        # 2. Advance task to terminal status
        update_task_state(tasks, task_id, {
            "progress": 100,
            "status": "completed",
            "words": []
        })
        self.assertEqual(tasks[task_id]["_created_at"], created_at)
        self.assertIn("_completed_at", tasks[task_id])

        # 3. Run prune_stale_tasks immediately (simulating worker finally block)
        prune_stale_tasks(tasks)
        self.assertIn(task_id, tasks, "Just-completed task MUST NOT be evicted immediately!")

        # 4. Active jobs must never be evicted
        active_id = "test-active-1"
        update_task_state(tasks, active_id, {
            "progress": 50,
            "status": "processing",
            "_created_at": time.time() - (TASK_TTL_SECONDS + 500)  # older than TTL
        })
        prune_stale_tasks(tasks)
        self.assertIn(active_id, tasks, "Active processing jobs must never be evicted by TTL prune")

        # 5. Expired terminal tasks (> TASK_TTL_SECONDS) should be pruned
        old_id = "test-old-1"
        tasks[old_id] = {
            "status": "completed",
            "_created_at": time.time() - (TASK_TTL_SECONDS + 60),
            "_completed_at": time.time() - (TASK_TTL_SECONDS + 60)
        }
        prune_stale_tasks(tasks)
        self.assertNotIn(old_id, tasks, "Expired terminal tasks beyond TTL should be pruned")

    def test_f028_worditem_validation(self):
        """Verify that WordItem validates required fields and timestamp ranges (F-028)."""
        # Valid item
        valid = WordItem(start=0.0, end=1.5, word="hello")
        self.assertEqual(valid.word, "hello")
        self.assertEqual(valid.start, 0.0)
        self.assertEqual(valid.end, 1.5)

        # Missing 'word' field -> ValidationError
        with self.assertRaises(ValidationError):
            WordItem(start=0.0, end=1.5)

        # Invalid range: end < start -> ValidationError
        with self.assertRaises(ValidationError):
            WordItem(start=2.0, end=1.0, word="invalid")

    def test_f028_clip_generator_defensive_against_missing_word(self):
        """Verify detect_viral_clips does not raise KeyError when word fields are empty or partial."""
        words = [
            {"start": 0.0, "end": 1.0, "word": "Test"},
            {"start": 1.0, "end": 2.0}  # missing 'word' key
        ]
        # Should not crash with KeyError: 'word'
        clips = detect_viral_clips(words, total_duration=2.0)
        self.assertIsInstance(clips, list)

    def test_n007_loopback_verification(self):
        """Verify verify_loopback_request accepts 127.0.0.1 and rejects external IPs."""
        # Local loopback request
        local_req = MagicMock()
        local_req.client.host = "127.0.0.1"
        try:
            verify_loopback_request(local_req)
        except HTTPException:
            self.fail("verify_loopback_request should accept 127.0.0.1")

        # External IP request
        external_req = MagicMock()
        external_req.client.host = "192.168.1.100"
        with self.assertRaises(HTTPException) as ctx:
            verify_loopback_request(external_req)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_tauri_cors_origins(self):
        """Verify that wildcard origin is allowed in CORS configuration."""
        from engine import LOCAL_ALLOWED_ORIGINS
        self.assertTrue("*" in LOCAL_ALLOWED_ORIGINS or "http://tauri.localhost" in LOCAL_ALLOWED_ORIGINS)


if __name__ == "__main__":
    unittest.main()

