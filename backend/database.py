"""
database.py
─────────────
Simple JSON-based file storage (no external DB needed for prototype).
Replace with PostgreSQL/MongoDB for production.
"""

import json
import os
from typing import Optional, List

DATA_DIR = "data/db"
os.makedirs(DATA_DIR, exist_ok=True)

CONSULTATIONS_FILE = os.path.join(DATA_DIR, "consultations.json")
COMMENTS_FILE = os.path.join(DATA_DIR, "comments.json")


def _read(path: str) -> dict:
    if not os.path.exists(path):
        return {}
    with open(path, "r") as f:
        return json.load(f)


def _write(path: str, data: dict):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


class Database:
    # ── Consultations ──

    def list_consultations(self) -> List[dict]:
        store = _read(CONSULTATIONS_FILE)
        return sorted(store.values(), key=lambda x: x.get("created_date", ""), reverse=True)

    def get_consultation(self, consultation_id: str) -> Optional[dict]:
        store = _read(CONSULTATIONS_FILE)
        return store.get(consultation_id)

    def save_consultation(self, consultation: dict):
        store = _read(CONSULTATIONS_FILE)
        store[consultation["id"]] = consultation
        _write(CONSULTATIONS_FILE, store)

    # ── Comments ──

    def list_comments(self, consultation_id: Optional[str] = None) -> List[dict]:
        store = _read(COMMENTS_FILE)
        comments = list(store.values())
        if consultation_id:
            comments = [c for c in comments if c.get("consultation_id") == consultation_id]
        return sorted(comments, key=lambda x: x.get("created_date", ""), reverse=True)

    def get_comment(self, comment_id: str) -> Optional[dict]:
        store = _read(COMMENTS_FILE)
        return store.get(comment_id)

    def save_comment(self, comment: dict):
        store = _read(COMMENTS_FILE)
        store[comment["id"]] = comment
        _write(COMMENTS_FILE, store)


db = Database()