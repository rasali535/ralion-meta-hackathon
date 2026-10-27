/**
 * RALION OS — STRUCTURED CREATIVE BRIEF & DESIGN SYSTEM CONTRACTS
 * 
 * Formal contracts separating raw visual asset generation from
 * deterministic typography, brand layout composition, and quality scoring.
 */

export type CreativeFormat = '1:1_SQUARE' | '4:5_PORTRAIT' | '16:9_LANDSCAPE' | '9:16_STORY';

export type CreativeType = 'POSTER' | 'FLYER';

export type PosterLayoutType =
  | 'FULL_BLEED_HERO'        // 100% full visual with subtle organic vignette & bottom typography
  | 'SPLIT_COMPOSITION'      // 55/45 visual vs matte brand layout for guaranteed contrast
  | 'EDITORIAL_TYPOGRAPHY'   // Luxury editorial typography with framed photo & generous whitespace
  | 'SERVICE_FOCUS';         // Focused central visual, top hook, 3 capability points, CTA

export type FlyerLayoutType =
  | 'EDITORIAL_FLYER'         // Premium corporate flyer with asymmetric grid & clear hierarchy
  | 'BOLD_COMMERCIAL_FLYER'   // High-impact promotional flyer with hero visual & offer badge
  | 'MODERN_BUSINESS_FLYER';  // Clean 3-pillar capability flyer with structured contact footer

export type CreativeTemplateId =
  | 'CORPORATE_HERO'          // Legacy alias -> FULL_BLEED_HERO
  | 'PRODUCT_FOCUS'           // Legacy alias -> SERVICE_FOCUS
  | 'SERVICE_PROMO'           // Legacy alias -> SERVICE_FOCUS
  | 'OFFER_DISCOUNT'          // Legacy alias -> BOLD_COMMERCIAL_FLYER / FULL_BLEED_HERO
  | 'ANNOUNCEMENT'            // Legacy alias -> EDITORIAL_TYPOGRAPHY
  | 'EVENT_SHOWCASE'          // Legacy alias -> FULL_BLEED_HERO
  | 'MULTI_SECTION_FLYER'     // Legacy alias -> MODERN_BUSINESS_FLYER
  | PosterLayoutType
  | FlyerLayoutType;

export type TypographyStyle =
  | 'MODERN_INTER'            // Inter / Inter (Clean Modern)
  | 'CORPORATE_MONTSERRAT'    // Montserrat / Inter (Executive Trust)
  | 'EDITORIAL_PLAYFAIR'      // Playfair Display / Inter (Luxury Editorial)
  | 'BOLD_GROTESK';           // Space Grotesk / Inter (High Energy Tech)

export interface BrandColorPalette {
  primary: string;       // Main brand accent / button fill
  secondary: string;     // Supporting highlight / badge
  accent: string;        // Urgency / spark accent
  neutralDark: string;   // Deep background / scrim (e.g. #09090b)
  neutralLight: string;  // Crisp text (e.g. #ffffff)
  textMuted: string;     // Subtitle / disclaimer text (e.g. #94a3b8)
}

export interface ContactInfo {
  phone?: string;
  email?: string;
  website?: string;
  location?: string;
}

export interface StructuredVisualPrompt {
  subject: string;
  environment: string;
  action: string;
  audience: string;
  brandContext: string;
  camera: string;
  lighting: string;
  composition: string;
  negativeSpace: string;
  style: string;
  negativePrompts: string;
  fullPrompt: string;
}

export interface StructuredCreativeBrief {
  id: string;
  organizationId?: string;
  campaignObjective: 'LEAD_GENERATION' | 'BRAND_AWARENESS' | 'PRODUCT_LAUNCH' | 'EVENT_PROMOTION' | 'SPECIAL_OFFER' | 'RECRUITMENT';
  targetAudience: string;
  platform: 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'whatsapp' | 'web';
  format: CreativeFormat;
  creativeType: CreativeType;
  templateId: CreativeTemplateId;
  posterLayout?: PosterLayoutType;
  flyerLayout?: FlyerLayoutType;
  
  // Deterministic Copy Hierarchy
  brandName: string;
  industry: string;
  headline: string;
  subheadline?: string;
  bodyCopy?: string;
  keyBenefits?: string[];
  offerBadge?: string;
  cta: string;
  contactDetails?: ContactInfo;
  urgency?: string;
  disclaimers?: string;
  
  // Design & Brand System
  brandColors: BrandColorPalette;
  typographyStyle: TypographyStyle;
  logoUrl?: string;
  logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  // AI Visual Generation Direction (Separated from Copy)
  visualDirection: {
    prompt: string;
    style: string;
    negativeSpacePlacement: 'bottom' | 'top' | 'left' | 'right' | 'center';
    structure?: StructuredVisualPrompt;
  };
}

export interface CommercialVisualQAResult {
  passed: boolean;
  overallScore: number;
  hierarchyPass: boolean;
  contrastPass: boolean;
  whitespacePass: boolean;
  tenantIsolationPass: boolean;
  copyNaturalnessPass: boolean;
  brandingPass: boolean;
  evaluatedMetrics: {
    visualScore: number;
    hierarchyScore: number;
    typographyScore: number;
    brandingScore: number;
    readabilityScore: number;
    ctaScore: number;
  };
  passedChecks: string[];
  reasons: string[];
}

export interface CreativeQualityScorecard {
  visualScore: number;
  hierarchyScore: number;
  typographyScore: number;
  brandingScore: number;
  readabilityScore: number;
  ctaScore: number;
  overallScore: number;
  passedChecks: string[];
  warnings: string[];
}

export interface CreativeVariation {
  id: string;
  title: string;
  description: string;
  brief: StructuredCreativeBrief;
  qualityScore: CreativeQualityScorecard;
  previewUrl?: string;
}

export interface FormatDimensions {
  width: number;
  height: number;
  aspectRatio: string;
  label: string;
}

export const SOCIAL_DIMENSIONS: Record<CreativeFormat, FormatDimensions> = {
  '1:1_SQUARE': { width: 1080, height: 1080, aspectRatio: '1:1', label: '1:1 Square (Instagram / Facebook)' },
  '4:5_PORTRAIT': { width: 1080, height: 1350, aspectRatio: '4:5', label: '4:5 Feed Portrait (High Engagement)' },
  '16:9_LANDSCAPE': { width: 1200, height: 675, aspectRatio: '16:9', label: '16:9 Landscape (LinkedIn / X / Web)' },
  '9:16_STORY': { width: 1080, height: 1920, aspectRatio: '9:16', label: '9:16 Story / Reel (TikTok / Shorts)' },
};
