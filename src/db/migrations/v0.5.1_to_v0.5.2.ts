import type { Database } from "sql.js";

type StationNameColumn =
  | "secondary_name"
  | "tertiary_name"
  | "quaternary_name";

type StationNameCorrection = readonly [
  stationId: string,
  column: StationNameColumn,
  previousValue: string,
  correctedValue: string,
];

const corrections: readonly StationNameCorrection[] = [
  ["station-jy08", "tertiary_name", "니시닛포리", "니시 닛포리"],
  ["station-jy11", "quaternary_name", "巣鸭", "巢鸭"],
  ["station-jy12", "secondary_name", "Otsuka", "Ōtsuka"],
  ["station-jy12", "tertiary_name", "오쓰카", "오츠카"],
  ["station-jy16", "secondary_name", "Shin-Okubo", "Shin-Ōkubo"],
  ["station-jy16", "tertiary_name", "신오쿠보", "신 오쿠보"],
  ["station-jy21", "quaternary_name", "恵比寿", "惠比寿"],
  ["station-jy22", "tertiary_name", "메지로", "메구로"],
  ["station-jy22", "quaternary_name", "目黒", "目黑"],
  ["station-jy24", "secondary_name", "Osaki", "Ōsaki"],
  ["station-jy28", "tertiary_name", "하마마쓰초", "하마마츠초"],
  ["station-jy30", "secondary_name", "Yūrakucho", "Yūrakuchō"],
  ["station-jk02", "quaternary_name", "本郷台", "本乡台"],
  ["station-jk06", "quaternary_name", "磯子", "矶子"],
  ["station-jk10", "quaternary_name", "関内", "关内"],
  ["station-jk11", "quaternary_name", "桜木町", "樱木町"],
  ["station-jk12", "quaternary_name", "横浜", "横滨"],
  ["station-jk13", "quaternary_name", "東神奈川", "东神奈川"],
  ["station-jk15", "tertiary_name", "쓰루미", "츠루미"],
  ["station-jk15", "quaternary_name", "鶴見", "鹤见"],
  ["station-jk35", "tertiary_name", "가미나카자토", "가미 나카자토"],
  ["station-jk37", "quaternary_name", "東十条", "东十条"],
  ["station-jk46", "tertiary_name", "사이타마신토신", "사이타마 신토신"],
  ["station-jk46", "quaternary_name", "さいたま新都心", "埼玉新都心"],
  ["station-jk47", "quaternary_name", "大宮", "大宫"],
  ["station-js08", "tertiary_name", "기타가마쿠라", "기타 카마쿠라"],
  ["station-js08", "quaternary_name", "北鎌倉", "北镰仓"],
  ["station-js10", "tertiary_name", "도쓰카", "도츠카"],
  ["station-js11", "tertiary_name", "히가시도쓰카", "히가시 토츠카"],
  ["station-js11", "quaternary_name", "東户冢", "东户冢"],
  ["station-js15", "tertiary_name", "무사시코스기", "무사시 코스기"],
  ["station-js15", "quaternary_name", "武蔵小杉", "武藏小杉"],
  ["station-js16", "tertiary_name", "니시오이", "니시 오이"],
  ["station-m02", "secondary_name", "Minami-Asagaya", "Minami-asagaya"],
  ["station-m03", "secondary_name", "Shin-Koenji", "Shin-koenji"],
  ["station-m04", "secondary_name", "Higashi-Koenji", "Higashi-koenji"],
  ["station-m05", "secondary_name", "Shin-Nakano", "Shin-nakano"],
  ["station-m06", "secondary_name", "Nakano-Sakaue", "Nakano-sakaue"],
  ["station-m07", "secondary_name", "Nishi-Shinjuku", "Nishi-shinjuku"],
  ["station-m09", "secondary_name", "Shinjuku-Sanchome", "Shinjuku-sanchome"],
  ["station-m10", "secondary_name", "Shinjukugyoen-mae", "Shinjuku-gyoemmae"],
  ["station-m11", "secondary_name", "Yotsuya-Sanchome", "Yotsuya-sanchome"],
  ["station-m13", "secondary_name", "Akasaka-Mitsuke", "Akasaka-mitsuke"],
  ["station-m14", "secondary_name", "Kokkai-Gijidomae", "Kokkai-gijidomae"],
  ["station-m21", "secondary_name", "Hongo-Sanchome", "Hongo-sanchome"],
  ["station-m24", "secondary_name", "Shin-Otsuka", "Shin-otsuka"],
  ["station-mb04", "secondary_name", "Nakano-Fujimicho", "Nakano-fujimicho"],
  ["station-mb05", "secondary_name", "Nakano-Shimbashi", "Nakano-shimbashi"],
];

/**
 * Migrate from v0.5.1 to v0.5.2
 * - Correct English, Korean, and Simplified Chinese names in sample stations.
 * - Preserve user edits by replacing only the exact former sample values.
 */
export default function migrate(db: Database): void {
  for (const [stationId, column, previousValue, correctedValue] of corrections) {
    try {
      db.run(
        `UPDATE stations SET ${column} = ? WHERE id = ? AND ${column} = ?`,
        [correctedValue, stationId, previousValue],
      );
    } catch {
      /* ignore databases without the expected station schema */
    }
  }
}
