"""지면기사 기자 분석"""
import boto3
import re
import xml.etree.ElementTree as ET
from collections import defaultdict

s3 = boto3.client('s3', region_name='us-east-1')

reporter_articles = defaultdict(list)

# S3에서 2026년 XML 전체 목록 가져오기
response = s3.list_objects_v2(Bucket='sedaily-news-xml-storage', Prefix='daily-xml/2026')
all_dates = []
for obj in response.get('Contents', []):
    key = obj['Key']
    match = re.search(r'(\d{8})\.xml', key)
    if match:
        all_dates.append(match.group(1))
all_dates = sorted(all_dates)
print(f'=== 2026년 XML 파일: {len(all_dates)}개 ({all_dates[0]} ~ {all_dates[-1]}) ===\n')

for date in all_dates:
    try:
        r = s3.get_object(Bucket='sedaily-news-xml-storage', Key=f'daily-xml/{date}.xml')
        content = r['Body'].read().decode('utf-8')
        root = ET.fromstring(content)
        
        for item in root.findall('.//item'):
            if item.get('type') != 'text':
                continue
            paper = item.find('paper')
            if paper is not None:
                editing = paper.find('editingInfo')
                if editing is not None:
                    pn = editing.findtext('paperNumber', '0')
                    paper_num = int(pn) if pn.isdigit() else 0
                    if paper_num >= 1:
                        author = item.findtext('author', '')
                        if '=' in author:
                            author = author.split('=')[1]
                        match = re.match(r'^([가-힣]{2,4})', author)
                        if match:
                            name = match.group(1)
                            pos = editing.findtext('position', '') or ''
                            reporter_articles[name].append({
                                'date': date,
                                'page': paper_num,
                                'pos': pos,
                                'title': item.findtext('title', '')[:30]
                            })
    except Exception as e:
        print(f'{date} 오류: {e}')

sorted_reporters = sorted(reporter_articles.items(), key=lambda x: len(x[1]), reverse=True)

print('=== 지면기사 많은 기자 TOP 10 ===')
for name, articles in sorted_reporters[:10]:
    top_count = len([a for a in articles if a['pos'] and 'TOP' in a['pos'].upper()])
    pages = [a['page'] for a in articles]
    page1 = pages.count(1)
    page23 = len([p for p in pages if 2 <= p <= 3])
    print(f'{name}: {len(articles)}건 (톱:{top_count}, 1면:{page1}, 2-3면:{page23})')
    for a in articles[:2]:
        print(f"  - [{a['date']}] {a['page']}면 {a['title']}...")
