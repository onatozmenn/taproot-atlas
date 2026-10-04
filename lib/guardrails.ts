// lib/guardrails.ts
// English-only deterministic audit for LLM narrator output.
// Blocks health certification, coordinate leaks, numeric/entity hallucinations,
// and non-English output. Falls back to a deterministic template on failure.
import type {
  QualityMetricRecord,
  WaterOriginSchematic,
  ResolverOutput,
} from '../types/water-intelligence.js';

export interface AuditResult {
  isValid: boolean;
  violations: string[];
}

export function extractNormalizedNumbers(text: string): string[] {
  const matches = text.match(/\b\d+(?:\.\d+)?\b/g) || [];
  return matches;
}

export function buildResolverFacts(
  schematic: WaterOriginSchematic
): ResolverOutput['extractedFacts'] {
  const rawSources: string[] = [
    schematic.regulatoryCompliance.queryWindow.startDate,
    schematic.regulatoryCompliance.queryWindow.endDate,
    schematic.regulatoryCompliance.dataCaptureTime,
    String(schematic.regulatoryCompliance.totalViolationsFound),
    schematic.pwsid,
  ];

  const allowedEntities: string[] = [
    schematic.pwsid.toLowerCase(),
    schematic.systemName.toLowerCase(),
    ...schematic.primaryBasins.map((b: string) => b.toLowerCase()),
  ];

  for (const m of schematic.latestReportedMetrics) {
    rawSources.push(m.reportedValue);
    rawSources.push(m.regulatoryThreshold);
    rawSources.push(m.testDate);
    rawSources.push(m.provenance.reportPeriod);
    rawSources.push(m.provenance.captureTime);
    rawSources.push(m.provenance.sourceVersionId);
    allowedEntities.push(m.parameter.toLowerCase());
  }

  for (const f of schematic.schematicFlow.features) {
    allowedEntities.push(f.properties.label.toLowerCase());
  }

  const allowedNumbers = Array.from(
    new Set(rawSources.flatMap((text) => extractNormalizedNumbers(text)))
  );

  return {
    allowedNumbers,
    allowedEntities: Array.from(new Set(allowedEntities)),
  };
}

const APPROVED_SENTENCE_EXCEPTIONS: RegExp[] = [
  /safe drinking water act/i,
  /standard for safe drinking water/i,
  /within (?:safe|allowable|acceptable) limits/i,
  /compliance with safe drinking water/i,
  /clean water act/i,
];

const STRICT_ASSERTION_TERMS = [
  'drinkable',
  'potable',
  'guaranteed clean',
  'pure',
  'certified safe',
  'harmless',
  '100% clean',
];

const SENSITIVE_TERMS = ['safe', 'clean', 'healthy'];

const ENTITY_PATTERNS = [
  /([\w\s-]+?)\s+(?:basin|reservoir|watershed|facility|treatment plant|aqueduct)\b/gi,
  /(?:level of|concentration of|amount of)\s+([\w\s-]+)\b/gi,
];

function splitIntoSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean);
}

export function auditLlmNarrative(
  narrativeText: string,
  resolverOutput: ResolverOutput
): AuditResult {
  const violations: string[] = [];

  if (/[^\x00-\x7F]/.test(narrativeText)) {
    violations.push(
      'Language violation: Non-ASCII characters detected. The response must be strictly in standard English.'
    );
  }

  for (const term of STRICT_ASSERTION_TERMS) {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    if (regex.test(narrativeText)) {
      violations.push(
        `Forbidden unconditional assertion: "${term}". Use regulatory compliance phrasing instead.`
      );
    }
  }

  const sentences = splitIntoSentences(narrativeText);
  for (const sentence of sentences) {
    for (const term of SENSITIVE_TERMS) {
      const regex = new RegExp(`\\b${term}\\b`, 'i');
      if (regex.test(sentence)) {
        const isApproved = APPROVED_SENTENCE_EXCEPTIONS.some((ex) =>
          ex.test(sentence)
        );
        if (!isApproved) {
          violations.push(
            `Unverified qualitative claim: "${term}" used outside statutory exceptions in: "${sentence.trim()}"`
          );
        }
      }
    }
  }

  const coordinatePattern =
    /\b[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)\b/;
  if (coordinatePattern.test(narrativeText)) {
    violations.push(
      'Direct geographic coordinate pattern detected in narrative. Map geometries must remain Resolver-exclusive.'
    );
  }

  const extractedNumbers = extractNormalizedNumbers(narrativeText);
  const allowedNumbersSet = new Set(resolverOutput.extractedFacts.allowedNumbers);
  for (const num of extractedNumbers) {
    if (!allowedNumbersSet.has(num)) {
      violations.push(
        `Unauthorized numeric value: "${num}". Not present in ground-truth facts.`
      );
    }
  }

  const allowedEntitiesSet: Set<string> = new Set(
    resolverOutput.extractedFacts.allowedEntities.map((e: string) =>
      e.toLowerCase().trim()
    )
  );

  for (const pattern of ENTITY_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(narrativeText)) !== null) {
      if (match[1]) {
        const candidate = match[1].toLowerCase().trim();
        if (['the', 'a', 'an', 'this', 'water'].includes(candidate)) continue;
        const allowedList: string[] = Array.from(allowedEntitiesSet);
        const exists = allowedList.some(
          (allowed) =>
            allowed === candidate ||
            allowed.includes(candidate) ||
            candidate.includes(allowed)
        );
        if (!exists) {
          violations.push(
            `Unverified water entity or parameter claimed: "${candidate}".`
          );
        }
      }
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}
