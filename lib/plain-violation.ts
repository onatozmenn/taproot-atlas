// lib/plain-violation.ts — SDWIS violation codes in words a resident reads.
// The kind groups every violation into one of four stories the UI can draw:
//   limit      water measured above a federal limit (MCL / action level)
//   treatment  a required treatment step fell short (turbidity, filtration)
//   testing    a sample or test was missed or late
//   notice     the public, or EPA, was not told on time

export type ViolationKind = 'limit' | 'treatment' | 'testing' | 'notice';

export interface PlainViolation {
  title: string;
  kind: ViolationKind;
}

const lc = (s: string | null | undefined) => (s ?? '').trim();

function contaminantWords(c: string): string {
  const x = c.toLowerCase();
  if (/coliform|e\.? ?coli/.test(x)) return /e\.? ?coli/.test(x) ? 'E. coli' : 'bacteria';
  if (/tthm|trihalomethane/.test(x)) return 'disinfection byproducts (TTHM)';
  if (/haa5|haloacetic/.test(x)) return 'disinfection byproducts (HAA5)';
  if (/radium|uranium|alpha|beta/.test(x)) return 'radioactivity';
  if (/lead and copper|^lead/.test(x)) return 'lead';
  return x.replace(/\s*\(.*?\)\s*/g, ' ').trim();
}

export function plainViolation(v: { name?: string | null; contaminant?: string | null; rule?: string | null; healthBased?: boolean; category?: string | null }): PlainViolation {
  const n = lc(v.name).toLowerCase();
  const c = lc(v.contaminant);
  const cw = c ? contaminantWords(c) : '';
  if (/maximum contaminant level/.test(n)) {
    if (/e\. ?coli/.test(n)) return { title: 'E. coli found in the water', kind: 'limit' };
    if (/tcr|acute/.test(n)) return { title: 'Bacteria found in more samples than allowed', kind: 'limit' };
    return { title: `${cw ? cw.charAt(0).toUpperCase() + cw.slice(1) : 'A contaminant'} above the federal limit`, kind: 'limit' };
  }
  if (/turbidity exceed/.test(n)) return { title: 'Water too cloudy after filtering', kind: 'treatment' };
  if (/failure to filter/.test(n)) return { title: 'Required filtration not in place', kind: 'treatment' };
  if (/precursor removal/.test(n)) return { title: 'Too little organic matter removed before disinfection', kind: 'treatment' };
  if (/failure to address deficiency/.test(n)) return { title: 'Inspection problem not fixed in time', kind: 'treatment' };
  if (/lsl inventory/.test(n)) return { title: 'Lead pipe inventory not filed', kind: 'notice' };
  if (/occt|sowt|wqp entry|corrosion/.test(n)) return { title: 'Lead corrosion control fell short', kind: 'treatment' };
  if (/public education/.test(n)) return { title: 'Lead education not delivered to residents', kind: 'notice' };
  if (/treatment technique/.test(n)) {
    if (/coliform|e\. ?coli/i.test(c)) return { title: 'Bacteria follow-up not completed', kind: 'treatment' };
    return { title: 'Required treatment step fell short', kind: 'treatment' };
  }
  if (/consumer confidence/.test(n)) return { title: 'Annual water quality report not sent', kind: 'notice' };
  if (/lead consumer notice|notification, known or potential lsl/.test(n)) return { title: 'Homes not told their lead results', kind: 'notice' };
  if (/public notification|notification, public/.test(n)) return { title: 'Residents not notified on time', kind: 'notice' };
  if (/lsl reporting|operations report|failure submit|plan rpt/.test(n)) return { title: 'Report to regulators late or missing', kind: 'notice' };
  if (/lcr|pb and cu|lead|water quality parameter/.test(n)) return { title: 'Lead and copper testing missed', kind: 'testing' };
  if (/turbidity/.test(n)) return { title: 'Cloudiness testing missed', kind: 'testing' };
  if (/tcr|rtcr|coliform/.test(n)) return { title: 'Bacteria testing missed', kind: 'testing' };
  if (/dbp|idse/.test(n)) return { title: `${cw && !/chlorine/i.test(cw) ? `${cw.charAt(0).toUpperCase() + cw.slice(1)} testing` : 'Disinfection testing'} missed`, kind: 'testing' };
  if (/source water|lt2|gwr/.test(n)) return { title: 'Source water testing missed', kind: 'testing' };
  if (/monitoring|m\/r|sampl|assessment/.test(n)) return { title: `${cw ? cw.charAt(0).toUpperCase() + cw.slice(1) : 'Required'} testing missed`, kind: 'testing' };
  if (v.healthBased) return { title: `${cw ? cw.charAt(0).toUpperCase() + cw.slice(1) : 'Health-based'} violation`, kind: 'limit' };
  return { title: v.name ?? (cw ? `${cw} violation` : 'Violation'), kind: 'notice' };
}
