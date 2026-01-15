"""지면기사 data.json 생성"""
import boto3
import re
import json
import html
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime

s3 = boto3.client('s3', region_name='us-east-1')

def clean_content(content_str):
    if not content_str:
        return ''
    text = html.unescape(content_str)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def extract_reporters(author_str):
    """공동 기자 분리"""
    if not author_str:
        return ['']
    if '=' in author_str:
        author_str = author_str.split('=')[1]
    author_str = re.sub(r'\([^)]*@[^)]*\)', '', author_str)
    author_str = re.sub(r'\s*(기자|특파원|선임기자|차장|부장|국장|위원|대기자|논설위원)\s*', ' ', author_str)
    names = re.split(r'[·,/]', author_str)
    result = []
    for name in names:
        name = name.strip()
        match = re.match(r'^([가-힣]{2,4})', name)
        if match:
            result.append(match.group(1))
    return result if result else ['']

# S3에서 2026년 XML 전체
response = s3.list_objects_v2(Bucket='sedaily-news-xml-storage', Prefix='daily-xml/2026')
dates = sorted([re.search(r'(\d{8})\.xml', o['Key']).group(1) for o in response.get('Contents', []) if '2026' in o['Key']])

print(f'2026년 XML: {len(dates)}개 ({dates[0]} ~ {dates[-1]})')

reporter_articles = defaultdict(list)

for date in dates:
    r = s3.get_object(Bucket='sedaily-news-xml-storage', Key=f'daily-xml/{date}.xml')
    content = r['Body'].read().decode('utf-8')
    root = ET.fromstring(content)
    
    for item in root.findall('.//item'):
        if item.get('type') != 'text':
            continue
        
        paper = item.find('paper')
        if paper is None:
            continue
        editing = paper.find('editingInfo')
        if editing is None:
            continue
        
        pn = editing.findtext('paperNumber', '0')
        paper_num = int(pn) if pn.isdigit() else 0
        
        # 지면기사만 (paperNumber >= 1)
        if paper_num < 1:
            continue
        
        title = item.findtext('title', '').strip()
        title = html.unescape(title).replace('&quot;', '"')
        
        author = item.findtext('author', '')
        content_text = clean_content(item.findtext('content', ''))
        char_count = len(content_text.replace(' ', ''))
        
        url_elem = item.find('url')
        url = url_elem.get('href', '') if url_elem is not None else ''
        
        paper_position = editing.findtext('position', '') or ''
        paper_paragraph = editing.findtext('paragraph', '') or ''
        
        category_elem = item.find('category')
        category = category_elem.get('name', '') if category_elem is not None else ''
        
        # 위치: position 또는 paragraph에 TOP 포함시 "톱"
        is_auto_top = ('TOP' in paper_position.upper() or 'TOP' in paper_paragraph.upper())
        position = '톱' if is_auto_top else ''
        
        # 공동 기자 분리
        reporters = extract_reporters(author)
        
        for reporter_name in reporters:
            if not reporter_name:
                continue
            article = {
                'nsid': item.findtext('nsid', ''),
                'title': title,
                'author': author,
                'reporter_name': reporter_name,
                'pub_date': item.findtext('date', ''),
                'pub_time': item.findtext('time', ''),
                'content': content_text[:500],
                'char_count': char_count,
                'url': url,
                'paper_number': paper_num,
                'paper_position': paper_position,
                'paper_paragraph': paper_paragraph,
                'position': position,
                'is_auto_top': is_auto_top,  # 자동 분류 여부
                'category': category
            }
            reporter_articles[reporter_name].append(article)

# 기자별 정리
reporters_data = []
for name, articles in sorted(reporter_articles.items(), key=lambda x: len(x[1]), reverse=True):
    total_chars = sum(a['char_count'] for a in articles)
    reporters_data.append({
        'name': name,
        'articles': articles,
        'total_chars': total_chars,
        'article_count': len(articles),
        'avg_chars': total_chars // len(articles) if articles else 0
    })

# JSON 저장
data = {
    'last_sync': datetime.now().strftime('%Y-%m-%d'),
    'period_start': f'{dates[0][:4]}-{dates[0][4:6]}-{dates[0][6:8]}',
    'period_end': f'{dates[-1][:4]}-{dates[-1][4:6]}-{dates[-1][6:8]}',
    'total_articles': sum(len(r['articles']) for r in reporters_data),
    'total_reporters': len(reporters_data),
    'reporters': reporters_data
}

with open('dashboard/data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'\n=== 생성 완료 ===')
print(f'기간: {data["period_start"]} ~ {data["period_end"]}')
print(f'지면기사: {data["total_articles"]}건')
print(f'기자: {data["total_reporters"]}명')
print(f'\n상위 5명:')
for r in reporters_data[:5]:
    page1 = len([a for a in r['articles'] if a['paper_number'] == 1])
    print(f"  {r['name']}: {r['article_count']}건 (1면:{page1})")
