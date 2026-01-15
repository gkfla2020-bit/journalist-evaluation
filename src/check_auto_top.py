import json
d = json.load(open('dashboard/data.json', 'r', encoding='utf-8'))
tops = [a for r in d['reporters'] for a in r['articles'] if a.get('is_auto_top')]
print(f'자동 톱 기사: {len(tops)}건')
for a in tops:
    print(f"  - {a['reporter_name']}: {a['title'][:40]}")
