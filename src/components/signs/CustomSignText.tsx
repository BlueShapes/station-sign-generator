import { createContext, useContext, type ReactNode } from "react";
import { Text } from "react-konva";
import Konva from "konva";
import type {
  CustomSignDefinition,
  CustomTextPart,
} from "@/customization/model";
import {
  fitSingleLineFontSize,
  resolveCustomTextConfig,
  shouldAutoFitCustomText,
} from "./customSignTextLayout";

const SignDefinitionContext = createContext<CustomSignDefinition | null>(null);

export function SignTextCustomizationProvider({
  definition,
  children,
}: {
  definition: CustomSignDefinition | null;
  children: ReactNode;
}) {
  return (
    <SignDefinitionContext.Provider value={definition}>
      {children}
    </SignDefinitionContext.Provider>
  );
}

export function useCustomSignDefinition(): CustomSignDefinition | null {
  return useContext(SignDefinitionContext);
}

export type CustomSignTextProps = Konva.TextConfig & {
  part: CustomTextPart;
};

export default function CustomSignText({
  part,
  y,
  fontFamily,
  fontSize,
  letterSpacing,
  padding,
  text,
  width,
  wrap,
  ...props
}: CustomSignTextProps) {
  const definition = useCustomSignDefinition();
  const resolved = resolveCustomTextConfig(
    { y, fontFamily, fontSize, letterSpacing },
    definition,
    part,
  );
  let fittedFontSize = resolved.fontSize;
  if (
    shouldAutoFitCustomText(definition, part) &&
    typeof resolved.fontSize === "number" &&
    typeof width === "number" &&
    width > 0 &&
    text
  ) {
    const measurement = new Konva.Text({
      text,
      fontFamily: resolved.fontFamily,
      fontSize: resolved.fontSize,
      fontStyle: props.fontStyle,
      fontVariant: props.fontVariant,
      letterSpacing: resolved.letterSpacing,
      wrap: "none",
    });
    fittedFontSize = fitSingleLineFontSize({
      fontSize: resolved.fontSize,
      naturalWidth: measurement.getTextWidth(),
      maxWidth: width - (padding ?? 0) * 2,
    });
    measurement.destroy();
  }

  return (
    <Text
      {...props}
      text={text}
      width={width}
      wrap={wrap ?? "none"}
      padding={padding}
      y={resolved.y}
      fontFamily={resolved.fontFamily}
      fontSize={fittedFontSize}
      letterSpacing={resolved.letterSpacing}
    />
  );
}
