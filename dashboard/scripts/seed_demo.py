"""Seed / remove [DEMO] rows in flow_agent.db so the dashboard has something to render.
Only COMPLETED/FAILED requests are inserted, so the worker never touches them.
Usage: python seed_demo.py seed | python seed_demo.py clean
"""
import sqlite3, sys, uuid, json, random
from pathlib import Path
from datetime import datetime, timedelta, timezone

DB = str(Path(__file__).resolve().parents[2] / "flow_agent.db")
TAG = "[DEMO]"
random.seed(7)

def ts(minutes_ago: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")

def img(key, w=720, h=1280):
    return f"https://picsum.photos/seed/{key}/{w}/{h}"

VIDEO_URL = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"

def clean(con):
    ids = [r[0] for r in con.execute("SELECT id FROM project WHERE name LIKE ?", (TAG + "%",))]
    for pid in ids:
        con.execute("DELETE FROM request WHERE project_id=?", (pid,))
        vids = [r[0] for r in con.execute("SELECT id FROM video WHERE project_id=?", (pid,))]
        for v in vids:
            con.execute("DELETE FROM scene WHERE video_id=?", (v,))
        con.execute("DELETE FROM video WHERE project_id=?", (pid,))
        con.execute("DELETE FROM project_character WHERE project_id=?", (pid,))
        con.execute("DELETE FROM project WHERE id=?", (pid,))
    con.execute("DELETE FROM character WHERE name LIKE ?", (TAG + "%",))
    con.commit()
    print("cleaned", len(ids), "demo projects")

def seed(con):
    clean(con)
    projects = [
        (TAG + " ช่องแคบฮอร์มุซ: 72 ชั่วโมงแห่งการปิดล้อม", "สารคดีสั้นเล่าเหตุการณ์ปิดล้อมทางทะเลที่ช่องแคบฮอร์มุซ", "PAYGATE_TIER_TWO", "realistic", 240),
        (TAG + " ภารกิจกู้ภัยนักบิน F-15E", "เรื่องราวปฏิบัติการค้นหาและกู้ภัยในทะเลทราย", "PAYGATE_TIER_ONE", "cinematic", 1500),
        (TAG + " หมอผู้แปรพักตร์", "ชีวิตหลังการหลบหนีจากเกาหลีเหนือ", "PAYGATE_TIER_ONE", "realistic", 6000),
    ]
    chars = [
        ("พันเอกอารักษ์", "character", "นายทหารเรือวัย 50 ผมสีเทา ใบหน้าเคร่งขรึม เครื่องแบบสีขาว"),
        ("เรือรบชั้นฟริเกต", "visual_asset", "เรือรบสีเทาเข้ม มีเรดาร์หมุนบนเสาสูง"),
        ("ท่าเรือบันดาร์อับบาส", "location", "ท่าเรือขนาดใหญ่ยามพลบค่ำ ไฟส้มสะท้อนผิวน้ำ"),
        ("หมอคิม", "character", "แพทย์หญิงวัย 40 แว่นกรอบบาง เสื้อกาวน์สีขาว"),
        ("นักบินกัปตันเจ", "character", "นักบินหนุ่มผมสั้น ชุดบินสีเขียวมะกอก"),
    ]
    char_ids = []
    for i, (name, et, desc) in enumerate(chars):
        cid = str(uuid.uuid4())
        char_ids.append(cid)
        has_ref = i != 4
        con.execute(
            "INSERT INTO character (id,name,slug,entity_type,description,image_prompt,reference_image_url,media_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (cid, TAG + " " + name, f"demo-{i}", et, desc, desc, img(f"char{i}", 768, 768) if has_ref else None,
             str(uuid.uuid4()) if has_ref else None, ts(3000), ts(200 + i * 30)))

    scene_prompts = [
        "มุมกว้างเรือรบแล่นฝ่าคลื่นยามเช้า แสงทองสาดผิวน้ำ",
        "ภาพระยะใกล้ผู้บังคับการยืนบนสะพานเดินเรือ มองผ่านกล้องส่องทางไกล",
        "โดรนบินเหนือช่องแคบ เห็นแนวเรือสินค้าจอดรอเป็นแถวยาว",
        "ห้องควบคุมเรดาร์ แสงสีเขียวจากจอส่องใบหน้าลูกเรือ",
        "ท่าเรือยามค่ำ ไฟส้มสะท้อนน้ำ รถบรรทุกเรียงแถว",
        "เฮลิคอปเตอร์บินต่ำเหนือทะเลทราย ฝุ่นฟุ้งกระจาย",
        "นักบินดีดตัวออกจากเครื่อง ร่มชูชีพกางกลางฟ้าสีส้ม",
        "ทีมกู้ภัยวิ่งข้ามเนินทราย ถือเปลสนาม",
        "ห้องผ่าตัด แสงไฟขาวจ้า มือหมอสวมถุงมือ",
        "ถนนกรุงโซลยามค่ำ ป้ายนีออนสะท้อนบนกระจกร้าน",
    ]

    all_status_patterns = {
        # (image, video, upscale)
        "done": ("COMPLETED", "COMPLETED", "COMPLETED"),
        "up_proc": ("COMPLETED", "COMPLETED", "PROCESSING"),
        "vid_proc": ("COMPLETED", "PROCESSING", "PENDING"),
        "vid_fail": ("COMPLETED", "FAILED", "PENDING"),
        "img_only": ("COMPLETED", "PENDING", "PENDING"),
        "img_proc": ("PROCESSING", "PENDING", "PENDING"),
        "img_fail": ("FAILED", "PENDING", "PENDING"),
        "none": ("PENDING", "PENDING", "PENDING"),
    }

    video_specs = [
        # project idx, title, scene count, pattern list
        (0, "EP1 — การปิดล้อมเริ่มต้น", 8, ["done", "done", "done", "done", "up_proc", "up_proc", "vid_proc", "vid_fail"]),
        (0, "EP2 — คืนที่ยาวนาน", 6, ["done", "done", "vid_proc", "img_only", "img_fail", "none"]),
        (1, "Rescue — ตอนเดียวจบ", 7, ["done", "done", "done", "done", "done", "done", "done"]),
        (2, "Shorts — ทีเซอร์", 5, ["img_only", "img_only", "img_proc", "none", "none"]),
    ]

    errors = [
        "UNSAFE_GENERATION: prompt flagged by safety filter (category: violence)",
        "Media not found. request_id=7f3a… poll timed out after 900s",
        "CAPTCHA_FAILED: NO_FLOW_TAB — open flow.google.com and retry",
        "HTTP 429 RESOURCE_EXHAUSTED: quota exceeded for Veo 3.1 fast",
    ]

    pid_list = []
    for pi, (name, desc, tier, material, age) in enumerate(projects):
        pid = str(uuid.uuid4())
        pid_list.append(pid)
        con.execute(
            "INSERT INTO project (id,name,description,story,thumbnail_url,language,status,user_paygate_tier,narrator_voice,narrator_ref_audio,material,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (pid, name, desc, "เรื่องย่อ: " + desc + " ตัวละครหลักต้องตัดสินใจภายใต้แรงกดดัน ขณะที่เวลาเดินไปเรื่อยๆ",
             img(f"proj{pi}", 1280, 720), "th", "ACTIVE" if pi < 2 else "ARCHIVED", tier,
             "th-narrator-01" if pi != 1 else None, "voices/narrator_th.wav" if pi != 1 else None, material, ts(age), ts(age // 10)))
        for ci in range(len(char_ids)):
            if (pi == 0 and ci < 3) or (pi == 1 and ci in (4,)) or (pi == 2 and ci == 3):
                con.execute("INSERT INTO project_character (project_id, character_id) VALUES (?,?)", (pid, char_ids[ci]))

    for vi, (pi, title, n, patterns) in enumerate(video_specs):
        pid = pid_list[pi]
        vid = str(uuid.uuid4())
        all_done = all(p == "done" for p in patterns)
        con.execute(
            "INSERT INTO video (id,project_id,title,description,display_order,status,vertical_url,horizontal_url,thumbnail_url,duration,resolution,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (vid, pid, title, None, vi, "COMPLETED" if all_done else "PROCESSING", VIDEO_URL if all_done else None, None,
             img(f"vid{vi}", 1280, 720), 8.0 * n, "1080p" if all_done else None, ts(2000 - vi * 100), ts(30 + vi * 7)))
        for si in range(n):
            sid = str(uuid.uuid4())
            st_img, st_vid, st_up = all_status_patterns[patterns[si]]
            prompt = scene_prompts[(si + vi * 3) % len(scene_prompts)]
            names = json.dumps([TAG + " " + chars[c][0] for c in ([0, 1] if pi == 0 else [4] if pi == 1 else [3])], ensure_ascii=False)
            has_img = st_img == "COMPLETED"
            has_vid = st_vid == "COMPLETED"
            has_up = st_up == "COMPLETED"
            con.execute(
                """INSERT INTO scene (id,video_id,display_order,prompt,image_prompt,video_prompt,character_names,parent_scene_id,chain_type,source,
                   vertical_image_url,vertical_image_media_id,vertical_image_status,
                   vertical_video_url,vertical_video_media_id,vertical_video_status,
                   vertical_upscale_url,vertical_upscale_media_id,vertical_upscale_status,
                   duration,narrator_text,created_at,updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (sid, vid, si, prompt, prompt + ", cinematic lighting, 35mm, shallow depth of field",
                 prompt + " — กล้องแพนช้าจากซ้ายไปขวา, motion: slow dolly-in", names, None,
                 "ROOT" if si == 0 else ("INSERT" if si == 3 and vi == 0 else "CONTINUATION"), "root",
                 img(f"s{vi}-{si}") if has_img else None, str(uuid.uuid4()) if has_img else None, st_img,
                 VIDEO_URL if has_vid else None, str(uuid.uuid4()) if has_vid else None, st_vid,
                 VIDEO_URL if has_up else None, str(uuid.uuid4()) if has_up else None, st_up,
                 8.0, "บทบรรยายฉากที่ " + str(si + 1), ts(1500 - si * 10), ts(random.randint(5, 1400))))
            # requests: completed stages + failed ones
            for stage, st, rtype in (("image", st_img, "GENERATE_IMAGE"), ("video", st_vid, "GENERATE_VIDEO"), ("upscale", st_up, "UPSCALE_VIDEO")):
                if st in ("COMPLETED", "FAILED"):
                    minutes = random.choice([3, 12, 45, 90, 180, 400, 800, 1300, 1600, 2500])
                    con.execute(
                        "INSERT INTO request (id,project_id,video_id,scene_id,character_id,type,orientation,status,request_id,media_id,output_url,error_message,retry_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (str(uuid.uuid4()), pid, vid, sid, None, rtype, "VERTICAL", st, "demo-" + uuid.uuid4().hex[:8],
                         str(uuid.uuid4()) if st == "COMPLETED" else None, VIDEO_URL if st == "COMPLETED" else None,
                         random.choice(errors) if st == "FAILED" else None, random.randint(0, 3) if st == "FAILED" else 0,
                         ts(minutes + 6), ts(minutes)))
    # character requests
    for i, cid in enumerate(char_ids):
        st = "COMPLETED" if i != 4 else "FAILED"
        con.execute(
            "INSERT INTO request (id,project_id,video_id,scene_id,character_id,type,orientation,status,request_id,media_id,output_url,error_message,retry_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), pid_list[0 if i < 3 else 1 if i == 4 else 2], None, None, cid, "GENERATE_CHARACTER_IMAGE", None, st,
             "demo-" + uuid.uuid4().hex[:8], str(uuid.uuid4()) if st == "COMPLETED" else None, None,
             errors[0] if st == "FAILED" else None, 2 if st == "FAILED" else 0, ts(2900), ts(2800 if st == "COMPLETED" else 25)))
    con.commit()
    print("seeded", len(pid_list), "projects")

if __name__ == "__main__":
    con = sqlite3.connect(DB, timeout=10)
    con.execute("PRAGMA foreign_keys=ON")
    (seed if sys.argv[1:] == ["seed"] else clean)(con)
    con.close()
