import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import {
  faFacebook,
  faInstagram,
  faLinkedin,
  faPinterest,
  faSnapchat,
  faThreads,
  faTiktok,
  faXTwitter,
  faYoutube,
} from "@fortawesome/free-brands-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

const BRAND_ICONS: Record<string, IconDefinition> = {
  instagram: faInstagram,
  facebook: faFacebook,
  pinterest: faPinterest,
  tiktok: faTiktok,
  x: faXTwitter,
  twitter: faXTwitter,
  linkedin: faLinkedin,
  youtube: faYoutube,
  threads: faThreads,
  snapchat: faSnapchat,
};

export type SocialPlatform = keyof typeof BRAND_ICONS;

interface SocialIconProps {
  platform: SocialPlatform;
  size?: number;
  color?: string;
}

export function SocialIcon({ platform, size = 20, color = "#000" }: SocialIconProps) {
  const icon = BRAND_ICONS[platform.toLowerCase()];
  if (!icon) return null;
  return <FontAwesomeIcon icon={icon} size={size} color={color} />;
}
