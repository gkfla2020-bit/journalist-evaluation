"""
Lambda: S3 XML에서 data.json 생성 및 업로드
API Gateway로 호출하면 최신 XML 가져와서 data.json 갱신
"""
import boto3
import re
import json
import html
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime

s3 = boto3.client('s3')
XML_BUCKET = 'sedaily-news-xml-storage'
WEB_BUCKET = 'kpi.sedaily.ai'

def clean_content(content_str):
    if not content_str:
        return ''
    text = html.unescape(content_str)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def extract_reporters(author_str):
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

def lambda_handler(event, context):
    # 2026년 XML 목록 가져오기
    response = s3.list_objects_v2(Bucket=XML_BUCKET, Prefix='daily-xml/2026')
    dates = sorted([re.search(r'(\d{8})\.xml', o['Key']).group(1) 
                    for o in response.get('Contents', []) if '2026' in o['Key']])
    
    if not dates:
        return {'statusCode': 404, 'body': json.dumps({'error': 'No XML files found'})}
    
    reporter_articles = defaultdict(list)
    
    for date in dates:
        try:
            r = s3.get_object(Bucket=XML_BUCKET, Key=f'daily-xml/{date}.xml')
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
                        'is_auto_top': is_auto_top,
                        'category': category
                    }
                    reporter_articles[reporter_name].append(article)
        except Exception as e:
            print(f'Error processing {date}: {e}')
    
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
    
    data = {
        'last_sync': datetime.now().strftime('%Y-%m-%d %H:%M'),
        'period_start': f'{dates[0][:4]}-{dates[0][4:6]}-{dates[0][6:8]}',
        'period_end': f'{dates[-1][:4]}-{dates[-1][4:6]}-{dates[-1][6:8]}',
        'total_articles': sum(len(r['articles']) for r in reporters_data),
        'total_reporters': len(reporters_data),
        'reporters': reporters_data
    }
    
    # S3에 업로드 (캐시 방지 헤더 추가)
    s3.put_object(
        Bucket=WEB_BUCKET,
        Key='data.json',
        Body=json.dumps(data, ensure_ascii=False, indent=2),
        ContentType='application/json; charset=utf-8',
        CacheControl='no-cache, no-store, must-revalidate'
    )
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps({
            'success': True,
            'period_start': data['period_start'],
            'period_end': data['period_end'],
            'total_articles': data['total_articles'],
            'total_reporters': data['total_reporters'],
            'last_sync': data['last_sync']
        }, ensure_ascii=False)
    }
