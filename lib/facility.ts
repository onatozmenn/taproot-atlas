// lib/facility.ts — SDWIS facility + seller chain (descriptive, never a grade).
// Live: Envirofacts efservice WATER_SYSTEM_FACILITY/PWSID (no key, 8s timeout,
// fail-soft). Fixture: data/facility-nyc.json shape. Intake coordinates are
// never published by EPA and never stored here; routes stay schematic.
import type { SourceFacilitiesProfile, SourceFacilityRecord } from '../types/water-intelligence.js';
import { EchoError } from './echo.js';
import facilityNyc from '../data/facility-nyc.json' with { type: 'json' };

interface FacilitySnapshot {
  snapshotVersion: string;
  captureTime: string;
  provenanceUrl: string;
  pwsid: string;
  facilities: SourceFacilityRecord[];
  sellerChain: Array<{ pwsid: string; systemName: string }>;
}

const FIXTURES: Record<string, FacilitySnapshot> = {
  NY7003493: facilityNyc as unknown as FacilitySnapshot,
};

const ALLOWED_TYPES: Record<string, SourceFacilityRecord['facilityType']> = {
  IN: 'intake',
  WL: 'well',
  WE: 'well',
  RS: 'reservoir',
  TP: 'treatment_plant',
  MF: 'treatment_plant',
};

function normStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function mapFacilityType(row: Record<string, unknown>): SourceFacilityRecord['facilityType'] {
  const code = normStr(row.facility_type_code ?? row.FACILITY_TYPE_CODE).toUpperCase();
  if (code in ALLOWED_TYPES) return ALLOWED_TYPES[code];
  const name = `${normStr(row.facility_name ?? row.FACILITY_NAME)} ${normStr(row.treatment_process ?? '')}`.toUpperCase();
  if (/PURCHASE|SELLER|BOUGHT/.test(name)) return 'purchased';
  if (/INTAKE/.test(name)) return 'intake';
  if (/WELL/.test(name)) return 'well';
  if (/RESERVOIR/.test(name)) return 'reservoir';
  if (/TREATMENT|PLANT|WTP/.test(name)) return 'treatment_plant';
  return 'other';
}

function mapWaterType(row: Record<string, unknown>): SourceFacilityRecord['waterType'] {
  const code = normStr(row.water_type_code ?? row.WATER_TYPE_CODE).toUpperCase();
  if (code.startsWith('SW') || code === 'S') return 'surface';
  if (code.startsWith('GW') || code === 'G') return 'ground';
  return 'unknown';
}

/** Curated fixture, if any. No network. */
export function readFacilityFixture(pwsid: string): SourceFacilitiesProfile | null {
  const snap = FIXTURES[pwsid];
  if (!snap) return null;
  return {
    pwsid,
    facilities: snap.facilities.slice(0, 8),
    sellerChain: snap.sellerChain.slice(0, 4),
    dataCaptureTime: snap.captureTime,
    sourceVersionId: snap.snapshotVersion,
    provenanceUrl: snap.provenanceUrl,
  };
}

export interface FacilityClientOptions {
  fetchJson?: (url: string, init?: { signal: AbortSignal }) => Promise<unknown>;
  now?: () => string;
  timeoutMs?: number;
  maxRows?: number;
  maxDepth?: number;
}

/** Live pull of reported facilities for a PWSID. Fail-soft: throws EchoError. */
export async function fetchFacilities(
  pwsid: string,
  options: FacilityClientOptions = {},
): Promise<SourceFacilitiesProfile> {
  const {
    fetchJson = async (url: string, init?: { signal: AbortSignal }) => {
      const res = await fetch(url, { signal: init?.signal });
      if (!res.ok) throw new EchoError(`SDWIS fetch failed: HTTP ${res.status}`, 'bad_response');
      return (await res.json()) as unknown;
    },
    now = () => new Date().toISOString(),
    timeoutMs = 8000,
    maxRows = 200,
  } = options;

  if (!/^[A-Z]{2}[A-Z0-9]*\d[A-Z0-9]*$/.test(pwsid)) {
    throw new EchoError(`Refusing to query SDWIS with a non-PWSID value: ${pwsid}`, 'bad_response');
  }
  const url =
    `https://data.epa.gov/efservice/WATER_SYSTEM_FACILITY/PWSID/=/${encodeURIComponent(pwsid)}` +
    `/rows/0:${Math.max(1, Math.min(maxRows, 1000))}/JSON`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let raw: unknown;
  try {
    raw = await Promise.race([
      fetchJson(url, { signal: controller.signal }),
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          controller.abort();
          reject(new EchoError(`Timed out after ${timeoutMs}ms`, 'timeout'));
        }, timeoutMs),
      ),
    ]).catch((err: unknown) => {
      if ((err as Error)?.name === 'AbortError') throw new EchoError(`Timed out after ${timeoutMs}ms`, 'timeout');
      throw err;
    });
  } catch (err) {
    if (err instanceof EchoError) throw err;
    throw new EchoError(`SDWIS fetch failed: ${(err as Error).message}`, 'network');
  } finally {
    clearTimeout(timer);
  }
  if (!Array.isArray(raw)) throw new EchoError(`SDWIS response for ${pwsid} was not an array`, 'bad_response');

  const facilities: SourceFacilityRecord[] = [];
  const sellers = new Map<string, string>();
  for (const r of raw as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object') continue;
    const facilityName = normStr(r.facility_name ?? r.FACILITY_NAME ?? r.facility_id ?? r.FACILITY_ID);
    if (!facilityName) continue;
    const sellerPwsid = normStr(r.seller_pwsid ?? r.SELLER_PWSID);
    const sellerName = normStr(r.seller_pws_name ?? r.SELLER_PWS_NAME);
    if (sellerPwsid && /^[A-Z]{2}[A-Z0-9]*\d[A-Z0-9]*$/i.test(sellerPwsid)) {
      sellers.set(sellerPwsid.toUpperCase(), sellerName || sellerPwsid.toUpperCase());
    }
    facilities.push({
      facilityName: facilityName.toUpperCase().slice(0, 80),
      facilityType: mapFacilityType(r),
      waterType: mapWaterType(r),
      isSource: normStr(r.is_source_ind ?? r.IS_SOURCE_IND).toUpperCase() === 'Y' || undefined,
      ...(sellerPwsid ? { sellerPwsid: sellerPwsid.toUpperCase(), ...(sellerName ? { sellerName } : {}) } : {}),
    });
    if (facilities.length >= 8) break;
  }
  return {
    pwsid,
    facilities,
    sellerChain: [...sellers.entries()].slice(0, 4).map(([spwsid, systemName]) => ({ pwsid: spwsid, systemName })),
    dataCaptureTime: now(),
    sourceVersionId: `efservice-facility-${now().slice(0, 10)}`,
    provenanceUrl: `https://data.epa.gov/efservice/WATER_SYSTEM_FACILITY/PWSID/=/${encodeURIComponent(pwsid)}/JSON`,
  };
}
