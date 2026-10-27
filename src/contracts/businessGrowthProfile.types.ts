/**
 * Ralion OS growth intelligence contracts, selectively copied from
 * packages/ai/src/businessGrowthProfile.service.ts (read-only source).
 * Business logic and hardcoded sample outcomes intentionally excluded.
 * Adapt in hackathon-specific adapters; do not connect to production tenant services.
 */

export interface GrowthOpportunity {
  id: string;
  title: string;
  category: 'REVENUE_EXPANSION' | 'MARKETING_ACQUISITION' | 'CUSTOMER_RETENTION' | 'OPERATIONAL_VELOCITY';
  summary: string;
  whyMariRecommends: string;
  evidence: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number; // 0.0 to 1.0
  expectedOutcome: string;
  action: {
    label: string;
    route: string;
    type: string;
    payload?: any;
  };
}

export interface GrowthRisk {
  id: string;
  title: string;
  category: 'PIPELINE_STALL' | 'AUDIENCE_ATTRITION' | 'SLA_BREACH' | 'FOLLOW_UP_GAP';
  summary: string;
  evidence: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  remedy: string;
  action: {
    label: string;
    route: string;
    type: string;
  };
}

export interface GrowthMemoryRecord {
  id: string;
  recommendation: string;
  decision: 'ACCEPTED' | 'REJECTED';
  rejectionReason?: string;
  actionTaken?: string;
  timestamp: string;
  expectedOutcome?: string;
  actualOutcome?: string;
  resultMetrics?: Record<string, any>;
  lessonsLearned: string;
}

export interface BusinessGrowthProfile {
  organizationId: string;
  businessName: string;
  industry: string;
  targetMarket: string;
  idealCustomerProfile: string;
  revenueModel: string;
  
  // Commercial & Marketing State
  activePipelineValue: number;
  activeCustomersCount: number;
  activeProspectsCount: number;
  marketingChannels: Array<{
    channel: string;
    followers: number;
    reachGrowthPct: number;
    engagementRatePct: number;
    topFormat: string;
  }>;

  // Growth Score & Explainable Drivers
  growthScore: {
    score: number;
    drivers: {
      positive: string[];
      negative: string[];
    };
    explanation: string;
  };

  // Prioritized Strategic Action
  highestImpactMove: GrowthOpportunity;
  opportunities: GrowthOpportunity[];
  risks: GrowthRisk[];

  // Growth Memory (Learning Loop)
  growthMemory: GrowthMemoryRecord[];
  
  lastEvaluatedAt: string;
  version: string;
}
