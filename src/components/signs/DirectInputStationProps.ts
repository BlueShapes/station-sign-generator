import { type RefObject } from "react";
import Konva from "konva";

export type LocalLine = {
  id: string;
  prefix: string;
  color: string;
  /** Badge style used by the company that owns this line. */
  stationNumberStyle?: string;
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
  /** Corporate color used for this branch arrow. */
  arrowColor?: string;
  primaryNameFurigana?: string;
  numberPrimaryPrefix?: string;
  numberPrimaryValue?: string;
  /** Resolved appearance of this station number's source line. */
  numberPrimaryColor?: string;
  numberPrimaryStyle?: string;
  numberSecondaryPrefix?: string;
  numberSecondaryValue?: string;
  numberTertiaryPrefix?: string;
  numberTertiaryValue?: string;
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
  /** Resolved appearance of the primary station number's source line. */
  numberPrimaryColor?: string;
  numberPrimaryStyle?: string;
  numberSecondaryPrefix?: string;
  numberSecondaryValue?: string;
  numberTertiaryPrefix?: string;
  numberTertiaryValue?: string;
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
  /** Render JR East arrows as independently branching company-colored paths. */
  branchMode?: boolean;
  /** Internal HMR key used to regenerate a branch preview after layout edits. */
  branchLayoutRenderKey?: string;
  ref?: RefObject<Konva.Stage>;
}

export type { DirectInputStationProps as default };
