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
from datetime import datetime, timezone, timedelta

s3 = boto3.client('s3')
XML_BUCKET = 'sedaily-news-xml-storage'
WEB_BUCKET = 'kpi.sedaily.ai'
KST = timezone(timedelta(hours=9))

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
    # 괄호 안 내용 제거 (글·사진), (사진), (영상) 등
    author_str = re.sub(r'\([^)]*\)', '', author_str)
    # 지역=이름 형식 처리 (라스베이거스=김태호, 베이징=송종호 → 김태호, 송종호)
    # 지역명 제거하고 이름만 남김
    author_str = re.sub(r'[가-힣a-zA-Z0-9]+\s*=\s*', '', author_str)
    # 이메일 제거
    author_str = re.sub(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', '', author_str)
    # 직함 제거
    author_str = re.sub(r'\s*(기자|특파원|선임기자|수석기자|차장|부장|국장|위원|대기자|논설위원|객원기자|통신원)\s*', ' ', author_str)
    # 구분자로 분리 (·, ,, /, ·, 와, 및)
    names = re.split(r'[·,/·]|\s+와\s+|\s+및\s+', author_str)
    result = []
    for name in names:
        name = name.strip()
        # 한글 이름 2~4자 추출 (지역명 등 제외)
        # 지역명 패턴 제외: 베이징, 뉴욕, 워싱턴, 도쿄, 상하이, 라스베이거스 등
        if name in ['베이징', '뉴욕', '워싱턴', '도쿄', '상하이', '라스베이거스', '홍콩', '런던', '파리', '서울', '부산', '대구', '광주', '대전', '인천', '세종']:
            continue
        match = re.match(r'^([가-힣]{2,4})$', name)
        if match:
            result.append(match.group(1))
        else:
            # 이름 뒤에 다른 문자가 붙은 경우 (예: 김태호 기자)
            match = re.match(r'^([가-힣]{2,4})', name)
            if match and match.group(1) not in ['베이징', '뉴욕', '워싱턴', '도쿄', '상하이', '라스베이거스', '홍콩', '런던', '파리']:
                result.append(match.group(1))
    return result if result else ['']

def get_all_xml_files():
    """daily-xml 폴더의 모든 XML 파일 목록 가져오기 (지면 정보 포함된 XML만)"""
    xml_files = []
    
    # daily-xml 폴더의 모든 XML (25년~26년)
    response = s3.list_objects_v2(Bucket=XML_BUCKET, Prefix='daily-xml/')
    for obj in response.get('Contents', []):
        key = obj['Key']
        # 20260119.xml 형식
        match = re.search(r'(\d{8})\.xml', key)
        if match:
            date_str = match.group(1)
            xml_files.append({'date': date_str, 'key': key})
    
    # 날짜순 정렬
    xml_files.sort(key=lambda x: x['date'])
    return xml_files

def lambda_handler(event, context):
    # 모든 XML 파일 목록 가져오기 (25년~26년)
    xml_files = get_all_xml_files()
    
    if not xml_files:
        return {'statusCode': 404, 'body': json.dumps({'error': 'No XML files found'})}
    
    print(f"총 {len(xml_files)}개 XML 파일 처리 시작")
    
    reporter_articles = defaultdict(list)
    
    for xml_info in xml_files:
        date = xml_info['date']
        key = xml_info['key']
        try:
            r = s3.get_object(Bucket=XML_BUCKET, Key=key)
            content = r['Body'].read().decode('utf-8')
            root = ET.fromstring(content)
            
            # 기존 형식: <item type="text"> ... <paper><editingInfo><paperNumber>
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
                
                # 입력일자: publishInfo/date (신문 발행일) 사용
                publish_info = paper.find('publishInfo')
                pub_date_raw = publish_info.findtext('date', '') if publish_info is not None else ''
                if pub_date_raw and len(pub_date_raw) == 8:
                    input_date = f'{pub_date_raw[:4]}-{pub_date_raw[4:6]}-{pub_date_raw[6:8]}'
                else:
                    # publishInfo/date 없으면 XML 파일명 날짜 사용
                    input_date = f'{date[:4]}-{date[4:6]}-{date[6:8]}'
                
                for reporter_name in reporters:
                    if not reporter_name:
                        continue
                    article = {
                        'nsid': item.findtext('nsid', ''),
                        'title': title,
                        'author': author,
                        'reporter_name': reporter_name,
                        'pub_date': input_date,  # 입력일자 기준으로 변경
                        'pub_time': item.findtext('time', ''),
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
            
            # 새 형식: <article> ... <pageNumber>
            # pubDate를 기준으로 신문 발행일 계산 (일요일은 신문 없음)
            for article_elem in root.findall('.//article'):
                pn = article_elem.findtext('pageNumber', '0')
                paper_num = int(pn) if pn and pn.isdigit() else 0
                
                if paper_num < 1:
                    continue
                
                title = article_elem.findtext('title', '').strip()
                title = html.unescape(title).replace('&quot;', '"')
                
                author = article_elem.findtext('writer', '')
                content_text = clean_content(article_elem.findtext('content', ''))
                char_count = len(content_text.replace(' ', ''))
                
                url = article_elem.findtext('link', '')
                
                # 입력일자: pubDate에서 신문 발행일 계산
                # 규칙: 오전 7시 ~ 다음날 오전 5시 → 다음날 신문
                # 단, 일요일은 신문 없음 → 월요일로 이동
                pub_date_str = article_elem.findtext('pubDate', '')
                pub_time = ''
                if pub_date_str and ' ' in pub_date_str:
                    pub_time = pub_date_str.split(' ')[1]
                    try:
                        dt = datetime.strptime(pub_date_str, '%Y-%m-%d %H:%M:%S')
                        # 오전 5시 이전이면 당일 신문, 오전 5시 이후면 다음날 신문
                        if dt.hour < 5:
                            paper_date = dt
                        else:
                            paper_date = dt + timedelta(days=1)
                        
                        # 일요일(6)이면 월요일로 이동
                        if paper_date.weekday() == 6:  # Sunday
                            paper_date = paper_date + timedelta(days=1)
                        
                        input_date = paper_date.strftime('%Y-%m-%d')
                    except:
                        input_date = f'{date[:4]}-{date[4:6]}-{date[6:8]}'
                else:
                    input_date = f'{date[:4]}-{date[4:6]}-{date[6:8]}'
                
                # 톱 여부 (1면이면 톱으로 간주)
                is_auto_top = (paper_num == 1)
                position = '톱' if is_auto_top else ''
                
                reporters = extract_reporters(author)
                
                for reporter_name in reporters:
                    if not reporter_name:
                        continue
                    article = {
                        'nsid': article_elem.findtext('link', '').split('/')[-1] if article_elem.findtext('link', '') else '',
                        'title': title,
                        'author': author,
                        'reporter_name': reporter_name,
                        'pub_date': input_date,  # 입력일자 기준으로 변경
                        'pub_time': pub_time,
                        'char_count': char_count,
                        'url': url,
                        'paper_number': paper_num,
                        'paper_position': '',
                        'paper_paragraph': '',
                        'position': position,
                        'is_auto_top': is_auto_top,
                        'category': ''
                    }
                    reporter_articles[reporter_name].append(article)
        except Exception as e:
            print(f'Error processing {date}: {e}')
    
    # 기자별 정리 (중복 제거)
    dates = [f['date'] for f in xml_files]
    reporters_data = []
    for name, articles in reporter_articles.items():
        # 중복 제거: URL 기준 (같은 기사가 제목만 다르게 수정된 경우 대응)
        seen = set()
        unique_articles = []
        for a in articles:
            # URL에서 기사 ID 추출 (NewsView/XXXXX 형식)
            url = a.get('url', '')
            if '/NewsView/' in url:
                key = url.split('/NewsView/')[-1].split('?')[0]
            else:
                key = (a['title'], a['pub_date'])  # URL 없으면 제목+날짜
            
            if key not in seen:
                seen.add(key)
                unique_articles.append(a)
        
        total_chars = sum(a['char_count'] for a in unique_articles)
        reporters_data.append({
            'name': name,
            'articles': unique_articles,
            'total_chars': total_chars,
            'article_count': len(unique_articles),
            'avg_chars': total_chars // len(unique_articles) if unique_articles else 0
        })
    
    # 기사수 기준 내림차순 정렬 (중복 제거 후)
    reporters_data.sort(key=lambda x: x['article_count'], reverse=True)
    
    data = {
        'last_sync': datetime.now(KST).strftime('%Y-%m-%d %H:%M'),
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
        Body=json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8'),
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
