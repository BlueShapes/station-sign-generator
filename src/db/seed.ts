import type { Database } from "sql.js";
import type DirectInputStationProps from "@/components/signs/DirectInputStationProps";
import { saveSignConfig } from "@/db/repositories/stations";

const DEFAULT_DATA: DirectInputStationProps = {
  leftPrimaryName: "品川",
  leftPrimaryNameFurigana: "しながわ",
  leftSecondaryName: "Shinagawa",
  leftNumberPrimary: "JY25",
  leftNumberSecondary: "",
  primaryName: "高輪ゲートウェイ",
  primaryNameFurigana: "たかなわげーとうぇい",
  secondaryName: "Takanawa Gateway",
  quaternaryName: "高轮Gateway",
  tertiaryName: "다카나와 게이트웨이",
  numberPrimary: "JY26",
  numberSecondary: "",
  threeLetterCode: "TGW",
  stationAreas: [
    { id: "seed-area-1", name: "山", isWhite: true },
    { id: "seed-area-2", name: "区", isWhite: false },
  ],
  note: "",
  rightPrimaryName: "田町",
  rightPrimaryNameFurigana: "たまち",
  rightSecondaryName: "Tamachi",
  rightNumberPrimary: "JY27",
  rightNumberSecondary: "",
  ratio: 4.5,
  direction: "left",
  baseColor: "#36ab33",
  lineColor: "#89ff12",
};

export function seedDefaultData(db: Database): void {
  saveSignConfig(db, DEFAULT_DATA);
}
