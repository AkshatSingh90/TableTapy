/**
 * Utility for Menu Item Portions, Add-ons, and Quick Prep Tags in TableTapy.
 *
 * Rules:
 * 1. Base Price = Default "Full" price.
 * 2. If portions are enabled, "Full" inherits Base Price; "Half" and other sizes have their own prices.
 * 3. Add-ons add extra cost (e.g. Extra Butter +₹30).
 * 4. Prep tags are 1-tap kitchen instructions (e.g. [No Onion/Garlic], [Extra Spicy]).
 */

export interface PortionOption {
  name: string;
  price: number;
  isDefault?: boolean;
}

export interface AddonOption {
  id: string;
  name: string;
  price: number;
}

export interface ItemVariantsConfig {
  hasPortions: boolean;
  portions: PortionOption[];
  hasAddons: boolean;
  addons: AddonOption[];
  prepTags: string[];
}

export const COMMON_PREP_TAGS = [
  "Mild",
  "Medium Spicy",
  "Extra Spicy 🔥",
  "Less Oil",
  "No Onion / Garlic (Jain)",
  "No Sugar",
  "Less Ice",
  "Crispy / Well Done",
];

export function getDefaultVariantsConfig(basePrice: number = 0): ItemVariantsConfig {
  return {
    hasPortions: false,
    portions: [
      { name: "Full", price: basePrice || 0, isDefault: true },
      { name: "Half", price: Math.round(basePrice * 0.6) || 0, isDefault: false },
    ],
    hasAddons: false,
    addons: [],
    prepTags: [],
  };
}

/**
 * Extracts clean user description and structured variants configuration.
 */
export function extractVariantsFromDescription(
  rawDescription?: string | null,
  basePrice: number = 0
): { cleanDescription: string; config: ItemVariantsConfig } {
  const fallback = getDefaultVariantsConfig(basePrice);
  if (!rawDescription) {
    return { cleanDescription: "", config: fallback };
  }

  // 1. Look for [VARIANTS:base64...] or [VARIANTS:json...]
  const b64Match = rawDescription.match(/\[VARIANTS_B64:([a-zA-Z0-9+/=]+)\]/i);
  let parsedConfig: Partial<ItemVariantsConfig> | null = null;

  if (b64Match && b64Match[1]) {
    try {
      const decoded = typeof atob !== "undefined"
        ? decodeURIComponent(escape(atob(b64Match[1])))
        : Buffer.from(b64Match[1], "base64").toString("utf-8");
      parsedConfig = JSON.parse(decoded);
    } catch (e) {
      console.warn("Failed to decode base64 variants:", e);
    }
  } else {
    const jsonMatch = rawDescription.match(/\[VARIANTS:(\{.*?\})\]/i);
    if (jsonMatch && jsonMatch[1]) {
      try {
        parsedConfig = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.warn("Failed to parse JSON variants:", e);
      }
    }
  }

  // Clean description of system tags
  const cleanDescription = rawDescription
    .replace(/\[VARIANTS_B64:[^\]]+\]\s*/gi, "")
    .replace(/\[VARIANTS:[^\]]+\]\s*/gi, "")
    .replace(/\[REST:[^\]]+\]\s*/gi, "")
    .replace(/\[REST\s*:\s*[^\]]+\]\s*/gi, "")
    .replace(/rest:[0-9a-fA-F-]{10,}\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!parsedConfig) {
    return { cleanDescription, config: fallback };
  }

  // Ensure "Full" portion always matches base price if no specific price was set
  const portions = (parsedConfig.portions && parsedConfig.portions.length > 0)
    ? parsedConfig.portions.map(p => ({
        name: p.name || "Full",
        price: Number(p.price) || 0,
        isDefault: p.isDefault ?? (p.name?.toLowerCase() === "full"),
      }))
    : fallback.portions;

  return {
    cleanDescription,
    config: {
      hasPortions: Boolean(parsedConfig.hasPortions),
      portions,
      hasAddons: Boolean(parsedConfig.hasAddons),
      addons: (parsedConfig.addons || []).map(a => ({
        id: a.id || `addon_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: a.name || "",
        price: Number(a.price) || 0,
      })),
      prepTags: Array.isArray(parsedConfig.prepTags) ? parsedConfig.prepTags : [],
    },
  };
}

/**
 * Serializes user description with variants config and optional restaurant ID tag.
 */
export function buildTaggedDescription(
  userDescription: string,
  config: ItemVariantsConfig,
  restaurantId?: string | null
): string {
  const clean = (userDescription || "").trim();
  let serializedVariants = "";

  if (config && (config.hasPortions || config.hasAddons || (config.prepTags && config.prepTags.length > 0))) {
    try {
      const jsonStr = JSON.stringify(config);
      const b64 = typeof btoa !== "undefined"
        ? btoa(unescape(encodeURIComponent(jsonStr)))
        : Buffer.from(jsonStr, "utf-8").toString("base64");
      serializedVariants = `[VARIANTS_B64:${b64}]`;
    } catch (e) {
      console.warn("Failed to encode variants:", e);
    }
  }

  const parts = [clean, serializedVariants];
  if (restaurantId) {
    parts.push(`[REST:${restaurantId}]`);
  }

  return parts.filter(Boolean).join(" ").trim();
}
