export interface ContentTypeOption {
  value: string;
  label: string;
  description: string;
}

export interface ToneOption {
  value: string;
  label: string;
}

export function getContentTypes(): ContentTypeOption[] {
  return [
    { value: "educational", label: "Educational", description: "Teach something valuable" },
    { value: "promotional", label: "Promotional", description: "Highlight a product or offer" },
    { value: "inspirational", label: "Inspirational", description: "Motivate and uplift" },
    { value: "behind-the-scenes", label: "Behind the Scenes", description: "Show the process" },
    { value: "product-feature", label: "Product Feature", description: "Showcase a specific product" },
    { value: "ugc-style", label: "UGC Style", description: "Authentic, user-generated feel" },
  ];
}

export function getToneOptions(): ToneOption[] {
  return [
    { value: "friendly", label: "Friendly" },
    { value: "professional", label: "Professional" },
    { value: "playful", label: "Playful" },
    { value: "bold", label: "Bold" },
    { value: "empathetic", label: "Empathetic" },
    { value: "authoritative", label: "Authoritative" },
    { value: "casual", label: "Casual" },
    { value: "luxurious", label: "Luxurious" },
  ];
}
