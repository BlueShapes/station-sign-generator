import { type RefObject } from "react";
import Konva from "konva";

type StationArea = {
  id: string;
  name: string;
  isWhite?: boolean;
};

export type Direction = "left" | "right" | "both";

interface DirectInputStationProps {
  //main
  primaryName: string;
  primaryNameFurigana: string;
  note?: string;
  secondaryName: string;
  tertiaryName?: string;
  quaternaryName?: string;
  numberPrimary?: string;
  numberSecondary?: string;
  threeLetterCode?: string;
  stationAreas?: StationArea[];
  //right
  rightPrimaryName: string;
  rightSecondaryName: string;
  rightPrimaryNameFurigana?: string;
  rightNumberPrimary?: string;
  rightNumberSecondary?: string;
  //left
  leftPrimaryName: string;
  leftSecondaryName: string;
  leftPrimaryNameFurigana?: string;
  leftNumberPrimary?: string;
  leftNumberSecondary?: string;
  //misc
  lineColor: string;
  baseColor: string;
  ratio: number;
  direction?: Direction;
  ref?: RefObject<Konva.Stage>;
}

export type { DirectInputStationProps as default };
