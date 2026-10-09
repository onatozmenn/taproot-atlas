"""Parse Ireland's EPA Remedial Action List PDF into data/global/ie-ral-<q>.json.
Usage: curl -sLo ral.pdf "http://documents.myuisce.ie/PublicWSS/RemedialActionList/Q4-2025-Remedial%20Action%20List.pdf"
       pdftotext -layout ral.pdf ral.txt && python3 scripts/global/ie_ral.py ral.txt > data/global/ie-ral-2025q4.json
Reason columns are matched to the nearest "RAL Category:" header; rows whose
name wraps onto two lines are patched in FIX (check population totals against
the EPA report: Q4 2025 = 35 supplies, ~467,000 people)."""
import re, json, sys
L = open(sys.argv[1]).read().split('\n')
CATS = ['cryptosporidium', 'disinfection', 'ecoli', 'thm', 'pesticides', 'hse', 'aluminium', 'turbidity', 'audit']
FIX = {'1300PUB1204': ('Kerry', 'Listowel Regional Public Water Supply', 15661),
       '2100PUB1018': ('Louth', 'Cavanhill', 52188), '2300PUB1005': ('Meath', 'Drumcondrath', 1225)}
centers = [m.start() + 6 for m in re.finditer('RAL Category:', L[0])]
code_re = re.compile(r'\b(\d{4}PUB\d{4})\b')
rows = [i for i, l in enumerate(L) if code_re.search(l) and not l.strip().startswith('1.')]
flags = {i: set() for i in rows}
for j, l in enumerate(L[1:], 1):
    if 'RAL Category' in l or l.strip().startswith('1.'):
        continue
    for m in re.finditer(r'(?<=\s)Y(?=\s|$)', l):
        if m.start() < 200:
            continue
        k = min(rows, key=lambda r: (abs(r - j), -r))
        flags[k].add(CATS[min(range(len(CATS)), key=lambda n: abs(centers[n] - m.start()))])
out = []
for i in rows:
    l = L[i]; m = code_re.search(l); code = m.group(1)
    if code in FIX:
        county, name, pop = FIX[code]
    else:
        pre = [p.strip() for p in l[:m.start()].split('  ') if p.strip()]
        county, name = pre[0], re.sub(r' 1$', '', pre[1])
        pop = int(re.findall(r'\b\d{1,3}(?:,\d{3})*\b', l[m.end():m.end() + 45])[0].replace(',', ''))
    out.append(dict(code=code, county=county, name=name, pop=pop, reasons=sorted(flags[i])))
print(json.dumps(out, indent=0, ensure_ascii=False))
