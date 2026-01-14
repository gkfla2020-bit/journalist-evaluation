"""
빅카인즈 API 테스트 - 서울경제 기사 데이터 조회
기자명, 면정보, 글자수, 링크 등 확인
"""
import requests
import json

API_KEY = "254be2332bc9e46cc80"
# 여러 엔드포인트 시도
ENDPOINTS = [
    "https://tools.kinds.or.kr:8888/search/news",
    "https://www.bigkinds.or.kr/api/news/search.do",
    "https://openapi.bigkinds.or.kr/search/news"
]
BASE_URL = ENDPOINTS[0]

# 서울경제 언론사 코드 확인을 위한 테스트
headers = {
    "Content-Type": "application/json"
}

# 기본 검색 요청
payload = {
    "access_key": API_KEY,
    "argument": {
        "query": "",
        "published_at": {
            "from": "2025-01-01",
            "until": "2025-01-07"
        },
        "provider": ["서울경제"],
        "category": [],
        "category_incident": [],
        "byline": "",
        "provider_subject": [],
        "subject_info": [],
        "subject_info1": [],
        "subject_info2": [],
        "subject_info3": [],
        "subject_info4": [],
        "sort": {"date": "desc"},
        "hilight": 200,
        "return_from": 0,
        "return_size": 5,
        "fields": [
            "byline",
            "category",
            "category_incident", 
            "provider",
            "news_id",
            "title",
            "published_at",
            "content",
            "provider_news_id",
            "images",
            "provider_link_page"
        ]
    }
}

print("=== 빅카인즈 API 테스트 ===")
print(f"요청 URL: {BASE_URL}")
print(f"요청 데이터: {json.dumps(payload, ensure_ascii=False, indent=2)}")
print()

try:
    for url in ENDPOINTS:
        print(f"\n=== 시도: {url} ===")
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            print(f"응답 상태: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print("=== 응답 데이터 구조 ===")
                print(json.dumps(data, ensure_ascii=False, indent=2)[:3000])
                break
            else:
                print(f"에러 응답: {response.text[:500]}")
        except requests.exceptions.Timeout:
            print("타임아웃")
        except Exception as e:
            print(f"요청 실패: {e}")
        
except Exception as e:
    print(f"전체 실패: {e}")
