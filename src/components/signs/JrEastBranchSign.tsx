import { forwardRef } from "react";
import type Konva from "konva";
import type StationProps from "./DirectInputStationProps";
import JrEastSign, {
  height,
  scale,
} from "./JrEastSign";
import { getJrEastBranchLayoutRenderKey } from "./jrEastBranchLayout";

export { height, scale };

const JrEastBranchSign = forwardRef<Konva.Stage, StationProps>((props, ref) => (
  <JrEastSign
    {...props}
    branchMode
    branchLayoutRenderKey={getJrEastBranchLayoutRenderKey()}
    ref={ref}
  />
));

export default JrEastBranchSign;
