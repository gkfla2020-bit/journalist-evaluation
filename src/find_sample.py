import json
d = json.load(open('dashboard/data.json','r',encoding='utf-8'))
print("=== 톱/1면 기사 있는 기자 ===")
for r in d['reporters']:
    tops = [a for a in r['articles'] if a.get('position')]
    page1 = [a for a in r['articles'] if a['paper_number'] == 1]
    if tops or page1:
        print(f"{r['name']}: {r['article_count']}건, 톱:{len(tops)}, 1면:{len(page1)}")
