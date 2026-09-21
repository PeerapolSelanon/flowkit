"""The /api/projects/progress SQL must agree with dashboard stageStats.sceneStageStatus:
vertical status wins unless it is PENDING, then horizontal is used."""
import sqlite3

from agent.api.projects import _PROGRESS_SQL

STATUS_COLS = [f"{o}_{s}_status" for s in ("image", "video", "upscale") for o in ("vertical", "horizontal")]


def _db():
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.execute("CREATE TABLE video (id TEXT PRIMARY KEY, project_id TEXT)")
    db.execute("CREATE TABLE scene (id TEXT PRIMARY KEY, video_id TEXT, " + ", ".join(f"{c} TEXT DEFAULT 'PENDING'" for c in STATUS_COLS) + ")")
    return db


def _scene(db, sid, vid, **statuses):
    cols = ["id", "video_id", *statuses]
    db.execute(f"INSERT INTO scene ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", [sid, vid, *statuses.values()])


def test_progress_counts_per_project():
    db = _db()
    db.execute("INSERT INTO video VALUES ('v1', 'p1'), ('v2', 'p1'), ('v3', 'p2')")
    _scene(db, "s1", "v1", vertical_image_status="COMPLETED", vertical_video_status="COMPLETED")
    _scene(db, "s2", "v2", horizontal_image_status="COMPLETED")            # vertical PENDING -> horizontal wins
    _scene(db, "s3", "v2", vertical_image_status="FAILED", horizontal_image_status="COMPLETED")  # vertical FAILED wins
    _scene(db, "s4", "v3")
    rows = {r["project_id"]: dict(r) for r in db.execute(_PROGRESS_SQL)}
    assert rows["p1"] == {"project_id": "p1", "total": 3, "image": 2, "video": 1, "upscale": 0}
    assert rows["p2"] == {"project_id": "p2", "total": 1, "image": 0, "video": 0, "upscale": 0}
