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
  disclaimer: string;
}

export interface ResolverOutput {
  schematic: WaterOriginSchematic;
  extractedFacts: {
    allowedNumbers: string[];
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
  validationStatus: {
    passedLlmAudit: boolean;
    auditTimestamp: string;
    /** snapshot_fixture = bundled demo record; live_fetch = captured ECHO response. */
    recordSource: 'snapshot_fixture' | 'live_fetch';
  };
}
