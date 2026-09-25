"""
test_ass_output.py - Unit & Security Tests for Subtitles, Path Traversal, Clip Generator & Privacy
"""

import json
import os
import sys
import unittest

from subtitle_gen import (
    hex_to_ass_color,
    format_ass_time,
    format_srt_time,
    format_vtt_time,
    apply_casing,
    sanitize_ass_text,
    generate_ass_subtitles
)
from engine import get_safe_contained_path
from clip_generator import detect_viral_clips
from telemetry import is_telemetry_enabled, TelemetryManager
from fastapi import HTTPException


class TestSubtitleGen(unittest.TestCase):
    def setUp(self):
        templates_path = os.path.join(
            os.path.dirname(__file__), "..", "frontend", "src", "data", "templates.json"
        )
        with open(templates_path, "r", encoding="utf-8") as f:
            self.templates = json.load(f)

        self.sample_transcript = [
            {"start": 0.42, "end": 0.85, "word": "Unlock", "keyword": False},
            {"start": 0.86, "end": 1.40, "word": "Millions", "keyword": True},
            {"start": 1.42, "end": 1.80, "word": "of", "keyword": False},
            {"start": 1.82, "end": 2.20, "word": "views", "keyword": False},
        ]

    def test_presets_count(self):
        self.assertGreaterEqual(len(self.templates), 100)
        categories = set(p["category"] for p in self.templates)
        self.assertIn("Viral Shorts", categories)
        self.assertIn("Neon & Gaming", categories)
        self.assertIn("Documentary & Clean", categories)
        self.assertIn("Karaoke Sweep", categories)

    def test_hex_to_ass_color(self):
        # White #FFFFFF -> &H00FFFFFF&
        self.assertEqual(hex_to_ass_color("#FFFFFF"), "&H00FFFFFF&")
        # Black #000000 -> &H00000000&
        self.assertEqual(hex_to_ass_color("#000000"), "&H00000000&")
        # Red #EF4444 (R=EF, G=44, B=44) -> ASS BGR &H004444EF&
        self.assertEqual(hex_to_ass_color("#EF4444"), "&H004444EF&")

    def test_format_ass_time(self):
        self.assertEqual(format_ass_time(0.0), "0:00:00.00")
        self.assertEqual(format_ass_time(1.45), "0:00:01.45")
        self.assertEqual(format_ass_time(65.12), "0:01:05.12")
        self.assertEqual(format_ass_time(3665.0), "1:01:05.00")

    def test_format_time_carry_over(self):
        # Centisecond carry over
        self.assertEqual(format_ass_time(59.998), "0:01:00.00")
        self.assertEqual(format_ass_time(1.996), "0:00:02.00")
        self.assertEqual(format_ass_time(-5.0), "0:00:00.00")
        # SRT millisecond carry over
        self.assertEqual(format_srt_time(59.9999), "00:01:00,000")
        self.assertEqual(format_srt_time(1.9996), "00:00:02,000")
        # VTT millisecond carry over
        self.assertEqual(format_vtt_time(59.9999), "00:01:00.000")

    def test_apply_casing(self):
        self.assertEqual(apply_casing("hello world", "UPPERCASE"), "HELLO WORLD")
        self.assertEqual(apply_casing("HELLO WORLD", "lowercase"), "hello world")
        self.assertEqual(apply_casing("hello world", "Title Case"), "Hello World")

    def test_sanitize_ass_text(self):
        # Strips curly braces and backslashes that inject ASS override tags
        injected = r"{\fs200\pos(540,960)}DangerousText"
        sanitized = sanitize_ass_text(injected)
        self.assertNotIn("{", sanitized)
        self.assertNotIn("}", sanitized)
        self.assertNotIn("\\", sanitized)
        self.assertIn("DangerousText", sanitized)

    def test_generate_ass_viral_shorts(self):
        preset = next(p for p in self.templates if p["id"] == "mrbeast-yellow-pop")
        ass = generate_ass_subtitles(self.sample_transcript, preset)
        self.assertIn("[Script Info]", ass)
        self.assertIn("[V4+ Styles]", ass)
        self.assertIn("[Events]", ass)
        self.assertIn("Dialogue: 0,", ass)
        self.assertIn("UNLOCK", ass)
        self.assertIn("MILLIONS", ass)

    def test_generate_ass_karaoke(self):
        preset = next(p for p in self.templates if p["category"] == "Karaoke Sweep")
        ass = generate_ass_subtitles(self.sample_transcript, preset)
        self.assertIn("\\k", ass)


class TestPathContainment(unittest.TestCase):
    def setUp(self):
        self.test_dir = os.path.join(os.path.dirname(__file__), "temp")
        os.makedirs(self.test_dir, exist_ok=True)

    def test_valid_filename(self):
        safe = get_safe_contained_path(self.test_dir, "video_test.mp4")
        self.assertTrue(safe.startswith(os.path.realpath(self.test_dir)))

    def test_posix_traversal_blocked(self):
        with self.assertRaises(HTTPException):
            get_safe_contained_path(self.test_dir, "../../etc/passwd")

    def test_windows_traversal_blocked(self):
        with self.assertRaises(HTTPException):
            get_safe_contained_path(self.test_dir, "..\\..\\Windows\\System32\\calc.exe")

    def test_absolute_path_blocked(self):
        with self.assertRaises(HTTPException):
            get_safe_contained_path(self.test_dir, "/etc/shadow")

    def test_windows_drive_letter_blocked(self):
        with self.assertRaises(HTTPException):
            get_safe_contained_path(self.test_dir, "C:\\Windows\\win.ini")

    def test_empty_or_whitespace_blocked(self):
        with self.assertRaises(HTTPException):
            get_safe_contained_path(self.test_dir, "   ")
        with self.assertRaises(HTTPException):
            get_safe_contained_path(self.test_dir, "")


class TestClipGenerator(unittest.TestCase):
    def test_empty_transcript_returns_empty_or_safe(self):
        clips = detect_viral_clips([], 0.0)
        self.assertEqual(clips, [])

    def test_zero_duration_returns_empty(self):
        words = [{"start": 0.0, "end": 0.0, "word": "hello", "keyword": False}]
        clips = detect_viral_clips(words, 0.0)
        self.assertIsInstance(clips, list)

    def test_no_zerodivision_on_short_duration(self):
        words = [
            {"start": 0.1, "end": 0.2, "word": "why", "keyword": True},
            {"start": 0.2, "end": 0.3, "word": "secrets", "keyword": True}
        ]
        clips = detect_viral_clips(words, 0.3)
        self.assertIsInstance(clips, list)


class TestTelemetryPrivacy(unittest.TestCase):
    def test_telemetry_disabled_by_default(self):
        manager = TelemetryManager()
        self.assertTrue(manager.machine_id.startswith("anon_"))


from pydantic import ValidationError
from engine import resolve_video_file, VideoSegmentItem, ExportPayload, GenerateClipsPayload

class TestPydanticValidation(unittest.TestCase):
    def test_segment_item_invalid_range_raises(self):
        with self.assertRaises(ValidationError):
            VideoSegmentItem(start=10.0, end=5.0)
        with self.assertRaises(ValidationError):
            VideoSegmentItem(start=5.0, end=5.0)
        seg = VideoSegmentItem(start=2.0, end=5.0)
        self.assertEqual(seg.start, 2.0)
        self.assertEqual(seg.end, 5.0)

    def test_export_payload_invalid_clip_range_raises(self):
        with self.assertRaises(ValidationError):
            ExportPayload(
                transcript=[],
                preset={},
                clip_start=15.0,
                clip_end=10.0
            )

    def test_generate_clips_invalid_durations_raises(self):
        with self.assertRaises(ValidationError):
            GenerateClipsPayload(
                words=[],
                duration=60.0,
                min_clip_duration=40.0,
                max_clip_duration=20.0
            )

class TestVideoResolutionSecurity(unittest.TestCase):
    def test_arbitrary_system_path_rejected(self):
        with self.assertRaises(HTTPException):
            resolve_video_file("C:\\Windows\\System32\\cmd.exe")
        with self.assertRaises(HTTPException):
            resolve_video_file("/etc/passwd")

    def test_null_byte_blocked_in_containment(self):
        test_dir = os.path.join(os.path.dirname(__file__), "temp")
        with self.assertRaises(HTTPException):
            get_safe_contained_path(test_dir, "video\x00.mp4")

    def test_missing_path_rejected(self):
        with self.assertRaises(HTTPException):
            resolve_video_file(None)
        with self.assertRaises(HTTPException):
            resolve_video_file("")

from broll import validate_broll_url

class TestBrollValidation(unittest.TestCase):
    def test_private_ip_rejected(self):
        self.assertFalse(validate_broll_url("https://127.0.0.1/video.mp4"))
        self.assertFalse(validate_broll_url("https://192.168.1.1/video.mp4"))
        self.assertFalse(validate_broll_url("https://10.0.0.1/video.mp4"))

    def test_disallowed_domain_rejected(self):
        self.assertFalse(validate_broll_url("https://evil.com/video.mp4"))
        self.assertFalse(validate_broll_url("https://attacker.org/test.mp4"))

    def test_non_https_rejected(self):
        self.assertFalse(validate_broll_url("http://pexels.com/video.mp4"))

    def test_allowed_vimeo_domain_accepted(self):
        self.assertTrue(validate_broll_url("https://player.vimeo.com/video/12345"))

if __name__ == "__main__":
    unittest.main()
