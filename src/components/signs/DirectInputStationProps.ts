import { type RefObject } from "react";
import Konva from "konva";

export type LocalLine = {
  id: string;
  prefix: string;
  color: string;
};

type StationArea = {
  id: string;
  name: string;
  isWhite?: boolean;
};

export type Direction = "left" | "right" | "both";
export type MetroLongSubTextMode = "furigana" | "secondary";

export type AdjacentStationProps = {
  id: string;
  primaryName: string;
  secondaryName: string;
  primaryNameFurigana?: string;
  numberPrimaryPrefix?: string;
  numberPrimaryValue?: string;
  numberSecondaryPrefix?: string;
  numberSecondaryValue?: string;
};

interface DirectInputStationProps {
  //main
  primaryName: string;
  primaryNameFurigana: string;
  note?: string;
  secondaryName: string;
  tertiaryName?: string;
  quaternaryName?: string;
  numberPrimaryPrefix?: string;
  numberPrimaryValue?: string;
  numberSecondaryPrefix?: string;
  numberSecondaryValue?: string;
  threeLetterCode?: string;
  stationAreas?: StationArea[];
  //adjacent
  left: AdjacentStationProps[];
  right: AdjacentStationProps[];
  //misc
  stationNumberStyle?: string;
  baseColor: string;
  /** 1–4 colors shown as horizontal segments in the center square. Falls back to baseColor if empty/absent. */
  centerSquareColors?: string[];
  localLines?: LocalLine[];
  ratio: number;
  direction?: Direction;
  subTextMode?: MetroLongSubTextMode;
  ref?: RefObject<Konva.Stage>;
}

export type { DirectInputStationProps as default };
