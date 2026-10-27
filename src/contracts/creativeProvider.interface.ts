/**
 * RALION OS — CREATIVE PROVIDER INTERFACE & CONTRACTS
 *
 * Provider-agnostic abstraction layer decoupling Ralion core from
 * specific upstream AI inference providers (FLUX, CogVideoX, Pollinations, OpenAI, etc.).
 */

export type CreativeAssetType = 'POSTER_IMAGE' | 'VIDEO_REEL';

export type CreativeLifecycleState =
  | 'QUEUED'
  | 'GENERATING'
  | 'VALIDATING'
  | 'STORING'
  | 'COMPLETED'
  | 'FAILED';

export interface CreativeProviderRequest {
  type: CreativeAssetType;
  prompt: string;
  style?: string;
  format?: string;
  width?: number;
  height?: number;
  seed?: number;
  timeoutMs?: number;
}

export interface CreativeProviderResult {
  buffer: Buffer;
  mimeType: string;
  providerName: string;
  durationSeconds?: number;
  generationTimeMs: number;
}

export interface CreativeProvider {
  readonly name: string;
  readonly supportedTypes: CreativeAssetType[];
  generate(request: CreativeProviderRequest): Promise<CreativeProviderResult>;
}

export interface SocialHandoffContract {
  assetId: string;
  organizationId: string;
  workspaceId: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  title: string;
  caption: string;
  campaign: string;
  platform: string;
  cta: string;
}

export interface MariCreativeReceipt {
  assetId: string;
  organizationId: string;
  workspaceId: string;
  assetType: CreativeAssetType;
  mediaUrl: string;
  publicUrl: string;
  storagePath: string;
  mimeType: string;
  sha256?: string;
  status: 'COMPLETED';
  thumbnailUrl: string;
  title: string;
  prompt: string;
  providerStatus: 'COMPLETED';
  generationTime: number;
  validationStatus: 'PASSED';
  lifecycleState: 'COMPLETED';
  mariResponse: string;
  socialContract: SocialHandoffContract;
}

export interface MariLearningLoopRecord {
  loopId: string;
  timestamp: string;
  organizationId: string;
  sourceIntelligence: {
    channel: 'facebook' | 'linkedin' | 'instagram';
    pageName: string;
    metricSummary: string;
    insight: string;
  };
  recommendation: {
    actionType: string;
    title: string;
    suggestedFormat: string;
    strategicRationale: string;
  };
  creative: {
    assetId: string;
    assetType: CreativeAssetType;
    mediaUrl: string;
    prompt: string;
  };
  publication: {
    platform: string;
    publishedAt: string;
    postId: string;
    status: 'PUBLISHED' | 'SCHEDULED';
  };
  performance?: {
    reach: number;
    engagementRatePct: number;
    clicks: number;
  };
  learning: string;
}
