import { darkTheme, lightTheme } from "@/constants/theme";
import { useThemePreference } from "@/context/theme-context";

export function useTheme() {
  const { resolvedScheme } = useThemePreference();
  return resolvedScheme === "light" ? lightTheme : darkTheme;
}
