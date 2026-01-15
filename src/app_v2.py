"""
기자 성과 측정 시스템 - Flask API 서버 v2
실제 S3 XML 연동 + SQLite DB
"""
from flask import Flask, jsonify, request, send_from_directory, render_template_string
from flask_cors import CORS
from datetime import datetime, timedelta
import os

from database import (
    init_db, get_articles_by_date, get_articles_by_reporter,
    get_reporter_stats, save_evaluation, get_all_reporters, get_connection
)
from xml_parser import sync_date, sync_recent_days, list_available_dates

app = Flask(__name__, static_folder='../dashboard')
CORS(app)

# 시작 시 DB 초기화
init_db()

# ===== 정적 파일 서빙 =====
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(app.static_folder, filename)

# ===== API 엔드포인트 =====

@app.route('/api/sync', methods=['POST'])
def sync_xml():
    """S3에서 XML 동기화"""
    data = request.json or {}
    date_str = data.get('date')  # YYYYMMDD
    days = data.get('days', 7)
    
    if date_str:
        count = sync_date(date_str)
        return jsonify({'success': True, 'message': f'{date_str} 동기화 완료: {count}건'})
    else:
        count = sync_recent_days(days)
        return jsonify({'success': True, 'message': f'최근 {days}일 동기화 완료: {count}건'})

@app.route('/api/available-dates', methods=['GET'])
def get_available_dates():
    """사용 가능한 날짜 목록"""
    dates = list_available_dates(30)
    return jsonify(dates)

@app.route('/api/articles', methods=['GET'])
def get_articles():
    """기사 목록 조회"""
    date_str = request.args.get('date')  # YYYY-MM-DD
    reporter = request.args.get('reporter')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    if reporter:
        articles = get_articles_by_reporter(reporter, start_date, end_date)
    elif date_str:
        articles = get_articles_by_date(date_str)
    else:
        # 기본: 오늘 기사
        today = datetime.now().strftime('%Y-%m-%d')
        articles = get_articles_by_date(today)
    
    return jsonify(articles)

@app.route('/api/articles/<int:article_id>/evaluate', methods=['POST'])
def evaluate_article(article_id):
    """기사 평가 저장"""
    data = request.json
    success = save_evaluation(article_id, {
        'position': data.get('position'),
        'coverage_type': data.get('coverage_type'),
        'article_nature': data.get('article_nature'),
        'impact_grade': data.get('impact_grade'),
        'memo': data.get('memo')
    })
    
    if success:
        return jsonify({'success': True, 'message': '저장되었습니다'})
    else:
        return jsonify({'success': False, 'message': '저장 실패'}), 500

@app.route('/api/articles/<int:article_id>/update', methods=['POST'])
def update_article(article_id):
    """기사 정보 수정 (면, 글자수 등)"""
    data = request.json
    conn = get_connection()
    cursor = conn.cursor()
    
    updates = []
    params = []
    
    if 'paper_number' in data:
        updates.append('paper_number = ?')
        params.append(data['paper_number'])
    
    if 'char_count' in data:
        updates.append('char_count = ?')
        params.append(data['char_count'])
    
    if updates:
        params.append(article_id)
        cursor.execute(f'UPDATE articles SET {", ".join(updates)} WHERE id = ?', params)
        conn.commit()
    
    conn.close()
    return jsonify({'success': True, 'message': '수정되었습니다'})

@app.route('/api/reporters', methods=['GET'])
def get_reporters():
    """기자 목록"""
    reporters = get_all_reporters()
    return jsonify(reporters)

@app.route('/api/reporter/<name>/stats', methods=['GET'])
def get_reporter_statistics(name):
    """기자별 통계"""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    period = request.args.get('period', 'daily')  # daily, weekly, monthly, quarterly, halfyear
    
    # 기간 계산
    today = datetime.now()
    if not end_date:
        end_date = today.strftime('%Y-%m-%d')
    
    if not start_date:
        if period == 'daily':
            start_date = end_date
        elif period == 'weekly':
            start_date = (today - timedelta(days=7)).strftime('%Y-%m-%d')
        elif period == 'monthly':
            start_date = (today - timedelta(days=30)).strftime('%Y-%m-%d')
        elif period == 'quarterly':
            start_date = (today - timedelta(days=90)).strftime('%Y-%m-%d')
        elif period == 'halfyear':
            start_date = (today - timedelta(days=180)).strftime('%Y-%m-%d')
    
    stats = get_reporter_stats(name, start_date, end_date)
    articles = get_articles_by_reporter(name, start_date, end_date)
    
    return jsonify({
        'reporter_name': name,
        'period': period,
        'start_date': start_date,
        'end_date': end_date,
        'stats': stats,
        'articles': articles
    })

@app.route('/api/stats/summary', methods=['GET'])
def get_summary_stats():
    """전체 요약 통계"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 전체 기사 수
    cursor.execute('SELECT COUNT(*) FROM articles')
    total_articles = cursor.fetchone()[0]
    
    # 기자 수
    cursor.execute('SELECT COUNT(DISTINCT reporter_name) FROM articles WHERE reporter_name != ""')
    total_reporters = cursor.fetchone()[0]
    
    # 평가 완료 수
    cursor.execute('SELECT COUNT(*) FROM evaluations')
    evaluated_count = cursor.fetchone()[0]
    
    # 날짜 범위
    cursor.execute('SELECT MIN(pub_date), MAX(pub_date) FROM articles')
    date_range = cursor.fetchone()
    
    conn.close()
    
    return jsonify({
        'total_articles': total_articles,
        'total_reporters': total_reporters,
        'evaluated_count': evaluated_count,
        'date_range': {
            'start': date_range[0],
            'end': date_range[1]
        }
    })

# ===== 관리 페이지 =====
@app.route('/admin')
def admin_page():
    """간단한 관리 페이지"""
    html = '''
    <!DOCTYPE html>
    <html><head><title>KPI 시스템 관리</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    </head><body class="p-4">
    <div class="container">
        <h2>📊 KPI 시스템 관리</h2>
        <hr>
        <div class="row">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">S3 XML 동기화</div>
                    <div class="card-body">
                        <button class="btn btn-primary" onclick="syncRecent()">최근 7일 동기화</button>
                        <button class="btn btn-secondary" onclick="syncToday()">오늘만 동기화</button>
                        <div id="syncResult" class="mt-3"></div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">시스템 현황</div>
                    <div class="card-body" id="statsArea">로딩중...</div>
                </div>
            </div>
        </div>
        <div class="mt-4">
            <h5>기자 목록</h5>
            <div id="reporterList"></div>
        </div>
    </div>
    <script>
    async function syncRecent() {
        document.getElementById('syncResult').innerHTML = '동기화 중...';
        const res = await fetch('/api/sync', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({days:7})});
        const data = await res.json();
        document.getElementById('syncResult').innerHTML = '<div class="alert alert-success">'+data.message+'</div>';
        loadStats();
    }
    async function syncToday() {
        const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
        document.getElementById('syncResult').innerHTML = '동기화 중...';
        const res = await fetch('/api/sync', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({date:today})});
        const data = await res.json();
        document.getElementById('syncResult').innerHTML = '<div class="alert alert-success">'+data.message+'</div>';
        loadStats();
    }
    async function loadStats() {
        const res = await fetch('/api/stats/summary');
        const data = await res.json();
        document.getElementById('statsArea').innerHTML = `
            <p><strong>총 기사:</strong> ${data.total_articles}건</p>
            <p><strong>기자 수:</strong> ${data.total_reporters}명</p>
            <p><strong>평가 완료:</strong> ${data.evaluated_count}건</p>
            <p><strong>기간:</strong> ${data.date_range.start || '-'} ~ ${data.date_range.end || '-'}</p>
        `;
    }
    async function loadReporters() {
        const res = await fetch('/api/reporters');
        const data = await res.json();
        let html = '<table class="table table-sm"><tr><th>기자명</th><th>기사수</th><th>상세</th></tr>';
        data.slice(0,20).forEach(r => {
            html += `<tr><td>${r.reporter_name}</td><td>${r.article_count}</td><td><a href="/reporter.html?name=${encodeURIComponent(r.reporter_name)}">보기</a></td></tr>`;
        });
        html += '</table>';
        document.getElementById('reporterList').innerHTML = html;
    }
    loadStats();
    loadReporters();
    </script>
    </body></html>
    '''
    return render_template_string(html)

if __name__ == '__main__':
    print("🚀 KPI 시스템 서버 시작: http://localhost:5000")
    print("   - 메인: http://localhost:5000")
    print("   - 관리: http://localhost:5000/admin")
    app.run(debug=True, port=5000, host='0.0.0.0')
