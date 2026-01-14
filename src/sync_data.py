"""
S3 XML 데이터 동기화 스크립트
"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from database import init_db, insert_article, get_connection
from xml_parser import parse_local_xml, download_xml_from_s3, list_available_dates

def sync_from_local(xml_path):
    """로컬 XML 파일에서 동기화"""
    init_db()
    articles = parse_local_xml(xml_path)
    
    count = 0
    for article in articles:
        result = insert_article(article)
        if result:
            count += 1
    
    print(f"✅ {len(articles)}건 파싱, DB 저장 완료")
    return count

def sync_from_s3(date_str=None, days=7):
    """S3에서 동기화"""
    init_db()
    
    if date_str:
        # 특정 날짜만
        xml_content = download_xml_from_s3(date_str)
        if xml_content:
            from xml_parser import parse_xml_content
            articles = parse_xml_content(xml_content)
            for article in articles:
                insert_article(article)
            print(f"✅ {date_str}: {len(articles)}건 동기화")
    else:
        # 최근 N일
        dates = list_available_dates(days)
        total = 0
        for d in dates:
            xml_content = download_xml_from_s3(d)
            if xml_content:
                from xml_parser import parse_xml_content
                articles = parse_xml_content(xml_content)
                for article in articles:
                    insert_article(article)
                total += len(articles)
                print(f"  - {d}: {len(articles)}건")
        print(f"✅ 총 {total}건 동기화 완료")

def show_stats():
    """현재 DB 통계"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) FROM articles')
    total = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(DISTINCT reporter_name) FROM articles')
    reporters = cursor.fetchone()[0]
    
    cursor.execute('SELECT MIN(pub_date), MAX(pub_date) FROM articles')
    dates = cursor.fetchone()
    
    cursor.execute('''
        SELECT reporter_name, COUNT(*) as cnt 
        FROM articles 
        WHERE reporter_name != "" 
        GROUP BY reporter_name 
        ORDER BY cnt DESC 
        LIMIT 10
    ''')
    top_reporters = cursor.fetchall()
    
    conn.close()
    
    print(f"\n📊 DB 현황")
    print(f"   총 기사: {total}건")
    print(f"   기자 수: {reporters}명")
    print(f"   기간: {dates[0]} ~ {dates[1]}")
    print(f"\n   상위 기자:")
    for r in top_reporters:
        print(f"     - {r[0]}: {r[1]}건")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg.endswith('.xml'):
            # 로컬 파일
            sync_from_local(arg)
        elif arg == 'stats':
            show_stats()
        elif arg == 's3':
            # S3 동기화
            days = int(sys.argv[2]) if len(sys.argv) > 2 else 7
            sync_from_s3(days=days)
        else:
            # 특정 날짜 (YYYYMMDD)
            sync_from_s3(date_str=arg)
    else:
        print("사용법:")
        print("  python sync_data.py sample.xml     # 로컬 XML 동기화")
        print("  python sync_data.py 20260109       # 특정 날짜 S3 동기화")
        print("  python sync_data.py s3 7           # 최근 7일 S3 동기화")
        print("  python sync_data.py stats          # DB 통계 보기")
