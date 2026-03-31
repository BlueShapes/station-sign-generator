#!/usr/bin/env python3
"""Generate a sample SQLite database pre-populated with Yamanote Line,
Keihin-Tohoku / Negishi Line, and Shonan-Shinjuku Line data."""

import sqlite3
import os

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS db_metadata (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  company_color        TEXT NOT NULL DEFAULT '#3a9200',
  station_number_style TEXT NOT NULL DEFAULT 'jreast'
);

CREATE TABLE IF NOT EXISTS lines (
  id             TEXT PRIMARY KEY,
  company_id     TEXT REFERENCES companies(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  line_color     TEXT NOT NULL DEFAULT '#8cc800',
  prefix         TEXT NOT NULL,
  priority       INTEGER,
  is_loop        INTEGER NOT NULL DEFAULT 0,
  parent_line_id TEXT REFERENCES lines(id) ON DELETE SET NULL
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

CREATE TABLE IF NOT EXISTS services (
  id         TEXT PRIMARY KEY,
  line_id    TEXT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#8cc800',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station_service_stops (
  id         TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'stop'
);
"""

# ── Special zones ─────────────────────────────────────────────────────────────
# 山: 山手線内 (white fill), 区: 東京23区内 (black fill)
# 浜: 横浜市内 (black fill)
SPECIAL_ZONES = [
    ("zone-yamanote",  "山手線内",    "山", 0),
    ("zone-tokyo23ku", "東京23区内",  "区", 1),
    ("zone-yokohama",  "横浜市内",    "浜", 1),
]

# ── Yamanote Line stations ────────────────────────────────────────────────────
# (jy_num, primary_name, furigana, english, korean, chinese, three_letter_code)
# All 30 stations have both 山 (white) and 区 (black) badges.
YAMANOTE_STATIONS = [
    (1,  "東京",            "とうきょう",            "Tōkyō",            "도쿄",                  "东京",          "TYO"),
    (2,  "神田",            "かんだ",                "Kanda",            "간다",                  "神田",          "KND"),
    (3,  "秋葉原",          "あきはばら",            "Akihabara",        "아키하바라",            "秋叶原",        "AKB"),
    (4,  "御徒町",          "おかちまち",            "Okachimachi",      "오카치마치",            "御徒町",        None),
    (5,  "上野",            "うえの",                "Ueno",             "우에노",                "上野",          "UEN"),
    (6,  "鶯谷",            "うぐいすだに",          "Uguisudani",       "우구이스다니",          "莺谷",          None),
    (7,  "日暮里",          "にっぽり",              "Nippori",          "닛포리",                "日暮里",        "NPR"),
    (8,  "西日暮里",        "にしにっぽり",          "Nishi-Nippori",    "니시닛포리",            "西日暮里",      None),
    (9,  "田端",            "たばた",                "Tabata",           "다바타",                "田端",          None),
    (10, "駒込",            "こまごめ",              "Komagome",         "고마고메",              "驹込",          None),
    (11, "巣鴨",            "すがも",                "Sugamo",           "스가모",                "巣鸭",          None),
    (12, "大塚",            "おおつか",              "Otsuka",           "오쓰카",                "大塚",          None),
    (13, "池袋",            "いけぶくろ",            "Ikebukuro",        "이케부쿠로",            "池袋",          "IKB"),
    (14, "目白",            "めじろ",                "Mejiro",           "메지로",                "目白",          None),
    (15, "高田馬場",        "たかだのばば",          "Takadanobaba",     "다카다노바바",          "高田马场",      None),
    (16, "新大久保",        "しんおおくぼ",          "Shin-Okubo",       "신오쿠보",              "新大久保",      None),
    (17, "新宿",            "しんじゅく",            "Shinjuku",         "신주쿠",                "新宿",          "SJK"),
    (18, "代々木",          "よよぎ",                "Yoyogi",           "요요기",                "代代木",        None),
    (19, "原宿",            "はらじゅく",            "Harajuku",         "하라주쿠",              "原宿",          None),
    (20, "渋谷",            "しぶや",                "Shibuya",          "시부야",                "涩谷",          "SBY"),
    (21, "恵比寿",          "えびす",                "Ebisu",            "에비스",                "恵比寿",        "EBS"),
    (22, "目黒",            "めぐろ",                "Meguro",           "메지로",                "目黒",          None),
    (23, "五反田",          "ごたんだ",              "Gotanda",          "고탄다",                "五反田",        None),
    (24, "大崎",            "おおさき",              "Osaki",            "오사키",                "大崎",          "OSK"),
    (25, "品川",            "しながわ",              "Shinagawa",        "시나가와",              "品川",          "SGW"),
    (26, "高輪ゲートウェイ", "たかなわげーとうぇい",  "Takanawa Gateway", "다카나와 게이트웨이",   "高轮Gateway",   "TGW"),
    (27, "田町",            "たまち",                "Tamachi",          "다마치",                "田町",          None),
    (28, "浜松町",          "はままつちょう",        "Hamamatsuchō",     "하마마쓰초",            "滨松町",        "HMC"),
    (29, "新橋",            "しんばし",              "Shimbashi",        "신바시",                "新桥",          "SMB"),
    (30, "有楽町",          "ゆうらくちょう",        "Yūrakucho",        "유라쿠초",              "有乐町",        None),
]

# ── Keihin-Tohoku / Negishi Line shared stations ──────────────────────────────
# Stations that exist on both Yamanote and Keihin-Tohoku.
# Reuse existing station-jy{jy_num:02d} records — only add station_lines + station_numbers.
# (jy_num, jk_num)  sort_order on JK line = jk_num
SHARED_JY_JK = [
    (25, 20),  # 品川
    (26, 21),  # 高輪ゲートウェイ
    (27, 22),  # 田町
    (28, 23),  # 浜松町
    (29, 24),  # 新橋
    (30, 25),  # 有楽町
    ( 1, 26),  # 東京
    ( 2, 27),  # 神田
    ( 3, 28),  # 秋葉原
    ( 4, 29),  # 御徒町
    ( 5, 30),  # 上野
    ( 6, 31),  # 鶯谷
    ( 7, 32),  # 日暮里
    ( 8, 33),  # 西日暮里
    ( 9, 34),  # 田端
]

# ── Keihin-Tohoku / Negishi Line exclusive stations ───────────────────────────
# (jk_num, primary_name, furigana, english, korean, chinese, tlc, [zone_ids])
JK_ONLY_STATIONS = [
    # ── Southern section: Ofuna → Oimachi (JK01 - JK19) ──────────────────────
    ( 1, "大船",            "おおふな",             "Ōfuna",            "오후나",                "大船",            "OFN", []),
    ( 2, "本郷台",          "ほんごうだい",         "Hongōdai",         "혼고다이",              "本郷台",          None, ["zone-yokohama"]),
    ( 3, "港南台",          "こうなんだい",         "Kōnandai",         "고난다이",              "港南台",          None, ["zone-yokohama"]),
    ( 4, "洋光台",          "ようこうだい",         "Yōkōdai",          "요코다이",              "洋光台",          None, ["zone-yokohama"]),
    ( 5, "新杉田",          "しんすぎた",           "Shin-Sugita",      "신스기타",              "新杉田",          None, ["zone-yokohama"]),
    ( 6, "磯子",            "いそご",               "Isogo",            "이소고",                "磯子",            None, ["zone-yokohama"]),
    ( 7, "根岸",            "ねぎし",               "Negishi",          "네기시",                "根岸",            None, ["zone-yokohama"]),
    ( 8, "山手",            "やまて",               "Yamate",           "야마테",                "山手",            None, ["zone-yokohama"]),
    ( 9, "石川町",          "いしかわちょう",       "Ishikawachō",      "이시카와초",            "石川町",          None, ["zone-yokohama"]),
    (10, "関内",            "かんない",             "Kannai",           "간나이",                "関内",            None, ["zone-yokohama"]),
    (11, "桜木町",          "さくらぎちょう",       "Sakuragichō",      "사쿠라기초",            "桜木町",          None, ["zone-yokohama"]),
    (12, "横浜",            "よこはま",             "Yokohama",         "요코하마",              "横浜",            "YHM", ["zone-yokohama"]),
    (13, "東神奈川",        "ひがしかながわ",       "Higashi-Kanagawa", "히가시카나가와",        "東神奈川",        None, ["zone-yokohama"]),
    (14, "新子安",          "しんこやす",           "Shin-Koyasu",      "신코야스",              "新子安",          None, ["zone-yokohama"]),
    (15, "鶴見",            "つるみ",               "Tsurumi",          "쓰루미",                "鶴見",            None, ["zone-yokohama"]),
    (16, "川崎",            "かわさき",             "Kawasaki",         "가와사키",              "川崎",            "KWS", ["zone-yokohama"]),
    (17, "蒲田",            "かまた",               "Kamata",           "가마타",                "蒲田",            None, ["zone-tokyo23ku"]),
    (18, "大森",            "おおもり",             "Ōmori",            "오모리",                "大森",            None, ["zone-tokyo23ku"]),
    (19, "大井町",          "おおいまち",           "Ōimachi",          "오이마치",              "大井町",          None, ["zone-tokyo23ku"]),

    # (JK20 - JK34 are Yamanote Line section stations: Shinagawa to Tabata)

    # ── Northern section: Kami-Nakazato → Omiya (JK35 - JK47) ──────────────────
    (35, "上中里",          "かみなかざと",         "Kami-Nakazato",    "가미나카자토",          "上中里",          None, ["zone-tokyo23ku"]),
    (36, "王子",            "おうじ",               "Ōji",              "오지",                  "王子",            None, ["zone-tokyo23ku"]),
    (37, "東十条",          "ひがしじゅうじょう",   "Higashi-Jūjō",     "히가시주조",            "東十条",          None, ["zone-tokyo23ku"]),
    (38, "赤羽",            "あかばね",             "Akabane",          "아카바네",              "赤羽",            "ABN", ["zone-tokyo23ku"]),
    (39, "川口",            "かわぐち",             "Kawaguchi",        "가와구치",              "川口",            None, []),
    (40, "西川口",          "にしかわぐち",         "Nishi-Kawaguchi",  "니시카와구치",          "西川口",          None, []),
    (41, "蕨",              "わらび",               "Warabi",           "와라비",                "蕨",              None, []),
    (42, "南浦和",          "みなみうらわ",         "Minami-Urawa",     "미나미우라와",          "南浦和",          None, []),
    (43, "浦和",            "うらわ",               "Urawa",            "우라와",                "浦和",            "URW", []),
    (44, "北浦和",          "きたうらわ",           "Kita-Urawa",       "기타우라와",            "北浦和",          None, []),
    (45, "与野",            "よの",                 "Yono",             "요노",                  "与野",            None, []),
    (46, "さいたま新都心",  "さいたましんとしん",   "Saitama-Shintoshin", "사이타마신토신",      "さいたま新都心",  None, []),
    (47, "大宮",            "おおみや",             "Ōmiya",            "오미야",                "大宮",            "OMY", []),
]


# ── Negishi Line stations (JK01–JK12, shared with Keihin-Tohoku) ─────────────
# No station numbers for Negishi Line.
# sort_order mirrors JK number.
NEGISHI_JK_NUMS = list(range(1, 13))  # JK01 to JK12

# ── JK 快速 service ──────────────────────────────────────────────────────────
# 快速 passes: 新橋(JK24), 有楽町(JK25), 鶯谷(JK31), 日暮里(JK32), 西日暮里(JK33)
# 快速 special: 御徒町(JK29)
# All other JK stations: stop
JK_KAISOKU_PASS = {24, 25, 31, 32, 33}   # JK numbers that are passed
JK_KAISOKU_SPECIAL = {29}                 # JK numbers with special status

# ── Shonan-Shinjuku Line (JS) ─────────────────────────────────────────────────
# (js_num, primary_name, furigana, english, korean, chinese, tlc, [zone_ids], reuse_station_id_or_None)
# Stations reusing existing records: provide the existing station ID.
# New stations: reuse_station_id = None → a new station-js{num:02d} record is created.
JS_STATIONS = [
    # js_num, name, furigana, en, ko, zh, tlc, zones, reuse_id
    ( 6, "逗子",       "ずし",           "Zushi",         "즈시",      "逗子",     None,  [],                          None),
    ( 7, "鎌倉",       "かまくら",       "Kamakura",      "가마쿠라",  "镰仓",     None,  [],                          None),
    ( 8, "北鎌倉",     "きたかまくら",   "Kita-Kamakura", "기타가마쿠라","北鎌倉", None,  [],                          None),
    ( 9, "大船",       "おおふな",       "Ōfuna",         "오후나",    "大船",     "OFN", [],                          "station-jk01"),
    (10, "戸塚",       "とつか",         "Totsuka",       "도쓰카",    "户冢",     "TTK", ["zone-yokohama"],           None),
    (11, "東戸塚",     "ひがしとつか",   "Higashi-Totsuka","히가시도쓰카","東户冢", None,  ["zone-yokohama"],           None),
    (12, "保土ヶ谷",   "ほどがや",       "Hodogaya",      "호도가야",  "保土谷",   None,  ["zone-yokohama"],           None),
    (13, "横浜",       "よこはま",       "Yokohama",      "요코하마",  "横浜",     "YHM", ["zone-yokohama"],           "station-jk12"),
    (14, "新川崎",     "しんかわさき",   "Shin-Kawasaki", "신카와사키","新川崎",   None,  [],                          None),
    (15, "武蔵小杉",   "むさしこすぎ",   "Musashi-Kosugi","무사시코스기","武蔵小杉","MKG", [],                         None),
    (16, "西大井",     "にしおおい",     "Nishi-Ōi",      "니시오이",  "西大井",   None,  ["zone-tokyo23ku"],          None),
    (17, "大崎",       "おおさき",       "Osaki",         "오사키",    "大崎",     "OSK", ["zone-yamanote", "zone-tokyo23ku"], "station-jy24"),
    (18, "恵比寿",     "えびす",         "Ebisu",         "에비스",    "恵比寿",   "EBS", ["zone-yamanote", "zone-tokyo23ku"], "station-jy21"),
    (19, "渋谷",       "しぶや",         "Shibuya",       "시부야",    "涩谷",     "SBY", ["zone-yamanote", "zone-tokyo23ku"], "station-jy20"),
    (20, "新宿",       "しんじゅく",     "Shinjuku",      "신주쿠",    "新宿",     "SJK", ["zone-yamanote", "zone-tokyo23ku"], "station-jy17"),
    (21, "池袋",       "いけぶくろ",     "Ikebukuro",     "이케부쿠로","池袋",     "IKB", ["zone-yamanote", "zone-tokyo23ku"], "station-jy13"),
    (22, "赤羽",       "あかばね",       "Akabane",       "아카바네",  "赤羽",     "ABN", ["zone-tokyo23ku"],          "station-jk38"),
    (23, "浦和",       "うらわ",         "Urawa",         "우라와",    "浦和",     "URW", [],                          "station-jk43"),
    (24, "大宮",       "おおみや",       "Ōmiya",         "오미야",    "大宮",     "OMY", [],                          "station-jk47"),
]

# JS service stop data: (js_num, service_key) for each stop
# service_key: "futsuu", "kaisoku_u", "kaisoku_y", "tokkaisu"
# Absence = pass
JS_SERVICE_STOPS = {
    # (js_num: set of service_keys)
     6: {"futsuu", "kaisoku_u"},
     7: {"futsuu", "kaisoku_u"},
     8: {"futsuu", "kaisoku_u"},
     9: {"futsuu", "kaisoku_u", "kaisoku_y", "tokkaisu"},
    10: {"futsuu", "kaisoku_u", "kaisoku_y", "tokkaisu"},
    11: {"futsuu", "kaisoku_u"},
    12: {"futsuu", "kaisoku_u"},
    13: {"futsuu", "kaisoku_u", "kaisoku_y", "tokkaisu"},
    14: {"futsuu", "kaisoku_u"},
    15: {"futsuu", "kaisoku_u", "kaisoku_y", "tokkaisu"},
    16: {"futsuu", "kaisoku_u"},
    17: {"futsuu", "kaisoku_u", "kaisoku_y", "tokkaisu"},
    18: {"futsuu", "kaisoku_u", "kaisoku_y"},
    19: {"futsuu", "kaisoku_u", "kaisoku_y", "tokkaisu"},
    20: {"futsuu", "kaisoku_u", "kaisoku_y", "tokkaisu"},
    21: {"futsuu", "kaisoku_u", "kaisoku_y", "tokkaisu"},
    22: {"futsuu", "kaisoku_u", "kaisoku_y", "tokkaisu"},
    23: {"futsuu", "kaisoku_u", "kaisoku_y", "tokkaisu"},
    24: {"futsuu", "kaisoku_u", "kaisoku_y", "tokkaisu"},
}


# ── Marunouchi Line (M) ───────────────────────────────────────────────────────
# (m_num, primary_name, furigana, english)
MARUNOUCHI_STATIONS = [
    ( 1, "荻窪",        "おぎくぼ",        "Ogikubo"),
    ( 2, "南阿佐ヶ谷",  "みなみあさがや",  "Minami-Asagaya"),
    ( 3, "新高円寺",    "しんこうえんじ",  "Shin-Koenji"),
    ( 4, "東高円寺",    "ひがしこうえんじ","Higashi-Koenji"),
    ( 5, "新中野",      "しんなかの",      "Shin-Nakano"),
    ( 6, "中野坂上",    "なかのさかうえ",  "Nakano-Sakaue"),
    ( 7, "西新宿",      "にししんじゅく",  "Nishi-Shinjuku"),
    ( 8, "新宿",        "しんじゅく",      "Shinjuku"),
    ( 9, "新宿三丁目",  "しんじゅくさんちょうめ", "Shinjuku-Sanchome"),
    (10, "新宿御苑前",  "しんじゅくぎょえんまえ", "Shinjukugyoen-mae"),
    (11, "四谷三丁目",  "よつやさんちょうめ",     "Yotsuya-Sanchome"),
    (12, "四ツ谷",      "よつや",          "Yotsuya"),
    (13, "赤坂見附",    "あかさかみつけ",  "Akasaka-Mitsuke"),
    (14, "国会議事堂前","こっかいぎじどうまえ",   "Kokkai-Gijidomae"),
    (15, "霞ヶ関",      "かすみがせき",    "Kasumigaseki"),
    (16, "銀座",        "ぎんざ",          "Ginza"),
    (17, "東京",        "とうきょう",      "Tokyo"),
    (18, "大手町",      "おおてまち",      "Otemachi"),
    (19, "淡路町",      "あわじちょう",    "Awajicho"),
    (20, "御茶ノ水",    "おちゃのみず",    "Ochanomizu"),
    (21, "本郷三丁目",  "ほんごうさんちょうめ",   "Hongo-Sanchome"),
    (22, "後楽園",      "こうらくえん",    "Korakuen"),
    (23, "茗荷谷",      "みょうがだに",    "Myogadani"),
    (24, "新大塚",      "しんおおつか",    "Shin-Otsuka"),
    (25, "池袋",        "いけぶくろ",      "Ikebukuro"),
]

# ── Marunouchi Line Branch (Mb) — 方南町支線 ─────────────────────────────────
# M06 中野坂上 is shared with the main line (station ID: station-m06).
# Mb03–Mb05 are unique to the branch.
# (mb_num, primary_name, furigana, english, reuse_station_id_or_None)
MARUNOUCHI_BRANCH_STATIONS = [
    (None, "中野坂上",      "なかのさかうえ",   "Nakano-Sakaue",   "station-m06"),  # shared M06
    (  5,  "中野新橋",      "なかのしんばし",   "Nakano-Shimbashi",  None),
    (  4,  "中野富士見町",  "なかのふじみちょう","Nakano-Fujimicho", None),
    (  3,  "方南町",        "ほうなんちょう",   "Honancho",          None),
]


def main():
    script_dir = os.path.dirname(__file__)
    out_path = os.path.normpath(os.path.join(script_dir, "..", ".claude", "output", "sample-yamanote-keihintouhoku-negishi.sqlite"))
    public_path = os.path.normpath(os.path.join(script_dir, "..", "public", "sample.sqlite"))

    if os.path.exists(out_path):
        os.remove(out_path)

    conn = sqlite3.connect(out_path)
    c = conn.cursor()
    c.executescript(SCHEMA_SQL)

    # Metadata
    c.execute("INSERT INTO db_metadata VALUES ('version', '0.5.0')")

    # Special zones
    for (zone_id, name, abbreviation, is_black) in SPECIAL_ZONES:
        c.execute(
            "INSERT INTO special_zones VALUES (?, ?, ?, ?)",
            (zone_id, name, abbreviation, is_black),
        )

    # Company — color matches default #3a9200, station_number_style = jreast
    company_id = "company-jreast"
    c.execute(
        "INSERT INTO companies VALUES (?, ?, ?, ?)",
        (company_id, "JR東日本", "#3a9200", "jreast"),
    )

    # ── Yamanote Line ─────────────────────────────────────────────────────────
    jy_line_id = "line-yamanote"
    c.execute(
        "INSERT INTO lines (id, company_id, name, line_color, prefix, priority, is_loop) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (jy_line_id, company_id, "山手線", "#8cc800", "JY", 1, 1),
    )

    for (num, primary_name, furigana, english, korean, chinese, tlc) in YAMANOTE_STATIONS:
        station_id = f"station-jy{num:02d}"

        c.execute(
            "INSERT INTO stations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (station_id, primary_name, furigana, english, korean, chinese, None, None, tlc, num),
        )

        c.execute(
            "INSERT INTO station_lines VALUES (?, ?, ?, ?)",
            (f"sl-jy{num:02d}", station_id, jy_line_id, num),
        )

        c.execute(
            "INSERT INTO station_numbers VALUES (?, ?, ?, ?)",
            (f"sn-jy{num:02d}", station_id, jy_line_id, f"{num:02d}"),
        )

        # Both 山 (white) and 区 (black) badges for every Yamanote station
        c.execute(
            "INSERT INTO station_areas VALUES (?, ?, ?, ?)",
            (f"area-jy{num:02d}-yama", station_id, "zone-yamanote", 0),
        )
        c.execute(
            "INSERT INTO station_areas VALUES (?, ?, ?, ?)",
            (f"area-jy{num:02d}-ku", station_id, "zone-tokyo23ku", 1),
        )

    # ── Keihin-Tohoku / Negishi Line ──────────────────────────────────────────
    jk_line_id = "line-keihin-tohoku"
    c.execute(
        "INSERT INTO lines (id, company_id, name, line_color, prefix, priority, is_loop) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (jk_line_id, company_id, "京浜東北線・根岸線", "#5f9de9", "JK", 2, 0),
    )

    # Shared stations: reuse existing station records, add only station_lines + station_numbers
    for (jy_num, jk_num) in SHARED_JY_JK:
        station_id = f"station-jy{jy_num:02d}"
        c.execute(
            "INSERT INTO station_lines VALUES (?, ?, ?, ?)",
            (f"sl-jk{jk_num:02d}", station_id, jk_line_id, jk_num),
        )
        c.execute(
            "INSERT INTO station_numbers VALUES (?, ?, ?, ?)",
            (f"sn-jk{jk_num:02d}", station_id, jk_line_id, f"{jk_num:02d}"),
        )

    # JK-only stations: new station records + station_lines + station_numbers + areas
    for (jk_num, primary_name, furigana, english, korean, chinese, tlc, zones) in JK_ONLY_STATIONS:
        station_id = f"station-jk{jk_num:02d}"

        c.execute(
            "INSERT INTO stations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (station_id, primary_name, furigana, english, korean, chinese, None, None, tlc, jk_num),
        )

        c.execute(
            "INSERT INTO station_lines VALUES (?, ?, ?, ?)",
            (f"sl-jk{jk_num:02d}", station_id, jk_line_id, jk_num),
        )

        c.execute(
            "INSERT INTO station_numbers VALUES (?, ?, ?, ?)",
            (f"sn-jk{jk_num:02d}", station_id, jk_line_id, f"{jk_num:02d}"),
        )

        for i, zone_id in enumerate(zones):
            c.execute(
                "INSERT INTO station_areas VALUES (?, ?, ?, ?)",
                (f"area-jk{jk_num:02d}-{zone_id.replace('zone-', '')}", station_id, zone_id, i),
            )

    # ── JK services (普通 + 快速) ─────────────────────────────────────────────
    # Build the full ordered list of (jk_num, station_id) for the JK line
    jk_all = []
    for (jy_num, jk_num) in SHARED_JY_JK:
        jk_all.append((jk_num, f"station-jy{jy_num:02d}"))
    for (jk_num, *rest) in JK_ONLY_STATIONS:
        jk_all.append((jk_num, f"station-jk{jk_num:02d}"))

    # 普通: stops at all JK stations
    jk_futsuu_id = "svc-jk-futsuu"
    c.execute(
        "INSERT INTO services VALUES (?, ?, ?, ?, ?)",
        (jk_futsuu_id, jk_line_id, "普通", "#8cc800", 0),
    )
    for (jk_num, station_id) in jk_all:
        c.execute(
            "INSERT INTO station_service_stops VALUES (?, ?, ?, ?)",
            (f"sss-jk-futsuu-{jk_num:02d}", station_id, jk_futsuu_id, "stop"),
        )

    # 快速: passes 新橋(24), 有楽町(25), 鶯谷(31), 日暮里(32), 西日暮里(33); 御徒町(29) is special
    jk_kaisoku_id = "svc-jk-kaisoku"
    c.execute(
        "INSERT INTO services VALUES (?, ?, ?, ?, ?)",
        (jk_kaisoku_id, jk_line_id, "快速", "#006ab7", 1),
    )
    for (jk_num, station_id) in jk_all:
        if jk_num in JK_KAISOKU_PASS:
            continue  # passed — no record
        status = "special" if jk_num in JK_KAISOKU_SPECIAL else "stop"
        c.execute(
            "INSERT INTO station_service_stops VALUES (?, ?, ?, ?)",
            (f"sss-jk-kaisoku-{jk_num:02d}", station_id, jk_kaisoku_id, status),
        )

    # ── Negishi Line ───────────────────────────────────────────────────────────
    negishi_line_id = "line-negishi"
    c.execute(
        "INSERT INTO lines (id, company_id, name, line_color, prefix, priority, is_loop) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (negishi_line_id, company_id, "根岸線", "#8bd900", "", 3, 0),
    )

    # Reuse existing station records (station-jk01 … station-jk12); add only station_lines
    for jk_num in NEGISHI_JK_NUMS:
        station_id = f"station-jk{jk_num:02d}"
        c.execute(
            "INSERT INTO station_lines VALUES (?, ?, ?, ?)",
            (f"sl-negishi{jk_num:02d}", station_id, negishi_line_id, jk_num),
        )

    # ── Shonan-Shinjuku Line ──────────────────────────────────────────────────
    js_line_id = "line-shonan-shinjuku"
    c.execute(
        "INSERT INTO lines (id, company_id, name, line_color, prefix, priority, is_loop) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (js_line_id, company_id, "湘南新宿ライン", "#c61c1b", "JS", 4, 0),
    )

    # JS services
    js_services = {
        "futsuu":    ("svc-js-futsuu",    "普通",                 "#5b9ea0", 1),
        "kaisoku_u": ("svc-js-kaisoku-u", "快速（宇都宮線内）",   "#6aaa00", 2),
        "kaisoku_y": ("svc-js-kaisoku-y", "快速（横須賀線・品鶴線内）", "#2a6db5", 3),
        "tokkaisu":  ("svc-js-tokkaisu",  "特別快速",             "#e8392a", 4),
    }
    for key, (svc_id, name, color, sort_order) in js_services.items():
        c.execute(
            "INSERT INTO services VALUES (?, ?, ?, ?, ?)",
            (svc_id, js_line_id, name, color, sort_order),
        )

    # Track which station IDs have already been inserted as new records
    inserted_station_ids = set()

    for (js_num, primary_name, furigana, english, korean, chinese, tlc, zones, reuse_id) in JS_STATIONS:
        if reuse_id is not None:
            station_id = reuse_id
        else:
            station_id = f"station-js{js_num:02d}"
            if station_id not in inserted_station_ids:
                c.execute(
                    "INSERT INTO stations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (station_id, primary_name, furigana, english, korean, chinese, None, None, tlc, js_num),
                )
                inserted_station_ids.add(station_id)

        c.execute(
            "INSERT INTO station_lines VALUES (?, ?, ?, ?)",
            (f"sl-js{js_num:02d}", station_id, js_line_id, js_num),
        )
        c.execute(
            "INSERT INTO station_numbers VALUES (?, ?, ?, ?)",
            (f"sn-js{js_num:02d}", station_id, js_line_id, f"{js_num:02d}"),
        )

        # Station areas — only add for new stations (reused stations already have areas)
        if reuse_id is None:
            for i, zone_id in enumerate(zones):
                c.execute(
                    "INSERT INTO station_areas VALUES (?, ?, ?, ?)",
                    (f"area-js{js_num:02d}-{zone_id.replace('zone-', '')}", station_id, zone_id, i),
                )

        # Service stops for this JS station
        stops_for_station = JS_SERVICE_STOPS.get(js_num, set())
        for key, (svc_id, _, _, _) in js_services.items():
            if key in stops_for_station:
                c.execute(
                    "INSERT INTO station_service_stops VALUES (?, ?, ?, ?)",
                    (f"sss-js{js_num:02d}-{key}", station_id, svc_id, "stop"),
                )

    # ── Tokyo Metro (東京メトロ) ───────────────────────────────────────────────
    company_metro_id = "company-tokyometro"
    c.execute(
        "INSERT INTO companies VALUES (?, ?, ?, ?)",
        (company_metro_id, "東京メトロ", "#00a3d9", "tokyometro"),
    )

    # ── Marunouchi Line (丸ノ内線) ────────────────────────────────────────────
    m_line_id = "line-marunouchi"
    c.execute(
        "INSERT INTO lines (id, company_id, name, line_color, prefix, priority, is_loop, parent_line_id)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (m_line_id, company_metro_id, "丸ノ内線", "#dd3839", "M", 1, 0, None),
    )

    # 普通 service for Marunouchi main line
    m_futsuu_id = "svc-m-futsuu"
    c.execute(
        "INSERT INTO services VALUES (?, ?, ?, ?, ?)",
        (m_futsuu_id, m_line_id, "普通", "#dd3839", 0),
    )

    for (m_num, primary_name, furigana, english) in MARUNOUCHI_STATIONS:
        station_id = f"station-m{m_num:02d}"
        c.execute(
            "INSERT INTO stations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (station_id, primary_name, furigana, english, None, None, None, None, None, m_num),
        )
        c.execute(
            "INSERT INTO station_lines VALUES (?, ?, ?, ?)",
            (f"sl-m{m_num:02d}", station_id, m_line_id, m_num),
        )
        c.execute(
            "INSERT INTO station_numbers VALUES (?, ?, ?, ?)",
            (f"sn-m{m_num:02d}", station_id, m_line_id, f"{m_num:02d}"),
        )
        c.execute(
            "INSERT INTO station_service_stops VALUES (?, ?, ?, ?)",
            (f"sss-m-futsuu-{m_num:02d}", station_id, m_futsuu_id, "stop"),
        )

    # ── Marunouchi Branch Line (丸ノ内線 方南町支線) ──────────────────────────
    mb_line_id = "line-marunouchi-branch"
    c.execute(
        "INSERT INTO lines (id, company_id, name, line_color, prefix, priority, is_loop, parent_line_id)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (mb_line_id, company_metro_id, "丸ノ内線（方南町支線）", "#dd3839", "Mb", 2, 0, m_line_id),
    )

    # 普通 service for branch line
    mb_futsuu_id = "svc-mb-futsuu"
    c.execute(
        "INSERT INTO services VALUES (?, ?, ?, ?, ?)",
        (mb_futsuu_id, mb_line_id, "普通", "#dd3839", 0),
    )

    mb_sort = 0
    for (mb_num, primary_name, furigana, english, reuse_id) in MARUNOUCHI_BRANCH_STATIONS:
        if reuse_id is not None:
            station_id = reuse_id
            # Shared station M06 — reuse record, just add a new station_lines entry
            c.execute(
                "INSERT INTO station_lines VALUES (?, ?, ?, ?)",
                (f"sl-mb-m06", station_id, mb_line_id, mb_sort),
            )
        else:
            station_id = f"station-mb{mb_num:02d}"
            c.execute(
                "INSERT INTO stations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (station_id, primary_name, furigana, english, None, None, None, None, None, mb_num),
            )
            c.execute(
                "INSERT INTO station_lines VALUES (?, ?, ?, ?)",
                (f"sl-mb{mb_num:02d}", station_id, mb_line_id, mb_sort),
            )
            c.execute(
                "INSERT INTO station_numbers VALUES (?, ?, ?, ?)",
                (f"sn-mb{mb_num:02d}", station_id, mb_line_id, f"{mb_num:02d}"),
            )
        c.execute(
            "INSERT INTO station_service_stops VALUES (?, ?, ?, ?)",
            (f"sss-mb-futsuu-{mb_sort:02d}", station_id, mb_futsuu_id, "stop"),
        )
        mb_sort += 1

    conn.commit()
    conn.close()

    # Also copy to public/ so the browser can fetch it
    import shutil
    shutil.copy2(out_path, public_path)

    jk_exclusive = len(JK_ONLY_STATIONS)
    jk_shared = len(SHARED_JY_JK)
    js_new = sum(1 for s in JS_STATIONS if s[8] is None)
    js_reuse = sum(1 for s in JS_STATIONS if s[8] is not None)
    mb_new = sum(1 for s in MARUNOUCHI_BRANCH_STATIONS if s[4] is None)

    print(f"Created: {out_path}")
    print(f"  - version: 0.5.1")
    print(f"  - 3 special zones (山手線内, 東京23区内, 横浜市内)")
    print(f"  - 2 companies (JR東日本 jreast, 東京メトロ tokyometro)")
    print(f"  - 6 lines:")
    print(f"      山手線          (JY, #8cc800,  is_loop=1): {len(YAMANOTE_STATIONS)} stations")
    print(f"      京浜東北線・根岸線 (JK, #5f9de9, is_loop=0): {jk_shared} shared + {jk_exclusive} exclusive = {jk_shared + jk_exclusive} total; 2 services (普通, 快速)")
    print(f"      根岸線          (no prefix, #8bd900, is_loop=0): {len(NEGISHI_JK_NUMS)} stations (shared with JK, no station numbers)")
    print(f"      湘南新宿ライン  (JS, #c61c1b,  is_loop=0): {len(JS_STATIONS)} stations ({js_new} new + {js_reuse} reused); 4 services")
    print(f"      丸ノ内線        (M,  #dd3839,  is_loop=0): {len(MARUNOUCHI_STATIONS)} stations; 1 service")
    print(f"      丸ノ内線（方南町支線）(Mb, #dd3839, is_loop=0): {len(MARUNOUCHI_BRANCH_STATIONS)} stations (1 shared + {mb_new} new); 1 service")


if __name__ == "__main__":
    main()
