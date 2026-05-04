import { ColorName, Colors } from "@/shared/theme";
import { useSettings } from "@/core/providers/SettingsContext";

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: ColorName,
) {
  const { darkMode } = useSettings();
  const theme = darkMode ? "dark" : "light";
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
