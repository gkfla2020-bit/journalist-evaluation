import boto3
import re
import xml.etree.ElementTree as ET

s3 = boto3.client('s3', region_name='us-east-1')
response = s3.list_objects_v2(Bucket='sedaily-news-xml-storage', Prefix='daily-xml/2026')
dates = [re.search(r'(\d{8})\.xml', o['Key']).group(1) for o in response.get('Contents', []) if '2026' in o['Key']]

total_print = 0
total_online = 0
top_articles = []

for date in sorted(dates):
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
                pos = editing.findtext('position', '') or ''
                para = editing.findtext('paragraph', '') or ''
                if paper_num >= 1:
                    total_print += 1
                    if 'TOP' in pos.upper() or 'TOP' in para.upper():
                        title = item.findtext('title', '')[:40]
                        top_articles.append(f'{date} {paper_num}면: {title}')
                else:
                    total_online += 1

print(f'온라인 기사: {total_online}건')
print(f'지면 기사: {total_print}건')
print(f'톱 기사: {len(top_articles)}건')
for t in top_articles:
    print(f'  - {t}')
