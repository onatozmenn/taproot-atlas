// types/water-intelligence.ts
// Canonical data contract for the Source-to-Tap Water Intelligence Platform.
// Resolver is the single authority. LLM is narrator only.

export type BoundaryConfidence =
  | 'verified_agency'
  | 'modeled_epa'
  | 'unverified_fallback';

export type GeoJsonGeometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'Polygon'; coordinates: [number, number][][] };

export interface DataProvenance {
  sourceDocumentUrl: string;
  reportPeriod: string;
  captureTime: string;
  sourceVersionId: string;
}

export interface QualityMetricRecord {
  parameter: string;
  reportedValue: string;
  regulatoryThreshold: string;
  complianceStatus: 'within_standard' | 'exceeds_standard' | 'monitoring_violation';
  testDate: string;
  provenance: DataProvenance;
}

export interface SdwisViolationRecord {
  violationCode: string;
  violationType: 'health_based' | 'monitoring_and_reporting' | 'other';
  contaminantName?: string;
  beginDate: string;
  endDate: string | null;
  complianceAchieved: boolean;
}

export interface SdwisComplianceProfile {
  pwsid: string;
  queryWindow: {
    startDate: string;
    endDate: string;
  };
  totalViolationsFound: number;
  records: SdwisViolationRecord[];
  echoReportUrl: string;
  dataCaptureTime: string;
  /**
   * True when no curated snapshot exists for this system yet. Consumers must
   * NOT present totalViolationsFound as a finding — point at the live ECHO
   * profile instead.
   */
  snapshotPending?: boolean;
}

/** Nearby public drinking-water point (OSM, always unverified). */
export interface NearbyDrinkingPoint {
  name: string;
  distanceM: number;
  osmUrl: string;
  /** WGS84 coordinates so the map can center on the user area, not a default. */
  lat?: number;
  lon?: number;
}

/** Reported treatment profile (descriptive facts only, never a grade). */
export interface TreatmentProfile {
  pwsid: string;
  processes: string[];
  /** e.g. "Unfiltered surface water, disinfected". Null when too thin. */
  rigor: string | null;
  dataCaptureTime: string;
}

/** SDWIS facility row: intake / well / reservoir / treatment / purchased. */
export interface SourceFacilityRecord {
  facilityName: string;
  facilityType: 'intake' | 'well' | 'reservoir' | 'treatment_plant' | 'purchased' | 'other';
  waterType?: 'surface' | 'ground' | 'unknown';
  isSource?: boolean;
  sellerPwsid?: string;
  sellerName?: string;
}

export interface SourceFacilitiesProfile {
  pwsid: string;
  facilities: SourceFacilityRecord[];
  /** Recursive seller chain, depth-capped by the loader. */
  sellerChain: Array<{ pwsid: string; systemName: string }>;
  dataCaptureTime: string;
  sourceVersionId: string;
  provenanceUrl: string;
}

/** NLDI upstream + Water Quality Portal summary (pre-treatment context only). */
export interface UpstreamSummary {
  outletLabel: string;
  upstreamCount: number;
  stationCount: number;
  characteristics: string[];
  dataCaptureTime: string;
  sourceUrl: string;
  /** Always schematic: intake coordinates are never published. */
  confidence: 'schematic';
}

/** Modeled public-supply SW/GW split (USGS water-use, never a meter reading). */
export interface WaterUseSplit {
  surfacePct: number;
  groundPct: number;
  referencePeriod: string;
  dataCaptureTime: string;
  sourceUrl: string;
  confidence: 'modeled';
}

/** Vendored conveyance (aqueduct / canal / pipeline), schematic only. */
export interface ConveyanceRecord {
  name: string;
  substance: string;
  confidence: 'schematic';
}

export interface WaterOriginSchematic {
  pwsid: string;
  systemName: string;
  boundaryType: BoundaryConfidence;
  primaryBasins: string[];
  schematicFlow: {
    type: 'FeatureCollection';
    disclaimer: string;
    features: Array<{
      type: 'Feature';
      geometry: GeoJsonGeometry;
      properties: {
        label: string;
        role: 'watershed' | 'treatment_facility' | 'distribution_zone';
        isApproximate: boolean;
      };
    }>;
  };
  regulatoryCompliance: SdwisComplianceProfile;
  latestReportedMetrics: QualityMetricRecord[];
  /** Nearest OSM drinking-water points (UNKNOWN areas only, best effort). */
  nearbyDrinkingPoints?: NearbyDrinkingPoint[];
  /** EPA source-water kind, when the system comes from the directory. */
  sourceKind?: 'groundwater' | 'surface' | 'unknown';
  /** Reported treatment profile (fixture or live, best effort). */
  treatment?: TreatmentProfile;
  /** SDWIS facility + seller chain (fixture or live, best effort, depth-capped). */
  sourceFacilities?: SourceFacilitiesProfile;
  /** Lead/copper 90th-percentile snapshots (LCR, best effort). */
  lcrMetrics?: QualityMetricRecord[];
  /** UCMR occurrence snapshots, e.g. PFAS + lithium (best effort, no MCL verdict). */
  ucmrMetrics?: QualityMetricRecord[];
  /** Six-Year Review compliance-monitoring extracts (best effort). */
  syrMetrics?: QualityMetricRecord[];
  /** NYC distribution-monitoring extracts via Socrata (best effort). */
  distributionMetrics?: QualityMetricRecord[];
  /** NLDI upstream + WQP pre-treatment context (schematic, best effort). */
  upstream?: UpstreamSummary;
  /** Modeled public-supply SW/GW split (best effort). */
  waterUse?: WaterUseSplit;
  /** Vendored large conveyances (schematic, best effort). */
  conveyances?: ConveyanceRecord[];
  /** Normalized "City, ST" asked for but outside the snapshot (empty-state path). */
  placeQuery?: string;
  disclaimer: string;
}

export interface ResolverOutput {
  schematic: WaterOriginSchematic;
  extractedFacts: {
    allowedNumbers: string[];
    allowedGluedNumbers: string[];
    allowedEntities: string[];
  };
}

export interface ValidatedApiResponse {
  narrative: {
    overview: string;
    metricsSummary: string;
    complianceNote: string;
    stewardshipNote: string;
  };
  groundTruth: WaterOriginSchematic;
  /**
   * The chat answer: short question-focused markdown (America.gov style)
   * plus context-aware follow-up questions. Written by the audited model
   * narrator when configured, otherwise by the deterministic composer.
   */
  answer?: {
    markdown: string;
    followUps: string[];
    focus: 'source' | 'quality' | 'pathway' | 'compliance' | 'general';
    author: 'llm' | 'template';
  };
  /**
   * water = full Resolver report; redirect = off-topic/smalltalk deflection
   * (America.gov-style: no opinions, back to tap-water records; the UI
   * renders a slim text card with no map or metric cards).
   */
  scope: 'water' | 'redirect';
  validationStatus: {
    passedLlmAudit: boolean;
    auditTimestamp: string;
    /** snapshot_fixture = bundled demo record; live_fetch = captured ECHO response. */
    recordSource: 'snapshot_fixture' | 'live_fetch';
    /** Which narrator produced the text: model draft or deterministic template. */
    narrator: 'llm' | 'template';
    /** JEV second-layer verdict: pass, flag (forced fallback), or skipped. */
    jev: 'pass' | 'flag' | 'skipped';
  };
}
