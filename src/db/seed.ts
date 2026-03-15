import type DirectInputStationProps from "@/components/signs/DirectInputStationProps";

export const DEFAULT_DATA: DirectInputStationProps = {
  left: [
    {
      id: "seed-left-1",
      primaryName: "品川",
      primaryNameFurigana: "しながわ",
      secondaryName: "Shinagawa",
      numberPrimaryPrefix: "JY",
      numberPrimaryValue: "25",
    },
  ],
  primaryName: "高輪ゲートウェイ",
  primaryNameFurigana: "たかなわげーとうぇい",
  secondaryName: "Takanawa Gateway",
  quaternaryName: "高轮Gateway",
  tertiaryName: "다카나와 게이트웨이",
  numberPrimaryPrefix: "JY",
  numberPrimaryValue: "26",
  threeLetterCode: "TGW",
  stationAreas: [
    { id: "seed-area-1", name: "山", isWhite: true },
    { id: "seed-area-2", name: "区", isWhite: false },
  ],
  note: "",
  right: [
    {
      id: "seed-right-1",
      primaryName: "田町",
      primaryNameFurigana: "たまち",
      secondaryName: "Tamachi",
      numberPrimaryPrefix: "JY",
      numberPrimaryValue: "27",
    },
  ],
  ratio: 4.5,
  direction: "left",
  baseColor: "#36ab33",
  localLines: [{ id: "seed-localline-1", prefix: "JY", color: "#9fff00" }],
};
