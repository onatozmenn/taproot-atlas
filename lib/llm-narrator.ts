// lib/llm-narrator.ts — OpenAI-compatible narrator adapter.
// Builds a facts-only prompt (geometries EXCLUDED so coordinates can never be
// echoed) and parses the model's JSON into a Narrative. Any failure → null,
// and the pipeline falls back to the deterministic template. Output is ALWAYS
// re-audited; this adapter never bypasses guardrails.
import type { WaterOriginSchematic } from '../types/water-intelligence.js';
import type { Narrative } from './narrator.js';
import { WATER_INTELLIGENCE_SYSTEM_PROMPT } from '../prompts/system.js';
import { profileFacts } from './profile.js';

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 'chat-completions' (OpenAI) or 'responses' (Zen GPT endpoint). */
  api?: 'chat-completions' | 'responses';
  /** Reasoning effort for gpt-5/6/o-series models (default 'low'). */
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
}

export interface LlmFetchInit {
  method: string;
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}

export type LlmFetch = (url: string, init: LlmFetchInit) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text?: () => Promise<string>;
}>;

/** Ground-truth facts plus the user question. No coordinates, no PWSID digits beyond the ID itself. */
export function buildFactsMessage(schematic: WaterOriginSchematic, question = ''): string {
  const slim = (m: { parameter: string; reportedValue: string; regulatoryThreshold: string; complianceStatus: string; testDate: string; provenance: { reportPeriod: string } }) => ({
    parameter: m.parameter,
    reportedValue: m.reportedValue,
    regulatoryThreshold: m.regulatoryThreshold,
    complianceStatus: m.complianceStatus,
    testDate: m.testDate,
    reportPeriod: m.provenance.reportPeriod,
  });
  const facts = {
    systemName: schematic.systemName,
    pwsid: schematic.pwsid,
    boundaryType: schematic.boundaryType,
    primaryBasins: schematic.primaryBasins,
    sourceKind: schematic.sourceKind ?? null,
    flowLabels: schematic.schematicFlow.features.map((f) => ({
      label: f.properties.label,
      role: f.properties.role,
    })),
    facilities: (schematic.sourceFacilities?.facilities ?? []).map((f) => ({
      facilityName: f.facilityName,
      facilityType: f.facilityType,
      waterType: f.waterType ?? null,
    })),
    sellerChain: schematic.sourceFacilities?.sellerChain ?? [],
    conveyances: (schematic.conveyances ?? []).map((c) => c.name),
    metrics: schematic.latestReportedMetrics.map(slim),
    lcr: (schematic.lcrMetrics ?? []).map(slim),
    ucmr: (schematic.ucmrMetrics ?? []).map(slim),
    syr: (schematic.syrMetrics ?? []).map(slim),
    distribution: (schematic.distributionMetrics ?? []).map(slim),
    upstream: schematic.upstream
      ? {
          outletLabel: schematic.upstream.outletLabel,
          upstreamCount: schematic.upstream.upstreamCount,
          stationCount: schematic.upstream.stationCount,
          characteristics: schematic.upstream.characteristics,
        }
      : null,
    waterUse: schematic.waterUse
      ? {
          surfacePct: schematic.waterUse.surfacePct,
          groundPct: schematic.waterUse.groundPct,
          referencePeriod: schematic.waterUse.referencePeriod,
        }
      : null,
    treatmentProcesses: schematic.treatment?.processes ?? [],
    treatmentProfile: schematic.treatment?.rigor ?? null,
    violationRecords: schematic.regulatoryCompliance.records.slice(0, 8).map((r) => ({
      type: r.violationType,
      contaminant: r.contaminantName ?? null,
      beginDate: r.beginDate,
      returnedToCompliance: r.complianceAchieved,
    })),
    compliancePending: schematic.regulatoryCompliance.snapshotPending === true,
    queryWindow: schematic.regulatoryCompliance.queryWindow,
    totalViolationsFound: schematic.regulatoryCompliance.totalViolationsFound,
    dataCaptureTime: schematic.regulatoryCompliance.dataCaptureTime,
    epaProfile: schematic.profile ? profileFacts(schematic.profile) : null,
  };
  const q = (question ?? '').slice(0, 500).trim();
  const questionLine = q.length > 0 ? `User question (answer this, nothing else): ${q}\n\n` : '';
  return (
    `${questionLine}` +
    `Resolver facts (sole ground truth; use nothing else):\n${JSON.stringify(facts)}\n\n` +
    `Respond ONLY with a JSON object shaped exactly like ` +
    `{"answer": string, "overview": string, "metricsSummary": string, "complianceNote": string, "stewardshipNote": string}. ` +
    `"answer" is the chat reply the user reads: Markdown, 15 to 50 words, at most 2 sentences, no bullets. ` +
    `The first sentence answers the exact question and bolds the key number or verdict; the second, only if needed, adds the one fact that qualifies it. ` +
    `Never mention anything the user did not ask about: the interface already draws the chart, map and records beside your words. ` +
    `If the facts do not contain what was asked (for example no lead result), say so plainly in the first sentence and name what the records do cover. ` +
    `No headings, no tables, no links, no closing pleasantries.`
  );
}

function isNarrative(v: unknown): v is Narrative {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.overview === 'string' &&
    typeof o.metricsSummary === 'string' &&
    typeof o.complianceNote === 'string' &&
    typeof o.stewardshipNote === 'string' &&
    (o.answer === undefined || typeof o.answer === 'string')
  );
}

function stripFences(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (m ? m[1] : text).trim();
}

function extractResponsesText(data: unknown): string | null {
  const out = (data as { output?: unknown }).output;
  if (!Array.isArray(out)) return null;
  const texts: string[] = [];
  for (const item of out) {
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const p = part as { type?: string; text?: unknown };
      if (p.type === 'output_text' && typeof p.text === 'string') texts.push(p.text);
    }
  }
  const joined = texts.join('').trim();
  return joined.length > 0 ? joined : null;
}

function extractChatText(data: unknown): string | null {
  const d = data as { choices?: Array<{ message?: { content?: string } }> };
  const content = d.choices?.[0]?.message?.content;
  return content && content.length > 0 ? content : null;
}

export async function llmNarrate(
  schematic: WaterOriginSchematic,
  config: LlmConfig,
  fetchFn: LlmFetch = fetch as unknown as LlmFetch,
  timeoutMs = 20000,
  question = '',
): Promise<Narrative | null> {
  if (!config.apiKey || !config.model) return null;
  const api = config.api ?? 'chat-completions';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const root = config.baseUrl.replace(/\/$/, '');
    const url = api === 'responses' ? `${root}/responses` : `${root}/chat/completions`;
    // Reasoning models (gpt-5.x, gpt-6.x, o-series) reject `temperature`
    // while reasoning is on and spend output tokens on reasoning first.
    // Sending temperature: 0 to gpt-6-luna was a silent 400 -> template.
    const reasoning = isReasoningModel(config.model);
    const sampling = reasoning ? {} : { temperature: 0 };
    const body =
      api === 'responses'
        ? {
            model: config.model,
            ...sampling,
            ...(reasoning ? { reasoning: { effort: config.reasoningEffort ?? 'low' } } : {}),
            max_output_tokens: reasoning ? 4000 : 1200,
            input: [
              { role: 'system', content: WATER_INTELLIGENCE_SYSTEM_PROMPT },
              { role: 'user', content: buildFactsMessage(schematic, question) },
            ],
          }
        : {
            model: config.model,
            ...sampling,
            ...(reasoning
              ? { reasoning_effort: config.reasoningEffort ?? 'low', max_completion_tokens: 4000 }
              : { max_tokens: 1200 }),
            messages: [
              { role: 'system', content: WATER_INTELLIGENCE_SYSTEM_PROMPT },
              { role: 'user', content: buildFactsMessage(schematic, question) },
            ],
          };
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      // Surface the provider's reason in the function logs instead of
      // silently falling back to the template.
      let detail = '';
      try {
        detail = res.text ? (await res.text()).slice(0, 300) : '';
      } catch {
        /* ignore */
      }
      console.error(`[llm-narrator] ${config.model} HTTP ${res.status}: ${detail}`);
      return null;
    }
    const data: unknown = await res.json();
    const content = api === 'responses' ? extractResponsesText(data) : extractChatText(data);
    if (!content) {
      console.error(`[llm-narrator] ${config.model} returned no text`);
      return null;
    }
    const parsed: unknown = JSON.parse(stripFences(content));
    if (!isNarrative(parsed)) console.error(`[llm-narrator] ${config.model} output is not a narrative object`);
    return isNarrative(parsed) ? parsed : null;
  } catch (err) {
    console.error(`[llm-narrator] ${config.model} failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** gpt-5.x / gpt-6.x / o-series reasoning models: no temperature, reasoning effort instead. */
export function isReasoningModel(model: string): boolean {
  return /^(gpt-5|gpt-6|o\d)/i.test(model.replace(/^openai\//, ''));
}
