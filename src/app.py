"""
기자 성과 측정 시스템 - Flask 백엔드
"""
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import xml.etree.ElementTree as ET
import os
import json
from datetime import datetime
from statistics import mean, stdev

app = Flask(__name__, static_folder='../dashboard')
CORS(app)

# 데이터 저장소 (실제로는 DB 사용)
articles_db = []
evaluations_db = {}

def parse_xml_file(file_path):
    """XML 파일 파싱"""
    articles = []
    tree = ET.parse(file_path)
    root = tree.getroot()
    
    for idx, item in enumerate(root.findall('.//article')):
        content = item.findtext('content', '')
        article = {
            'id': idx + 1,
            'title': item.findtext('title', ''),
            'writer': item.findtext('writer', ''),
            'page_number': item.findtext('pageNumber', ''),
            'pub_date': item.findtext('pubDate', ''),
            'link': item.findtext('link', ''),
            'char_count': len(content.replace(' ', '').replace('\n', '')),
        }
        articles.append(article)
    return articles


def calculate_quant_score(article):
    """정량 점수 계산"""
    score = 0
    # 글자수 기준
    if article['char_count'] >= 2000:
        score += 10
    elif article['char_count'] >= 1000:
        score += 7
    elif article['char_count'] >= 500:
        score += 5
    else:
        score += 3
    
    # 면 정보 기준
    page = str(article['page_number'])
    if page == '1':
        score += 20
    elif page in ['2', '3', '경제', '증권']:
        score += 10
    else:
        score += 5
    return score

def convert_to_relative(scores, target_mean=85, target_std=7.5):
    """상대평가 변환"""
    if len(scores) < 2:
        return scores
    m = mean(scores)
    s = stdev(scores) if stdev(scores) > 0 else 1
    return [round(target_mean + ((score - m) / s) * target_std, 2) for score in scores]

# 시작 시 XML 로드
def load_sample_data():
    global articles_db
    xml_path = os.path.join(os.path.dirname(__file__), 'sample_data', '2024-10-27.xml')
    if os.path.exists(xml_path):
        articles_db = parse_xml_file(xml_path)
        print(f"Loaded {len(articles_db)} articles from XML")

load_sample_data()


# ===== API 엔드포인트 =====

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'app.html')

@app.route('/api/reload', methods=['POST'])
def reload_xml():
    """XML 다시 로드"""
    global articles_db
    load_sample_data()
    return jsonify({'success': True, 'message': f'XML 로드 완료: {len(articles_db)}건'})

@app.route('/api/articles', methods=['GET'])
def get_articles():
    """기사 목록 조회"""
    writer = request.args.get('writer', '')
    result = []
    for article in articles_db:
        if writer and writer not in article['writer']:
            continue
        # 평가 데이터 병합
        eval_data = evaluations_db.get(article['id'], {})
        result.append({
            **article,
            'quant_score': calculate_quant_score(article),
            'placement': eval_data.get('placement', ''),
            'planning': eval_data.get('planning', ''),
            'info_report': eval_data.get('info_report', 0),
            'evaluated': bool(eval_data)
        })
    return jsonify(result)

@app.route('/api/articles/<int:article_id>/evaluate', methods=['POST'])
def evaluate_article(article_id):
    """기사 평가 저장"""
    data = request.json
    evaluations_db[article_id] = {
        'placement': data.get('placement', ''),
        'planning': data.get('planning', ''),
        'info_report': data.get('info_report', 0),
        'evaluated_at': datetime.now().isoformat()
    }
    return jsonify({'success': True, 'message': '평가가 저장되었습니다.'})

@app.route('/api/reporters', methods=['GET'])
def get_reporter_stats():
    """기자별 통계"""
    stats = {}
    for article in articles_db:
        writer = article['writer']
        if writer not in stats:
            stats[writer] = {
                'name': writer,
                'article_count': 0,
                'total_chars': 0,
                'front_page': 0,
                'quant_score': 0,
                'qual_score': 0
            }
        stats[writer]['article_count'] += 1
        stats[writer]['total_chars'] += article['char_count']
        if str(article['page_number']) == '1':
            stats[writer]['front_page'] += 1
        stats[writer]['quant_score'] += calculate_quant_score(article)
        
        # 정성 점수
        eval_data = evaluations_db.get(article['id'], {})
        if eval_data.get('placement') in ['단독', '톱']:
            stats[writer]['qual_score'] += 15
        elif eval_data.get('placement'):
            stats[writer]['qual_score'] += 5
        if eval_data.get('planning'):
            stats[writer]['qual_score'] += 5
        stats[writer]['qual_score'] += eval_data.get('info_report', 0)
    
    # 리스트로 변환 및 정렬
    result = list(stats.values())
    for r in result:
        r['total_score'] = r['quant_score'] + r['qual_score']
    result.sort(key=lambda x: x['total_score'], reverse=True)
    
    # 상대평가 점수 추가
    if len(result) >= 2:
        total_scores = [r['total_score'] for r in result]
        relative_scores = convert_to_relative(total_scores)
        for i, r in enumerate(result):
            r['relative_score'] = relative_scores[i]
            r['rank'] = i + 1
    else:
        for i, r in enumerate(result):
            r['relative_score'] = r['total_score']
            r['rank'] = i + 1
    
    return jsonify(result)

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """요약 통계"""
    total_articles = len(articles_db)
    writers = set(a['writer'] for a in articles_db)
    total_chars = sum(a['char_count'] for a in articles_db)
    evaluated = len(evaluations_db)
    
    return jsonify({
        'total_articles': total_articles,
        'total_reporters': len(writers),
        'avg_chars': total_chars // total_articles if total_articles > 0 else 0,
        'evaluated_count': evaluated
    })

if __name__ == '__main__':
    print("서버 시작: http://localhost:5000")
    app.run(debug=True, port=5000)
