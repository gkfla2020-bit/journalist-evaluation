"""
기자 성과 측정 시스템 - 데이터베이스 모듈
"""
import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'kpi_system.db')

def get_connection():
    """DB 연결"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """테이블 생성"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 기사 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nsid TEXT UNIQUE,
            title TEXT NOT NULL,
            author TEXT,
            reporter_name TEXT,
            pub_date DATE,
            pub_time TEXT,
            content TEXT,
            char_count INTEGER DEFAULT 0,
            url TEXT,
            paper_number INTEGER DEFAULT 0,
            paper_position TEXT,
            category TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 평가 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS evaluations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id INTEGER NOT NULL,
            position TEXT,
            coverage_type TEXT,
            article_nature TEXT,
            impact_grade TEXT,
            is_exclusive INTEGER DEFAULT 0,
            is_scoop INTEGER DEFAULT 0,
            memo TEXT,
            evaluated_by TEXT,
            evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (article_id) REFERENCES articles(id)
        )
    ''')
    
    # 기자 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reporters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            email TEXT,
            department TEXT,
            position TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 인덱스 생성
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_articles_date ON articles(pub_date)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_articles_reporter ON articles(reporter_name)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_evaluations_article ON evaluations(article_id)')
    
    conn.commit()
    conn.close()
    print("✅ 데이터베이스 초기화 완료")

# 기사 관련 함수
def insert_article(article_data):
    """기사 추가 (중복 시 무시)"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT OR IGNORE INTO articles 
            (nsid, title, author, reporter_name, pub_date, pub_time, content, char_count, url, paper_number, paper_position, category)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            article_data.get('nsid'),
            article_data.get('title'),
            article_data.get('author'),
            article_data.get('reporter_name'),
            article_data.get('pub_date'),
            article_data.get('pub_time'),
            article_data.get('content'),
            article_data.get('char_count', 0),
            article_data.get('url'),
            article_data.get('paper_number', 0),
            article_data.get('paper_position'),
            article_data.get('category')
        ))
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()

def get_articles_by_date(date_str):
    """날짜별 기사 조회"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT a.*, e.position, e.coverage_type, e.article_nature, e.impact_grade, e.is_exclusive, e.is_scoop
        FROM articles a
        LEFT JOIN evaluations e ON a.id = e.article_id
        WHERE a.pub_date = ?
        ORDER BY a.paper_number ASC, a.pub_time DESC
    ''', (date_str,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_articles_by_reporter(reporter_name, start_date=None, end_date=None):
    """기자별 기사 조회"""
    conn = get_connection()
    cursor = conn.cursor()
    query = '''
        SELECT a.*, e.position, e.coverage_type, e.article_nature, e.impact_grade, e.is_exclusive, e.is_scoop
        FROM articles a
        LEFT JOIN evaluations e ON a.id = e.article_id
        WHERE a.reporter_name LIKE ?
    '''
    params = [f'%{reporter_name}%']
    
    if start_date:
        query += ' AND a.pub_date >= ?'
        params.append(start_date)
    if end_date:
        query += ' AND a.pub_date <= ?'
        params.append(end_date)
    
    query += ' ORDER BY a.pub_date DESC, a.pub_time DESC'
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_reporter_stats(reporter_name, start_date=None, end_date=None):
    """기자 통계"""
    articles = get_articles_by_reporter(reporter_name, start_date, end_date)
    
    stats = {
        'article_count': len(articles),
        'total_chars': sum(a.get('char_count', 0) for a in articles),
        'front_page': sum(1 for a in articles if a.get('paper_number') == 1),
        'page_2_3': sum(1 for a in articles if a.get('paper_number') in [2, 3]),
        'scoop_count': sum(1 for a in articles if a.get('is_scoop')),
        'exclusive_count': sum(1 for a in articles if a.get('is_exclusive')),
        's_grade': sum(1 for a in articles if a.get('impact_grade') == 'S'),
        'a_grade': sum(1 for a in articles if a.get('impact_grade') == 'A'),
    }
    return stats

# 평가 관련 함수
def save_evaluation(article_id, eval_data):
    """평가 저장 (기존 있으면 업데이트)"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 기존 평가 확인
    cursor.execute('SELECT id FROM evaluations WHERE article_id = ?', (article_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
            UPDATE evaluations SET
                position = ?, coverage_type = ?, article_nature = ?, impact_grade = ?,
                is_exclusive = ?, is_scoop = ?, memo = ?, evaluated_at = ?
            WHERE article_id = ?
        ''', (
            eval_data.get('position'),
            eval_data.get('coverage_type'),
            eval_data.get('article_nature'),
            eval_data.get('impact_grade'),
            1 if eval_data.get('coverage_type') == '단독' else 0,
            1 if eval_data.get('coverage_type') == '특종' else 0,
            eval_data.get('memo'),
            datetime.now().isoformat(),
            article_id
        ))
    else:
        cursor.execute('''
            INSERT INTO evaluations (article_id, position, coverage_type, article_nature, impact_grade, is_exclusive, is_scoop, memo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            article_id,
            eval_data.get('position'),
            eval_data.get('coverage_type'),
            eval_data.get('article_nature'),
            eval_data.get('impact_grade'),
            1 if eval_data.get('coverage_type') == '단독' else 0,
            1 if eval_data.get('coverage_type') == '특종' else 0,
            eval_data.get('memo')
        ))
    
    conn.commit()
    conn.close()
    return True

def get_all_reporters():
    """모든 기자 목록"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT DISTINCT reporter_name, COUNT(*) as article_count
        FROM articles
        WHERE reporter_name IS NOT NULL AND reporter_name != ''
        GROUP BY reporter_name
        ORDER BY article_count DESC
    ''')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

if __name__ == '__main__':
    init_db()
