#!/usr/bin/env python3
"""Build-time vendor: EPA ECHO SDWA bulk download -> rich per-system profiles.

Input:  SDWA_latest_downloads.zip (https://echo.epa.gov/files/echodownloads/SDWA_latest_downloads.zip)
        + Envirofacts TREATMENT rows fetched live per PWSID (data.epa.gov/efservice)
Output: data/sdwis-profiles.json
  systems[PWSID] = {
    system:   name, type, owner, population, connections, primarySource,
              wholesaler, contact{org, phone, email, address}, sourceWaterProtection,
    areas:    counties / cities / zips served,
    serviceAreas: [descriptions],
    facilities: {counts by type, sources[], plants[], purchasedFrom[]},
    treatment: [{process, objective, facility}],
    lead:     [{period, pb90 mg/L}], copper: [...],
    violations: [{id, code, name, category, contaminant, rule, healthBased,
                  begin, end, status, measure, unit, mcl, enforcement[]}],
    visits:   [{date, reason, evals{}}]  (latest 10)
  }
Rules: official EPA files only; codes decoded with SDWA_REF_CODE_VALUES; no
invented values; empty arrays are real findings for the quarter captured.
Usage: python scripts/build-sdwis-profiles.py <zip> <pwsid-list> <out.json>
"""
import sys, zipfile, csv, io, json, datetime, urllib.request, time
from collections import defaultdict, Counter

csv.field_size_limit(50_000_000)

def rows(z, name, pw):
    with z.open(name) as raw:
        txt = io.TextIOWrapper(raw, encoding='latin-1', newline='')
        rd = csv.reader(txt)
        hdr = next(rd); ix = {h: i for i, h in enumerate(hdr)}
        ip = ix['PWSID'] if 'PWSID' in ix else None
        for r in rd:
            if ip is not None and (len(r) <= ip or r[ip] not in pw):
                continue
            yield {h: r[i] if i < len(r) else '' for h, i in ix.items()}

def d(s):
    s = (s or '').strip()
    if not s: return None
    # formats: 2018-12-31, 12/31/2018, 31-DEC-18
    if '/' in s:
        try:
            m, dd, y = s.split(' ')[0].split('/'); return f"{int(y):04d}-{int(m):02d}-{int(dd):02d}"
        except Exception: return s
    if len(s) >= 9 and s[2] == '-' and s[6] == '-':
        mon = 'JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split().index(s[3:6].upper()) + 1
        y = int(s[7:9]); y += 2000 if y < 70 else 1900
        return f"{y:04d}-{mon:02d}-{int(s[:2]):02d}"
    return s[:10]

def fetch_treatment(pwsid):
    url = f'https://data.epa.gov/efservice/TREATMENT/PWSID/{pwsid}/JSON'
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return json.load(r)
        except Exception:
            time.sleep(2 * (attempt + 1))
    return None

TREATMENT_CSV = None

def main():
    global TREATMENT_CSV
    args = sys.argv[1:]
    if '--treatment' in args:
        i = args.index('--treatment'); TREATMENT_CSV = args[i + 1]; del args[i:i + 2]
    shard = '--shard' in args
    if shard: args.remove('--shard')
    zpath, listfile, out = args
    pw = set(open(listfile).read().split())
    z = zipfile.ZipFile(zpath)
    ref = defaultdict(dict)
    for r in rows(z, 'SDWA_REF_CODE_VALUES.csv', None):
        ref[r['VALUE_TYPE']][r['VALUE_CODE']] = r['VALUE_DESCRIPTION']
    def dec(t, c):
        c = (c or '').strip()
        return ref.get(t, {}).get(c, c) if c else None

    S = {p: {'system': None, 'areas': {'counties': [], 'cities': [], 'zips': []}, 'serviceAreas': [],
             'facilities': {}, 'treatment': [], 'lead': [], 'copper': [], 'violations': [], 'visits': []} for p in pw}

    for r in rows(z, 'SDWA_PUB_WATER_SYSTEMS.csv', pw):
        p = r['PWSID']
        S[p]['system'] = {
            'name': r['PWS_NAME'].title(),
            'type': dec('PWS_TYPE_CODE', r['PWS_TYPE_CODE']),
            'activity': dec('ACTIVITY_CODE', r['PWS_ACTIVITY_CODE']),
            'owner': dec('OWNER_TYPE_CODE', r['OWNER_TYPE_CODE']),
            'population': int(r['POPULATION_SERVED_COUNT'] or 0) or None,
            'connections': int(r['SERVICE_CONNECTIONS_COUNT'] or 0) or None,
            'primarySource': dec('PRIMARY_SOURCE_CODE', r['PRIMARY_SOURCE_CODE']),
            'primarySourceCode': r['PRIMARY_SOURCE_CODE'],
            'wholesaler': r['IS_WHOLESALER_IND'] == 'Y',
            'state': r['STATE_CODE'] or r['PRIMACY_AGENCY_CODE'],
            'epaRegion': r['EPA_REGION'],
            'sourceWaterProtection': r['SOURCE_WATER_PROTECTION_CODE'] == 'Y',
            'sourceWaterProtectionSince': d(r['SOURCE_PROTECTION_BEGIN_DATE']),
            'outstandingPerformer': r['OUTSTANDING_PERFORMER'] or None,
            'contact': {
                'phone': r['PHONE_NUMBER'] or None,
                'address': ', '.join(x for x in [r['ADDRESS_LINE1'], r['ADDRESS_LINE2'], r['CITY_NAME'].title(), r['STATE_CODE'], r['ZIP_CODE']] if x) or None,
            },
            'lastReported': d(r['LAST_REPORTED_DATE']),
            'quarter': r['SUBMISSIONYEARQUARTER'],
        }

    for r in rows(z, 'SDWA_GEOGRAPHIC_AREAS.csv', pw):
        a = S[r['PWSID']]['areas']
        if r['COUNTY_SERVED'] and r['COUNTY_SERVED'] not in a['counties']: a['counties'].append(r['COUNTY_SERVED'])
        if r['CITY_SERVED'] and r['CITY_SERVED'].title() not in a['cities']: a['cities'].append(r['CITY_SERVED'].title())
        if r['ZIP_CODE_SERVED'] and r['ZIP_CODE_SERVED'] not in a['zips']: a['zips'].append(r['ZIP_CODE_SERVED'])

    for r in rows(z, 'SDWA_SERVICE_AREAS.csv', pw):
        v = dec('SERVICE_AREA_TYPE_CODE', r['SERVICE_AREA_TYPE_CODE'])
        if v and v not in S[r['PWSID']]['serviceAreas']: S[r['PWSID']]['serviceAreas'].append(v)

    fac = defaultdict(list)
    for r in rows(z, 'SDWA_FACILITIES.csv', pw):
        fac[r['PWSID']].append(r)
    fac_names = {}
    for p, fs in fac.items():
        active = [f for f in fs if f['FACILITY_ACTIVITY_CODE'] == 'A']
        cnt = Counter(dec('FACILITY_TYPE_CODE', f['FACILITY_TYPE_CODE']) for f in active)
        sources, plants, bought = [], [], []
        for f in active:
            fac_names[(p, f['FACILITY_ID'])] = f['FACILITY_NAME'].title()
            t = f['FACILITY_TYPE_CODE']
            if f['IS_SOURCE_IND'] == 'Y' and t not in ('CC',):
                sources.append({'name': f['FACILITY_NAME'].title(), 'type': dec('FACILITY_TYPE_CODE', t),
                                'water': dec('WATER_TYPE_CODE', f['WATER_TYPE_CODE']),
                                'availability': dec('AVAILABILITY_CODE', f['AVAILABILITY_CODE']),
                                'filtration': dec('FILTRATION_STATUS_CODE', f['FILTRATION_STATUS_CODE'])})
            if t == 'TP':
                plants.append(f['FACILITY_NAME'].title())
            if f['SELLER_PWSID']:
                bought.append({'pwsid': f['SELLER_PWSID'], 'name': (f['SELLER_PWS_NAME'] or '').title(),
                               'treated': dec('SELLER_TREATMENT_CODE', f['SELLER_TREATMENT_CODE'])})
        uniq = {b['pwsid']: b for b in bought}
        S[p]['facilities'] = {'activeCount': len(active), 'byType': dict(cnt.most_common()),
                              'sources': sources[:40], 'sourceCount': len(sources),
                              'plants': sorted(set(plants))[:40], 'purchasedFrom': list(uniq.values())}

    # Lead & copper: 90th percentile summaries per monitoring period
    lcr = defaultdict(dict)
    for r in rows(z, 'SDWA_LCR_SAMPLES.csv', pw):
        c = r['CONTAMINANT_CODE']
        if c not in ('PB90', 'CU90') or not r['SAMPLE_MEASURE']: continue
        key = (r['PWSID'], c, r['SAMPLE_ID'])
        try: v = float(r['SAMPLE_MEASURE'])
        except ValueError: continue
        lcr[key] = {'start': d(r['SAMPLING_START_DATE']), 'end': d(r['SAMPLING_END_DATE']), 'value': v,
                    'unit': (r['UNIT_OF_MEASURE'] or 'mg/L')}
    for (p, c, _), v in lcr.items():
        S[p]['lead' if c == 'PB90' else 'copper'].append(v)
    for p in S:
        for k in ('lead', 'copper'):
            S[p][k].sort(key=lambda x: x['end'] or '')

    viol = {}
    for r in rows(z, 'SDWA_VIOLATIONS_ENFORCEMENT.csv', pw):
        vid = (r['PWSID'], r['VIOLATION_ID'])
        v = viol.get(vid)
        if v is None:
            v = viol[vid] = {
                'id': r['VIOLATION_ID'], 'code': r['VIOLATION_CODE'],
                'name': dec('VIOLATION_CODE', r['VIOLATION_CODE']),
                'category': dec('VIOLATION_CATEGORY_CODE', r['VIOLATION_CATEGORY_CODE']),
                'categoryCode': r['VIOLATION_CATEGORY_CODE'],
                'contaminant': dec('CONTAMINANT_CODE', r['CONTAMINANT_CODE']),
                'rule': dec('RULE_CODE', r['RULE_CODE']),
                'healthBased': r['IS_HEALTH_BASED_IND'] == 'Y',
                'begin': d(r['COMPL_PER_BEGIN_DATE']), 'end': d(r['COMPL_PER_END_DATE']),
                'returnedToCompliance': d(r['CALCULATED_RTC_DATE']),
                'status': r['VIOLATION_STATUS'] or None,
                'measure': r['VIOL_MEASURE'] or None, 'unit': r['UNIT_OF_MEASURE'] or None,
                'federalMcl': r['FEDERAL_MCL'] or None,
                'notificationTier': r['PUBLIC_NOTIFICATION_TIER'] or None,
                'facility': fac_names.get((r['PWSID'], r['FACILITY_ID'])) if r['FACILITY_ID'] else None,
                'enforcement': [],
            }
        if r['ENFORCEMENT_ID'] and len(v['enforcement']) < 6:
            e = {'date': d(r['ENFORCEMENT_DATE']), 'action': dec('ENFORCEMENT_ACTION_TYPE_CODE', r['ENFORCEMENT_ACTION_TYPE_CODE'])}
            if e not in v['enforcement']: v['enforcement'].append(e)
    for (p, _), v in viol.items():
        S[p]['violations'].append(v)
    for p in S:
        S[p]['violationTotal'] = len(S[p]['violations'])
        S[p]['violationHealthTotal'] = sum(1 for v in S[p]['violations'] if v['healthBased'])
        S[p]['violations'].sort(key=lambda v: v['begin'] or '', reverse=True)
        S[p]['violations'] = S[p]['violations'][:60]

    vis = defaultdict(list)
    EV = ['MANAGEMENT_OPS', 'SOURCE_WATER', 'SECURITY', 'PUMPS', 'COMPLIANCE', 'DATA_VERIFICATION', 'TREATMENT', 'FINISHED_WATER_STOR', 'DISTRIBUTION', 'FINANCIAL']
    for r in rows(z, 'SDWA_SITE_VISITS.csv', pw):
        ev = {k.lower(): r[k + '_EVAL_CODE'] for k in EV if r.get(k + '_EVAL_CODE')}
        vis[r['PWSID']].append({'date': d(r['VISIT_DATE']), 'reason': dec('VISIT_REASON_CODE', r['VISIT_REASON_CODE']), 'evals': ev})
    eval_legend = ref.get('SITE_VISIT_EVAL_TYPE_CODE', {})
    for p, vs in vis.items():
        vs.sort(key=lambda x: x['date'] or '', reverse=True)
        S[p]['visits'] = vs[:10]
        S[p]['visitCount'] = len(vs)

    tp_desc = ref.get('TREATMENT_PROCESS_CODE', {}); to_desc = ref.get('TREATMENT_OBJECTIVE_CODE', {})
    treat_rows = defaultdict(list)
    if TREATMENT_CSV:
        with open(TREATMENT_CSV, encoding='latin-1', newline='') as f:
            for row in csv.DictReader(f):
                if row['pwsid'] in pw:
                    treat_rows[row['pwsid']].append(row)
    for p in sorted(pw):
        if TREATMENT_CSV:
            t = treat_rows.get(p, [])
        else:
            t = fetch_treatment(p)
            if t is None:
                S[p]['treatment'] = None
                continue
        seen = set(); out_t = []
        for row in t:
            proc = tp_desc.get(row.get('treatment_process_code') or '', None) or (row.get('comments_text') or '').title()
            obj = to_desc.get(row.get('treatment_objective_code') or '', row.get('treatment_objective_code'))
            key = (proc, obj)
            if not proc or key in seen: continue
            seen.add(key)
            out_t.append({'process': proc, 'objective': obj})
        S[p]['treatment'] = out_t

    snap = {
        'snapshotVersion': 'sdwis-profiles-' + datetime.date.today().isoformat() + '-v1',
        'captureTime': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'provenanceNote': 'Built from the EPA ECHO SDWA quarterly bulk download (SDWIS federal data) with treatment processes from Envirofacts. Codes decoded with SDWA_REF_CODE_VALUES. Lead/copper values are 90th-percentile summaries reported by the system for each monitoring period.',
        'sources': {
            'echoBulk': 'https://echo.epa.gov/files/echodownloads/SDWA_latest_downloads.zip',
            'treatment': 'https://data.epa.gov/efservice/TREATMENT',
            'echoReport': 'https://echo.epa.gov/detailed-facility-report?fid=',
        },
        'siteVisitEvalLegend': eval_legend,
        'systems': S,
    }
    if not shard:
        json.dump(snap, open(out, 'w'), separators=(',', ':'))
        print('wrote', out, sum(len(s['violations']) for s in S.values()), 'violations')
        return
    # Sharded output: <out>/<ST>.json.gz per state + <out>/index.json
    import gzip, os
    os.makedirs(out, exist_ok=True)
    by_state = defaultdict(dict)
    index = []
    for p, v in S.items():
        if not v['system']: continue
        st = p[:2]
        by_state[st][p] = v
        sysr = v['system']
        index.append([p, sysr['name'], (sysr['contact'].get('address') or '').split(', ')[-3] if sysr['contact'].get('address') else '',
                      sysr['state'], sysr['population'] or 0, sysr['primarySourceCode'],
                      v['areas']['cities'][:12], v['areas']['counties'][:4], v['areas']['zips'][:40]])
    meta = {k: snap[k] for k in ('snapshotVersion', 'captureTime', 'provenanceNote', 'sources', 'siteVisitEvalLegend')}
    for st, systems in by_state.items():
        with gzip.open(os.path.join(out, f'{st}.json.gz'), 'wt', encoding='utf-8') as f:
            json.dump({**meta, 'systems': systems}, f, separators=(',', ':'))
    index.sort(key=lambda r: -r[4])
    json.dump({**meta, 'columns': ['pwsid', 'name', 'addressCity', 'state', 'population', 'source', 'citiesServed', 'counties', 'zips'], 'rows': index},
              open(os.path.join(out, 'index.json'), 'w'), separators=(',', ':'))
    print('wrote', len(by_state), 'state shards,', len(index), 'systems')

if __name__ == '__main__':
    main()
