export type MarketingImageGoal =
  | "app-download"
  | "feature-highlight"
  | "problem-solution"
  | "seasonal-campaign"
  | "tutorial-demo"
  | "announcement";

export type MarketingImageFormat =
  | "instagram-square"
  | "instagram-story"
  | "pinterest-pin"
  | "facebook-post"
  | "linkedin-post";

export interface MarketingImageBrandContext {
  appName: string;
  appDescription?: string;
  audience?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  defaultCta?: string;
}

const FORMAT_GUIDANCE: Record<MarketingImageFormat, string> = {
  "instagram-square": "Instagram square 1080x1080. Keep the composition center-weighted and readable at small sizes.",
  "instagram-story": "Instagram story or reel cover 1080x1920. Use a tall composition with clear empty space for text overlays.",
  "pinterest-pin": "Pinterest pin 1000x1500. Use a vertical composition with open space for headline and CTA text.",
  "facebook-post": "Facebook post 1200x630. Use a wide composition with balanced negative space.",
  "linkedin-post": "LinkedIn post 1200x627. Use a clean professional layout with room for headline text.",
};

const GOAL_GUIDANCE: Record<MarketingImageGoal, string> = {
  "app-download": "Promote app downloads and make the product feel desirable and easy to try.",
  "feature-highlight": "Focus on one standout product feature and show how it helps the user.",
  "problem-solution": "Show a common user pain point and present the app as the clear solution.",
  "seasonal-campaign": "Tie the creative to a seasonal or timely campaign theme.",
  "tutorial-demo": "Support a tutorial or demo style post that feels practical and helpful.",
  announcement: "Announce a new product update, launch, or important brand message.",
};

function clean(value?: string): string {
  return value?.trim() ?? "";
}

function colorLine(label: string, value?: string): string | null {
  const cleaned = clean(value);
  return cleaned ? `${label}: ${cleaned}.` : null;
}

export interface BuildMarketingImagePromptInput {
  brand: MarketingImageBrandContext;
  goal: MarketingImageGoal;
  format: MarketingImageFormat;
}

export function buildMarketingImagePrompt({
  brand,
  goal,
  format,
}: BuildMarketingImagePromptInput): string {
  const lines: string[] = [];

  lines.push(`Create a polished social media marketing background for the ${clean(brand.appName)} app.`);

  if (clean(brand.appDescription)) {
    lines.push(`App description: ${clean(brand.appDescription)}.`);
  }

  if (clean(brand.audience)) {
    lines.push(`Audience: ${clean(brand.audience)}.`);
  }

  lines.push(`Goal: ${GOAL_GUIDANCE[goal]}`);
  lines.push(`Format: ${FORMAT_GUIDANCE[format]}`);

  const brandLines = [
    colorLine("Primary color", brand.primaryColor),
    colorLine("Secondary color", brand.secondaryColor),
    colorLine("Accent color", brand.accentColor),
  ].filter((line): line is string => Boolean(line));

  if (brandLines.length > 0) {
    lines.push(`Brand direction: ${brandLines.join(" ")}`);
  }

  if (clean(brand.defaultCta)) {
    lines.push(`Default CTA to support later text overlays: ${clean(brand.defaultCta)}.`);
  }

  lines.push(
    "Create a beautiful background or scene with marketing-friendly props, natural textures, or decorative visuals that fit the app's topic.",
  );
  lines.push(
    "Leave clean open space where the app screenshot, headline, subheadline, CTA, and badge will be placed later by the app.",
  );
  lines.push(
    "Do not generate readable text, fake UI, app screens, watermarks, logos, labels, random letters, numbers, or gibberish. The app will add all readable text and any screenshot later.",
  );
  lines.push(
    "Keep the composition polished, brand-aligned, and suitable for mobile social media viewing.",
  );

  return lines.join(" ");
}