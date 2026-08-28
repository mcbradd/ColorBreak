/**
 * Scryfall exposes appearance across several independent fields. Keep all of them:
 * a card can be borderless, a named showcase treatment, and a special foil at once.
 */
export interface PrintingVariantInput {
  set?: string;
  collectorNumber?: string;
  frameEffects?: string[];
  promoTypes?: string[];
  fullArt?: boolean;
  textless?: boolean;
  variation?: boolean;
  borderColor?: string;
  frame?: string;
  language?: string;
  finishes?: string[];
  variationOf?: string;
  flavorName?: string;
  illustrationId?: string;
  securityStamp?: string;
}

const FRAME_STYLES: Record<string, string> = {
  colorshifted: "Colorshifted",
  etched: "Etched Foil",
  extendedart: "Extended Art",
  fullart: "Full Art",
  inverted: "Inverted Frame",
  showcase: "Showcase",
  shatteredglass: "Shattered Glass",
};

// Frame effects that communicate rules/layout, not a collectible treatment.
const STRUCTURAL_FRAME_EFFECTS = new Set([
  "legendary", "miracle", "nyxtouched", "draft", "devoid", "tombstone",
  "sunmoondfc", "compasslanddfc", "originpwdfc", "mooneldrazidfc",
  "moonreversemoondfc", "waxingandwaningmoondfc", "companion", "snow",
  "lesson", "convertdfc", "fandfc", "upsidedowndfc",
  "enchantment", "spree",
]);

/** Official and currently observed Scryfall promo types that describe appearance. */
export const PROMO_VARIANT_LABELS: Record<string, string> = {
  ampersand: "Embossed Foil",
  confettifoil: "Confetti Foil",
  concept: "Concept Art",
  dossier: "Dossier Showcase",
  doubleexposure: "Double Exposure",
  doublerainbow: "Double Rainbow Foil",
  dragonscalefoil: "Dragon Scale Foil",
  draculaseries: "Dracula Series",
  embossed: "Embossed Foil",
  chocobotrackfoil: "Chocobo Track Foil",
  cosmicfoil: "Cosmic Foil",
  fracturefoil: "Fracture Foil",
  ffi: "FINAL FANTASY I",
  ffii: "FINAL FANTASY II",
  ffiii: "FINAL FANTASY III",
  ffiv: "FINAL FANTASY IV",
  ffv: "FINAL FANTASY V",
  ffvi: "FINAL FANTASY VI",
  ffvii: "FINAL FANTASY VII",
  ffviii: "FINAL FANTASY VIII",
  ffix: "FINAL FANTASY IX",
  ffx: "FINAL FANTASY X",
  ffxi: "FINAL FANTASY XI",
  ffxii: "FINAL FANTASY XII",
  ffxiii: "FINAL FANTASY XIII",
  ffxiv: "FINAL FANTASY XIV",
  ffxv: "FINAL FANTASY XV",
  ffxvi: "FINAL FANTASY XVI",
  facetfoil: "Facet Foil",
  firstplacefoil: "First-Place Foil",
  galaxyfoil: "Galaxy Foil",
  gilded: "Gilded Foil",
  gleaminggold: "Gleaming-Gold Foil",
  glossy: "Glossy",
  godzillaseries: "Godzilla Series",
  halofoil: "Halo Foil",
  headliner: "Headliner",
  imagine: "Imagine Showcase",
  invisibleink: "Invisible Ink",
  jpwalker: "Japanese Planeswalker",
  japanshowcase: "Japan Showcase",
  manafoil: "Mana Foil",
  magnified: "Magnified Showcase",
  moonlitland: "Moonlit Land",
  neonink: "Neon Ink Foil",
  oilslick: "Oil Slick Raised Foil",
  plastic: "Plastic Card",
  portrait: "Borderless Portrait",
  poster: "Poster Showcase",
  rainbowfoil: "Rainbow Foil",
  raisedfoil: "Raised Foil",
  ravnicacity: "Ravnica City Showcase",
  ripplefoil: "Ripple Foil",
  schinesealtart: "Simplified Chinese Alternate Art",
  scroll: "Scroll Showcase",
  serialized: "Serialized",
  singularityfoil: "Singularity Foil",
  silverfoil: "Silver Foil",
  silverscroll: "Silver Scroll Foil",
  sourcematerial: "Source Material",
  stepandcompleat: "Step-and-Compleat Foil",
  surgefoil: "Surge Foil",
  textured: "Textured Foil",
  thick: "Thick Card",
  upsidedown: "Upside Down",
  upsidedownback: "Upside Down Back",
  vault: "Vault Frame",
};

export const PROCESS_PROMO_TYPES = new Set([
  "ampersand", "chocobotrackfoil", "confettifoil", "cosmicfoil", "doublerainbow",
  "dragonscalefoil", "embossed", "facetfoil", "firstplacefoil", "fracturefoil",
  "galaxyfoil", "gilded", "glossy", "halofoil", "invisibleink", "manafoil",
  "neonink", "oilslick", "raisedfoil", "rainbowfoil", "ripplefoil", "silverfoil",
  "singularityfoil", "silverscroll", "gleaminggold", "stepandcompleat", "surgefoil", "textured",
]);

const ATTRIBUTE_PROMO_TYPES = new Set(["headliner", "serialized"]);

// Distribution/provenance attributes are retained by the snapshot, but are not art styles.
const NON_VISUAL_PROMO_TYPES = new Set([
  "alchemy", "arenaleague", "beginnerbox", "boosterfun", "boxtopper", "brawldeck",
  "bringafriend", "bundle", "buyabox", "commanderparty", "convention", "datestamped",
  "draftweekend", "duels", "event", "fnm", "gameday", "giftbox", "instore", "intropack",
  "judgegift", "league", "mediainsert", "openhouse", "planeswalkerdeck", "playerrewards",
  "playpromo", "playtest", "premiereshop", "prerelease", "promopack", "rebalanced", "release",
  "resale", "setextension", "setpromo", "sldbonus", "stamped", "startercollection",
  "starterdeck", "storechampionship", "themepack", "tourney", "wizardsplaynetwork",
  "universesbeyond",
]);

function humanizeUnknown(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/(foil|showcase|frame|art|land)$/i, " $1")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function printingVariants(input: PrintingVariantInput): string[] {
  const labels: string[] = [];
  const add = (label: string | undefined) => {
    if (label && !labels.includes(label)) labels.push(label);
  };

  if (input.borderColor === "borderless" || input.promoTypes?.includes("borderless")) add("Borderless");
  if (input.frame === "1993" || input.frame === "1997") add("Retro Frame");
  for (const effect of input.frameEffects ?? []) {
    if (STRUCTURAL_FRAME_EFFECTS.has(effect)) continue;
    add(FRAME_STYLES[effect] ?? humanizeUnknown(effect));
  }
  if (input.fullArt) add("Full Art");
  if (input.textless) add("Textless");
  if (input.variation) add("Alternate Art");
  if (input.language === "ph") add("Phyrexian Language");
  if (input.language === "dw") add("Dwarvish Script");
  if (input.language === "qya") add(({ "408": "Elven Ring Script", "408z": "Elven Ring Script", "409": "Dwarven Ring Script", "409z": "Dwarven Ring Script", "410": "Human Ring Script", "410z": "Human Ring Script" } as Record<string, string>)[input.collectorNumber ?? ""] ?? "Quenya Script");
  for (const promoType of input.promoTypes ?? []) {
    if (promoType === "borderless" || NON_VISUAL_PROMO_TYPES.has(promoType)) continue;
    add(PROMO_VARIANT_LABELS[promoType] ?? humanizeUnknown(promoType));
  }
  return labels;
}

export function treatmentMetadata(input: PrintingVariantInput) {
  const frameEffects = [...new Set(input.frameEffects ?? [])];
  const promoTypes = [...new Set(input.promoTypes ?? [])];
  const styleTags = [
    ...frameEffects.filter((tag) => !STRUCTURAL_FRAME_EFFECTS.has(tag)),
    ...promoTypes.filter((tag) => tag === "borderless" ||
      (Object.hasOwn(PROMO_VARIANT_LABELS, tag) && !PROCESS_PROMO_TYPES.has(tag) &&
        !ATTRIBUTE_PROMO_TYPES.has(tag) && !NON_VISUAL_PROMO_TYPES.has(tag))),
  ];
  const knownTags = new Set([
    ...Object.keys(FRAME_STYLES), ...STRUCTURAL_FRAME_EFFECTS,
    ...Object.keys(PROMO_VARIANT_LABELS), ...NON_VISUAL_PROMO_TYPES,
    ...PROCESS_PROMO_TYPES, ...ATTRIBUTE_PROMO_TYPES, "borderless",
  ]);
  return {
    rawFrameEffects: frameEffects,
    rawPromoTypes: promoTypes,
    finishClasses: [...new Set(input.finishes ?? [])],
    styleTags: [...new Set(styleTags)],
    processTags: promoTypes.filter((tag) => PROCESS_PROMO_TYPES.has(tag)),
    attributeTags: promoTypes.filter((tag) => ATTRIBUTE_PROMO_TYPES.has(tag) || NON_VISUAL_PROMO_TYPES.has(tag)),
    unknownTags: [...frameEffects, ...promoTypes].filter((tag) => !knownTags.has(tag)),
    ...(input.borderColor ? { borderColor: input.borderColor } : {}),
    fullArt: Boolean(input.fullArt),
    textless: Boolean(input.textless),
    ...(input.variationOf ? { variationOf: input.variationOf } : {}),
    ...(input.language ? { language: input.language } : {}),
    ...(input.flavorName ? { flavorName: input.flavorName } : {}),
    ...(input.illustrationId ? { illustrationId: input.illustrationId } : {}),
    ...(input.securityStamp ? { securityStamp: input.securityStamp } : {}),
  };
}
