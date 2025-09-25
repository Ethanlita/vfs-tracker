import os
import time
import unittest
from unittest.mock import patch
from pathlib import Path

# This is a bit of a hack to import the handler module
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import handler

class TestNoteSelection(unittest.TestCase):

    def setUp(self):
        self.tmp_path = Path(f"/tmp/test_note_selection_{os.getpid()}")
        self.tmp_path.mkdir(exist_ok=True)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp_path)

    def test_sort_and_select_notes_by_name(self):
        """Tests that notes are selected by filename when specific names are present."""

        # Create files out of order
        high_note_path = self.tmp_path / "high_note.wav"
        high_note_path.touch()
        time.sleep(0.02)

        low_note_path = self.tmp_path / "low_note.wav"
        low_note_path.touch()

        paths = [str(low_note_path), str(high_note_path)]

        low_note, high_note = handler._sort_and_select_notes(paths)

        self.assertIsNotNone(low_note)
        self.assertIsNotNone(high_note)
        self.assertEqual(os.path.basename(low_note), "low_note.wav")
        self.assertEqual(os.path.basename(high_note), "high_note.wav")

    def test_sort_and_select_notes_by_ctime(self):
        """Tests the fallback to sorting by creation time when names are not specific."""

        # Create files with a delay to ensure different ctimes
        file2 = self.tmp_path / "some_other_name.wav"
        file2.touch()
        time.sleep(0.02)

        file1 = self.tmp_path / "a_file_that_sorts_first_alphabetically.wav"
        file1.touch()

        # We pass them in an order that is neither alphabetical nor chronological
        paths = [str(file1), str(file2)]

        low_note, high_note = handler._sort_and_select_notes(paths)

        self.assertIsNotNone(low_note)
        self.assertIsNotNone(high_note)
        # file2 was created first, so it should be the "low" note
        self.assertEqual(os.path.basename(low_note), "some_other_name.wav")
        self.assertEqual(os.path.basename(high_note), "a_file_that_sorts_first_alphabetically.wav")

    def test_empty_and_single_list(self):
        """Tests edge cases with empty and single-item lists."""
        low_note, high_note = handler._sort_and_select_notes([])
        self.assertIsNone(low_note)
        self.assertIsNone(high_note)

        file1 = self.tmp_path / "single.wav"
        file1.touch()

        low_note, high_note = handler._sort_and_select_notes([str(file1)])
        self.assertEqual(os.path.basename(low_note), "single.wav")
        self.assertIsNone(high_note)

if __name__ == '__main__':
    unittest.main()