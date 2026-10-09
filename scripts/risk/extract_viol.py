import pandas as pd
ids=set(open('/workspace/work/raw/pwsids-national.txt').read().split())
cols=['PWSID','VIOLATION_ID','COMPL_PER_BEGIN_DATE','VIOLATION_CODE','VIOLATION_CATEGORY_CODE','IS_HEALTH_BASED_IND','CONTAMINANT_CODE','VIOL_MEASURE','FEDERAL_MCL','RULE_CODE','RULE_FAMILY_CODE','VIOLATION_STATUS','VIOL_FIRST_REPORTED_DATE','CALCULATED_RTC_DATE','PUBLIC_NOTIFICATION_TIER','ENFORCEMENT_DATE','ENF_ACTION_CATEGORY','ENFORCEMENT_ACTION_TYPE_CODE']
parts=[]
for ch in pd.read_csv('/workspace/work/raw/sdwa/SDWA_VIOLATIONS_ENFORCEMENT.csv',usecols=cols,dtype=str,chunksize=1_000_000):
    parts.append(ch[ch.PWSID.isin(ids)])
df=pd.concat(parts)
df.to_parquet('viol_enf.parquet')
print(len(df), df.VIOLATION_ID.nunique())
