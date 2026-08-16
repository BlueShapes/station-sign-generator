import {
  ColorInput as MantineColorInput,
  type ColorInputProps,
} from "@mantine/core";

export interface ScreenEyeDropperEnvironment {
  requested: boolean;
  userAgentDataPlatform?: string;
  navigatorPlatform?: string;
  userAgent?: string;
}

export function shouldEnableScreenEyeDropper({
  requested,
  userAgentDataPlatform,
  navigatorPlatform,
  userAgent,
}: ScreenEyeDropperEnvironment): boolean {
  if (!requested) return false;

  const platformDescription = [
    userAgentDataPlatform,
    navigatorPlatform,
    userAgent,
  ]
    .filter(Boolean)
    .join(" ");

  return !/(?:windows|win32|win64)/i.test(platformDescription);
}

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: { platform?: string };
};

function getLegacyNavigatorPlatform(browserNavigator: Navigator): string {
  return String(Reflect.get(browserNavigator, "platform") ?? "");
}

/**
 * Mantine ColorInput with the browser-supplied screen eyedropper disabled on
 * Windows. The native eyedropper can leave third-party IMEs disabled until the
 * browser window loses focus, and web content cannot reliably restore that OS
 * input context. The in-page picker, swatches, and text input remain available.
 */
export function PlatformColorInput({
  withEyeDropper,
  ...props
}: ColorInputProps) {
  const browserNavigator = navigator as NavigatorWithUserAgentData;
  const screenEyeDropperEnabled = shouldEnableScreenEyeDropper({
    requested: withEyeDropper !== false,
    userAgentDataPlatform: browserNavigator.userAgentData?.platform,
    navigatorPlatform: getLegacyNavigatorPlatform(browserNavigator),
    userAgent: browserNavigator.userAgent,
  });

  return (
    <MantineColorInput
      {...props}
      withEyeDropper={screenEyeDropperEnabled}
      data-screen-eyedropper-enabled={String(screenEyeDropperEnabled)}
    />
  );
}
