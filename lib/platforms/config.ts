/**
 * Platform OAuth configuration.
 *
 * Client IDs are public and safe for the mobile bundle.
 * Client SECRETS must NEVER be placed here — they live exclusively as
 * Supabase Edge Function secrets (set via `supabase secrets set`).
 *
 * Required secrets per platform (set in Supabase dashboard or CLI):
 *   INSTAGRAM_CLIENT_ID / INSTAGRAM_CLIENT_SECRET
 *   PINTEREST_CLIENT_ID / PINTEREST_CLIENT_SECRET
 *   FACEBOOK_CLIENT_ID  / FACEBOOK_CLIENT_SECRET
 *   TIKTOK_CLIENT_KEY   / TIKTOK_CLIENT_SECRET
 *   X_CLIENT_ID         / X_CLIENT_SECRET
 *   LINKEDIN_CLIENT_ID  / LINKEDIN_CLIENT_SECRET
 *   GOOGLE_CLIENT_ID    / GOOGLE_CLIENT_SECRET
 *   THREADS_CLIENT_ID   / THREADS_CLIENT_SECRET  (same Meta app as Instagram)
 *   SNAPCHAT_CLIENT_ID  / SNAPCHAT_CLIENT_SECRET
 */

import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
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

export type PlatformId =
  | "instagram"
  | "pinterest"
  | "facebook"
  | "tiktok"
  | "x"
  | "linkedin"
  | "youtube"
  | "threads"
  | "snapchat";

export interface PlatformConfig {
  id: PlatformId;
  label: string;
  color: string;
  icon: IconDefinition;
  /** Whether this platform uses PKCE (code_challenge required). */
  usesPkce: boolean;
  /** Build the authorization URL given a redirect URI + opaque state value. */
  buildAuthUrl: (params: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge?: string;
  }) => string;
}

function buildQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

export const PLATFORMS: Record<PlatformId, PlatformConfig> = {
  instagram: {
    id: "instagram",
    label: "Instagram",
    color: "#E1306C",
    icon: faInstagram,
    usesPkce: false,
    buildAuthUrl: ({ clientId, redirectUri, state }) =>
      `https://www.facebook.com/dialog/oauth?${buildQuery({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
        response_type: "code",
        state,
      })}`,
  },

  pinterest: {
    id: "pinterest",
    label: "Pinterest",
    color: "#E60023",
    icon: faPinterest,
    usesPkce: false,
    buildAuthUrl: ({ clientId, redirectUri, state }) =>
      `https://www.pinterest.com/oauth/?${buildQuery({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "boards:read,pins:read,pins:write",
        response_type: "code",
        state,
      })}`,
  },

  facebook: {
    id: "facebook",
    label: "Facebook",
    color: "#1877F2",
    icon: faFacebook,
    usesPkce: false,
    buildAuthUrl: ({ clientId, redirectUri, state }) =>
      `https://www.facebook.com/dialog/oauth?${buildQuery({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "pages_manage_posts,pages_read_engagement",
        response_type: "code",
        state,
      })}`,
  },

  tiktok: {
    id: "tiktok",
    label: "TikTok",
    color: "#010101",
    icon: faTiktok,
    usesPkce: true,
    buildAuthUrl: ({ clientId, redirectUri, state, codeChallenge }) =>
      `https://www.tiktok.com/v2/auth/authorize/?${buildQuery({
        client_key: clientId,
        redirect_uri: redirectUri,
        scope: "user.info.basic,video.list",
        response_type: "code",
        state,
        ...(codeChallenge
          ? { code_challenge: codeChallenge, code_challenge_method: "S256" }
          : {}),
      })}`,
  },

  x: {
    id: "x",
    label: "X (Twitter)",
    color: "#000000",
    icon: faXTwitter,
    usesPkce: true,
    buildAuthUrl: ({ clientId, redirectUri, state, codeChallenge }) =>
      `https://twitter.com/i/oauth2/authorize?${buildQuery({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "tweet.read tweet.write users.read offline.access",
        response_type: "code",
        state,
        ...(codeChallenge
          ? { code_challenge: codeChallenge, code_challenge_method: "S256" }
          : {}),
      })}`,
  },

  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    color: "#0A66C2",
    icon: faLinkedin,
    usesPkce: false,
    buildAuthUrl: ({ clientId, redirectUri, state }) =>
      `https://www.linkedin.com/oauth/v2/authorization?${buildQuery({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "openid profile w_member_social",
        response_type: "code",
        state,
      })}`,
  },

  youtube: {
    id: "youtube",
    label: "YouTube",
    color: "#FF0000",
    icon: faYoutube,
    usesPkce: false,
    buildAuthUrl: ({ clientId, redirectUri, state }) =>
      `https://accounts.google.com/o/oauth2/v2/auth?${buildQuery({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope:
          "https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload",
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        state,
      })}`,
  },

  threads: {
    id: "threads",
    label: "Threads",
    color: "#101010",
    icon: faThreads,
    usesPkce: false,
    buildAuthUrl: ({ clientId, redirectUri, state }) =>
      `https://threads.net/oauth/authorize?${buildQuery({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "threads_basic,threads_content_publish",
        response_type: "code",
        state,
      })}`,
  },

  snapchat: {
    id: "snapchat",
    label: "Snapchat",
    color: "#FFFC00",
    icon: faSnapchat,
    usesPkce: false,
    buildAuthUrl: ({ clientId, redirectUri, state }) =>
      `https://accounts.snapchat.com/accounts/oauth2/auth?${buildQuery({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "snapchat-marketing-api",
        response_type: "code",
        state,
      })}`,
  },
};

/** Ordered list of all supported platforms for display. */
export const PLATFORM_LIST: PlatformConfig[] = [
  PLATFORMS.instagram,
  PLATFORMS.pinterest,
  PLATFORMS.facebook,
  PLATFORMS.tiktok,
  PLATFORMS.x,
  PLATFORMS.linkedin,
  PLATFORMS.youtube,
  PLATFORMS.threads,
  PLATFORMS.snapchat,
];
