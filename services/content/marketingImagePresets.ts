import type { MarketingImageGoal } from "@/services/content/marketingImagePromptBuilder";

export interface MarketingImagePreset {
  app_name: string;
  app_description: string;
  audience: string;
  tone: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  default_cta: string;
  sample_headlines: string[];
}

export interface MarketingImageTemplate {
  goal: MarketingImageGoal;
  headline: string;
  subheadline: string;
  cta: string;
}

export const MYSEEDBOOK_PRESET: MarketingImagePreset = {
  app_name: "MySeedBook",
  app_description:
    "A gardening app that helps users organize seeds, suppliers, planting notes, and harvest results.",
  audience: "Home gardeners, seed savers, hobby growers, beginner gardeners.",
  tone: "Warm, helpful, organized, garden-friendly.",
  primary_color: "#12385C",
  secondary_color: "#E6D8B5",
  accent_color: "#3A4A2C",
  default_cta: "Download MySeedBook",
  sample_headlines: [
    "Keep your seed collection organized",
    "Stop buying duplicate seeds",
    "Track every seed in one place",
    "Plan your garden with confidence",
    "Turn seed chaos into garden clarity",
  ],
};

export const MYSEEDBOOK_TEMPLATES: MarketingImageTemplate[] = [
  {
    goal: "app-download",
    headline: "Keep your seed collection organized",
    subheadline: "Track varieties, suppliers, planting notes, and harvest results in one place.",
    cta: "Download MySeedBook",
  },
  {
    goal: "problem-solution",
    headline: "Stop buying duplicate seeds",
    subheadline: "Check what you already own before your next garden haul.",
    cta: "Organize your seeds today",
  },
  {
    goal: "feature-highlight",
    headline: "Track every seed in one place",
    subheadline: "Save supplier, variety, planting notes, and harvest outcomes.",
    cta: "Try MySeedBook",
  },
  {
    goal: "seasonal-campaign",
    headline: "Plan your next garden season",
    subheadline: "Keep seed notes, planting plans, and harvest results together.",
    cta: "Download MySeedBook",
  },
  {
    goal: "problem-solution",
    headline: "From seed chaos to garden clarity",
    subheadline: "Replace messy seed drawers with a searchable seed catalog.",
    cta: "Start organizing today",
  },
];

export function getMarketingImageTemplate(goal: MarketingImageGoal): MarketingImageTemplate | null {
  return MYSEEDBOOK_TEMPLATES.find((template) => template.goal === goal) ?? null;
}