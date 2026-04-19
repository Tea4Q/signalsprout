/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { lightTheme, darkTheme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof lightTheme.colors & keyof typeof darkTheme.colors
) {
  const scheme = useColorScheme() ?? 'light';
  const colorFromProps = props[scheme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return (scheme === 'light' ? lightTheme : darkTheme).colors[colorName];
  }
}
