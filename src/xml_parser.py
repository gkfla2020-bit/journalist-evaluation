"""
S3 XML 파서 - 서울경제신문 기사 XML 파싱
"""
import xml.etree.ElementTree as ET
import re
import html
import boto3
from datetime import datetime, timedelta
import os

# S3 설정
S3_BUCKET = 'sedaily-news-xml-storage'
S3_PREFIX = 'daily-xml/'

def get_s3_client():
    """S3 클라이언트"""
    return boto3.client('s3', region_name='us-east-1')

def extract_reporter_name(author_str):
    """기자명 추출
    '조양준 기자(email)' → '조양준'
    '워싱턴=이태규 특파원(email)' → '이태규'
    '뉴욕=홍길동 기자(email)' → '홍길동'
    """
    if not author_str:
        return ''
    
    # '지역=이름' 패턴 처리 (워싱턴=이태규, 뉴욕=홍길동 등)
    if '=' in author_str:
        author_str = author_str.split('=')[1]
    
    # 이름 추출 (한글 이름 + 직함)
    match = re.match(r'^([가-힣]{2,4})\s*(기자|특파원|선임기자|차장|부장|국장|위원)?', author_str)
    if match:
        return match.group(1)
    
    # 그래도 안되면 첫 단어
    first_word = author_str.split()[0] if author_str else ''
    # 한글만 추출
    korean_only = re.sub(r'[^가-힣]', '', first_word)
    return korean_only if len(korean_only) >= 2 else first_word

def clean_content(content_str):
    """HTML 태그 제거하고 순수 텍스트만"""
    if not content_str:
        return ''
    # HTML 엔티티 디코딩
    text = html.unescape(content_str)
    # HTML 태그 제거
    text = re.sub(r'<[^>]+>', '', text)
    # 공백 정리
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def parse_xml_content(xml_content, print_only=True):
    """XML 문자열 파싱
    
    Args:
        xml_content: XML 문자열
        print_only: True면 지면기사만 (paperNumber >= 1), False면 전체
    """
    articles = []
    root = ET.fromstring(xml_content)
    
    for item in root.findall('.//item'):
        if item.get('type') != 'text':
            continue
        
        # 기본 정보
        title = item.findtext('title', '').strip()
        title = html.unescape(title).replace('&quot;', '"')
        
        author = item.findtext('author', '')
        
        content = item.findtext('content', '')
        clean_text = clean_content(content)
        char_count = len(clean_text.replace(' ', ''))
        
        # URL
        url_elem = item.find('url')
        url = url_elem.get('href', '') if url_elem is not None else ''
        
        # 지면 정보
        paper = item.find('paper')
        paper_number = 0
        paper_position = ''
        if paper is not None:
            editing = paper.find('editingInfo')
            if editing is not None:
                pn = editing.findtext('paperNumber', '0')
                paper_number = int(pn) if pn.isdigit() else 0
                paper_position = editing.findtext('position', '').strip()
        
        # 지면기사만 필터링 (print_only=True일 때)
        if print_only and paper_number < 1:
            continue
        
        # 카테고리
        category_elem = item.find('category')
        category = category_elem.get('name', '') if category_elem is not None else ''
        
        # 공동 기자 처리: 쉼표나 · 로 구분된 기자명 분리
        reporter_names = extract_multiple_reporters(author)
        
        # 위치 자동 설정: TOP이 포함되면 "톱"
        position = ''
        if paper_position and 'TOP' in paper_position.upper():
            position = '톱'
        
        # 각 기자별로 기사 생성 (공동 기자 분리)
        for reporter_name in reporter_names:
            article = {
                'nsid': item.findtext('nsid', ''),
                'title': title,
                'author': author,
                'reporter_name': reporter_name,
                'pub_date': item.findtext('date', ''),
                'pub_time': item.findtext('time', ''),
                'content': clean_text[:500],
                'char_count': char_count,
                'url': url,
                'paper_number': paper_number,
                'paper_position': paper_position,
                'position': position,  # 톱 자동 설정
                'category': category
            }
            articles.append(article)
    
    return articles


def extract_multiple_reporters(author_str):
    """공동 기자 분리
    '홍길동·김철수 기자' → ['홍길동', '김철수']
    '홍길동, 김철수 기자' → ['홍길동', '김철수']
    '워싱턴=이태규·김민수 특파원' → ['이태규', '김민수']
    """
    if not author_str:
        return ['']
    
    # 지역= 패턴 제거
    if '=' in author_str:
        author_str = author_str.split('=')[1]
    
    # 이메일 제거
    author_str = re.sub(r'\([^)]*@[^)]*\)', '', author_str)
    
    # 직함 제거
    author_str = re.sub(r'\s*(기자|특파원|선임기자|차장|부장|국장|위원|대기자)\s*', ' ', author_str)
    
    # 구분자로 분리 (·, ,, /)
    names = re.split(r'[·,/]', author_str)
    
    result = []
    for name in names:
        name = name.strip()
        # 한글 이름만 추출 (2~4자)
        match = re.match(r'^([가-힣]{2,4})', name)
        if match:
            result.append(match.group(1))
    
    return result if result else ['']

def download_xml_from_s3(date_str):
    """S3에서 특정 날짜 XML 다운로드
    date_str: 'YYYYMMDD' 형식
    """
    s3 = get_s3_client()
    key = f"{S3_PREFIX}{date_str}.xml"
    
    try:
        response = s3.get_object(Bucket=S3_BUCKET, Key=key)
        xml_content = response['Body'].read().decode('utf-8')
        return xml_content
    except s3.exceptions.NoSuchKey:
        print(f"❌ XML 파일 없음: {key}")
        return None
    except Exception as e:
        print(f"❌ S3 다운로드 오류: {e}")
        return None

def list_available_dates(days=30):
    """S3에서 사용 가능한 날짜 목록"""
    s3 = get_s3_client()
    dates = []
    
    try:
        response = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=S3_PREFIX)
        for obj in response.get('Contents', []):
            key = obj['Key']
            # daily-xml/20260109.xml → 20260109
            match = re.search(r'(\d{8})\.xml$', key)
            if match:
                dates.append(match.group(1))
        return sorted(dates, reverse=True)[:days]
    except Exception as e:
        print(f"❌ S3 목록 조회 오류: {e}")
        return []

def sync_date(date_str):
    """특정 날짜 XML을 S3에서 가져와 DB에 저장"""
    from database import insert_article
    
    xml_content = download_xml_from_s3(date_str)
    if not xml_content:
        return 0
    
    articles = parse_xml_content(xml_content)
    count = 0
    for article in articles:
        if insert_article(article):
            count += 1
    
    print(f"✅ {date_str}: {len(articles)}건 파싱, {count}건 저장")
    return len(articles)

def sync_recent_days(days=7):
    """최근 N일 동기화"""
    from database import init_db
    init_db()
    
    total = 0
    available = list_available_dates(days)
    
    for date_str in available:
        count = sync_date(date_str)
        total += count
    
    print(f"✅ 총 {total}건 동기화 완료")
    return total

def parse_local_xml(file_path):
    """로컬 XML 파일 파싱"""
    with open(file_path, 'r', encoding='utf-8') as f:
        xml_content = f.read()
    return parse_xml_content(xml_content)

if __name__ == '__main__':
    # 테스트: 로컬 파일 파싱
    import sys
    if len(sys.argv) > 1:
        articles = parse_local_xml(sys.argv[1])
        print(f"파싱된 기사: {len(articles)}건")
        for a in articles[:3]:
            print(f"  - {a['reporter_name']}: {a['title'][:30]}... ({a['char_count']}자)")
    else:
        # S3 동기화
        sync_recent_days(7)
