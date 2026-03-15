#!/usr/bin/env python3
"""Generate a sample SQLite database pre-populated with Yamanote Line data."""

import sqlite3
import os

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS db_metadata (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  company_color TEXT NOT NULL DEFAULT '#36ab33'
);

CREATE TABLE IF NOT EXISTS lines (
  id         TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  line_color TEXT NOT NULL DEFAULT '#9fff00',
  prefix     TEXT NOT NULL,
  priority   INTEGER,
  is_loop    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stations (
  id                    TEXT PRIMARY KEY,
  primary_name          TEXT NOT NULL DEFAULT '',
  primary_name_furigana TEXT,
  secondary_name        TEXT,
  tertiary_name         TEXT,
  quaternary_name       TEXT,
  quinary_name          TEXT,
  note                  TEXT,
  three_letter_code     TEXT,
  sort_order            INTEGER
);

CREATE TABLE IF NOT EXISTS station_lines (
  id         TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  line_id    TEXT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station_numbers (
  id         TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  line_id    TEXT REFERENCES lines(id) ON DELETE CASCADE,
  value      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS special_zones (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  is_black     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station_areas (
  id         TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  zone_id    TEXT NOT NULL REFERENCES special_zones(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS current_sign_configurations (
  id         TEXT PRIMARY KEY,
  station_id TEXT REFERENCES stations(id) ON DELETE CASCADE,
  ratio      REAL DEFAULT 4.5,
  direction  TEXT DEFAULT 'left',
  sign_style TEXT
);
"""

# Special zones for Yamanote Line stations
# 山: 山手線内 (white fill), 区: 東京23区内 (black fill)
SPECIAL_ZONES = [
    ("zone-yamanote",  "山手線内", "山", 0),   # is_black=0 → white fill
    ("zone-tokyo23ku", "東京23区内", "区", 1),  # is_black=1 → black fill
]

# Yamanote Line stations:
# (number, primary_name, furigana, english, korean, chinese, three_letter_code)
# All stations have both 山 (white) and 区 (black) badges
STATIONS = [
    (1,  "東京",           "とうきょう",           "Tokyo",            "도쿄",                 "东京",          "TYO"),
    (2,  "神田",           "かんだ",               "Kanda",            "간다",                 "神田",          "KND"),
    (3,  "秋葉原",         "あきはばら",           "Akihabara",        "아키하바라",           "秋叶原",        "AKB"),
    (4,  "御徒町",         "おかちまち",           "Okachimachi",      "오카치마치",           "御徒町",        None),
    (5,  "上野",           "うえの",               "Ueno",             "우에노",               "上野",          "UEN"),
    (6,  "鶯谷",           "うぐいすだに",         "Uguisudani",       "우구이스다니",         "莺谷",          None),
    (7,  "日暮里",         "にっぽり",             "Nippori",          "닛포리",               "日暮里",        "NPR"),
    (8,  "西日暮里",       "にしにっぽり",         "Nishi-Nippori",    "니시닛포리",           "西日暮里",      None),
    (9,  "田端",           "たばた",               "Tabata",           "다바타",               "田端",          None),
    (10, "駒込",           "こまごめ",             "Komagome",         "고마고메",             "驹込",          None),
    (11, "巣鴨",           "すがも",               "Sugamo",           "스가모",               "巣鸭",          None),
    (12, "大塚",           "おおつか",             "Otsuka",           "오쓰카",               "大塚",          None),
    (13, "池袋",           "いけぶくろ",           "Ikebukuro",        "이케부쿠로",           "池袋",          "IKB"),
    (14, "目白",           "めじろ",               "Mejiro",           "메지로",               "目白",          None),
    (15, "高田馬場",       "たかだのばば",         "Takadanobaba",     "다카다노바바",         "高田马场",      None),
    (16, "新大久保",       "しんおおくぼ",         "Shin-Okubo",       "신오쿠보",             "新大久保",      None),
    (17, "新宿",           "しんじゅく",           "Shinjuku",         "신주쿠",               "新宿",          "SJK"),
    (18, "代々木",         "よよぎ",               "Yoyogi",           "요요기",               "代代木",        None),
    (19, "原宿",           "はらじゅく",           "Harajuku",         "하라주쿠",             "原宿",          None),
    (20, "渋谷",           "しぶや",               "Shibuya",          "시부야",               "涩谷",          "SBY"),
    (21, "恵比寿",         "えびす",               "Ebisu",            "에비스",               "恵比寿",        "EBS"),
    (22, "目黒",           "めぐろ",               "Meguro",           "메지로",               "目黒",          None),
    (23, "五反田",         "ごたんだ",             "Gotanda",          "고탄다",               "五反田",        None),
    (24, "大崎",           "おおきき",             "Osaki",            "오사키",               "大崎",          "OSK"),
    (25, "品川",           "しながわ",             "Shinagawa",        "시나가와",             "品川",          "SGW"),
    (26, "高輪ゲートウェイ", "たかなわげーとうぇい", "Takanawa Gateway", "다카나와 게이트웨이", "高轮Gateway",   "TGW"),
    (27, "田町",           "たまち",               "Tamachi",          "다마치",               "田町",          None),
    (28, "浜松町",         "はままつちょう",       "Hamamatsucho",     "하마마쓰초",           "滨松町",        "HMC"),
    (29, "新橋",           "しんばし",             "Shimbashi",        "신바시",               "新桥",          "SMB"),
    (30, "有楽町",         "ゆうらくちょう",       "Yurakucho",        "유라쿠초",             "有乐町",        None),
]


def main():
    script_dir = os.path.dirname(__file__)
    out_path = os.path.normpath(os.path.join(script_dir, "..", ".claude", "output", "sample-yamanote.sqlite"))
    public_path = os.path.normpath(os.path.join(script_dir, "..", "public", "sample-yamanote.sqlite"))

    if os.path.exists(out_path):
        os.remove(out_path)

    conn = sqlite3.connect(out_path)
    c = conn.cursor()
    c.executescript(SCHEMA_SQL)

    # Metadata
    c.execute("INSERT INTO db_metadata VALUES ('version', '0.0.2')")

    # Special zones
    for (zone_id, name, abbreviation, is_black) in SPECIAL_ZONES:
        c.execute(
            "INSERT INTO special_zones VALUES (?, ?, ?, ?)",
            (zone_id, name, abbreviation, is_black),
        )

    # Company — color matches default #36ab33
    company_id = "company-jreast"
    c.execute(
        "INSERT INTO companies VALUES (?, ?, ?)",
        (company_id, "JR東日本", "#36ab33"),
    )

    # Yamanote Line — loop line, official yellow-green color
    line_id = "line-yamanote"
    c.execute(
        "INSERT INTO lines (id, company_id, name, line_color, prefix, priority, is_loop) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (line_id, company_id, "山手線", "#9fff00", "JY", 1, 1),
    )

    for (num, primary_name, furigana, english, korean, chinese, tlc) in STATIONS:
        station_id = f"station-jy{num:02d}"

        c.execute(
            "INSERT INTO stations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (station_id, primary_name, furigana, english, korean, chinese, None, None, tlc, num),
        )

        c.execute(
            "INSERT INTO station_lines VALUES (?, ?, ?, ?)",
            (f"sl-jy{num:02d}", station_id, line_id, num),
        )

        c.execute(
            "INSERT INTO station_numbers VALUES (?, ?, ?, ?)",
            (f"sn-jy{num:02d}", station_id, line_id, f"{num:02d}"),
        )

        # Both 山 (white) and 区 (black) badges for every station
        c.execute(
            "INSERT INTO station_areas VALUES (?, ?, ?, ?)",
            (f"area-jy{num:02d}-yama", station_id, "zone-yamanote", 0),
        )
        c.execute(
            "INSERT INTO station_areas VALUES (?, ?, ?, ?)",
            (f"area-jy{num:02d}-ku", station_id, "zone-tokyo23ku", 1),
        )

    conn.commit()
    conn.close()

    # Also copy to public/ so the browser can fetch it
    import shutil
    shutil.copy2(out_path, public_path)

    print(f"Created: {out_path}")
    print(f"  - version: 0.0.2")
    print(f"  - 2 special zones (山手線内, 東京23区内)")
    print(f"  - 1 company (JR東日本, color #36ab33)")
    print(f"  - 1 line (山手線, prefix JY, color #9fff00, is_loop=1)")
    print(f"  - {len(STATIONS)} stations (JY01–JY30), each with 山+区 badges")


if __name__ == "__main__":
    main()
