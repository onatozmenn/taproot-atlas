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
