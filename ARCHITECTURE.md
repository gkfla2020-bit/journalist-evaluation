# 서울경제 기자 성과 정량화 시스템 아키텍처

## 1. 시스템 개요

서울경제 기자들의 기사 성과를 정량화하는 시스템으로, 빅카인즈 API를 통해 자동 수집되는 데이터와 수동 평가 옵션을 결합합니다.

## 2. 데이터 소스

### 빅카인즈 API에서 자동 수집 가능한 필드
| 필드 | 설명 | 정량화 활용 |
|------|------|-------------|
| `byline` | 기자명 | 기자별 기사 집계 |
| `content` | 본문 내용 | 글자수 계산 |
| `provider_link_page` | 원문 링크 | 기사 링크 제공 |
| `title` | 기사 제목 | 기사 식별 |
| `published_at` | 발행일시 | 기간별 분석 |
| `category` | 분류 | 분야별 분석 |

### ⚠️ 면(Page) 정보 제한사항
빅카인즈 API 표준 응답에는 **신문 지면(면) 정보가 포함되지 않습니다**.
- 대안 1: 서울경제 자체 DB/시스템에서 면 정보 연동
- 대안 2: 기사 URL 패턴에서 면 정보 추출 시도
- 대안 3: 수동 입력 처리

## 3. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        프론트엔드 (Web UI)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ 기사목록  │  │ 기자별   │  │ 정성평가  │  │ 리포트   │        │
│  │ 조회     │  │ 통계     │  │ 입력     │  │ 출력     │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        백엔드 API 서버                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    FastAPI / Flask                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │  │
│  │  │ 기사 수집   │  │ 정량 분석   │  │ 정성 평가   │       │  │
│  │  │ 모듈       │  │ 모듈       │  │ 모듈       │       │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│ 빅카인즈    │      │ 데이터베이스 │      │ 면정보      │
│ API        │      │ (SQLite/    │      │ 연동 소스   │
│            │      │  PostgreSQL)│      │ (TBD)       │
└─────────────┘      └─────────────┘      └─────────────┘
```

## 4. 데이터 모델

### 4.1 기사 테이블 (articles)
```sql
CREATE TABLE articles (
    id INTEGER PRIMARY KEY,
    news_id VARCHAR(100) UNIQUE,      -- 빅카인즈 기사 ID
    title VARCHAR(500),                -- 제목
    byline VARCHAR(200),               -- 기자명
    published_at DATETIME,             -- 발행일시
    content TEXT,                      -- 본문
    char_count INTEGER,                -- 글자수 (자동계산)
    page_no VARCHAR(20),               -- 면 정보 (수동/연동)
    link_url VARCHAR(500),             -- 원문 링크
    category VARCHAR(100),             -- 분류
    created_at DATETIME DEFAULT NOW()
);
```

### 4.2 정성평가 테이블 (evaluations)
```sql
CREATE TABLE evaluations (
    id INTEGER PRIMARY KEY,
    article_id INTEGER REFERENCES articles(id),
    
    -- 옵션1: 톱/단독 등
    option1_type VARCHAR(50),          -- 'TOP', 'EXCLUSIVE', 'SPECIAL' 등
    option1_score INTEGER,             -- 가중치 점수
    
    -- 옵션2: 부장급 정성평가
    option2_evaluator VARCHAR(100),    -- 평가자 (부장명)
    option2_score INTEGER,             -- 평가 점수 (1-10)
    option2_comment TEXT,              -- 평가 코멘트
    
    -- 옵션3: 기타
    option3_type VARCHAR(50),          -- 기타 평가 유형
    option3_value TEXT,                -- 기타 평가 값
    
    evaluated_at DATETIME DEFAULT NOW(),
    evaluated_by VARCHAR(100)          -- 평가 입력자
);
```

### 4.3 기자 테이블 (reporters)
```sql
CREATE TABLE reporters (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) UNIQUE,
    department VARCHAR(100),           -- 소속 부서
    position VARCHAR(50),              -- 직급
    email VARCHAR(200),
    active BOOLEAN DEFAULT TRUE
);
```

## 5. 점수 산정 로직

### 5.1 정량 점수 (자동)
```python
def calculate_quantitative_score(article):
    score = 0
    
    # 글자수 기반 점수 (예시)
    char_count = article.char_count
    if char_count >= 2000:
        score += 10
    elif char_count >= 1000:
        score += 7
    elif char_count >= 500:
        score += 5
    else:
        score += 3
    
    # 면 정보 기반 점수 (1면 > 경제면 > 기타)
    if article.page_no == '1':
        score += 20
    elif article.page_no in ['경제', '증권']:
        score += 10
    else:
        score += 5
    
    return score
```

### 5.2 정성 점수 (수동 입력)
```python
def calculate_qualitative_score(evaluation):
    score = 0
    
    # 옵션1: 톱/단독 가중치
    option1_weights = {
        'TOP': 30,
        'EXCLUSIVE': 25,
        'SPECIAL': 15,
        'NORMAL': 0
    }
    score += option1_weights.get(evaluation.option1_type, 0)
    
    # 옵션2: 부장급 평가 (1-10점 → 0-20점 변환)
    if evaluation.option2_score:
        score += evaluation.option2_score * 2
    
    # 옵션3: 기타 가산점
    if evaluation.option3_value:
        score += int(evaluation.option3_value) if evaluation.option3_value.isdigit() else 0
    
    return score
```

## 6. API 엔드포인트

### 6.1 기사 수집
```
POST /api/articles/fetch
- 빅카인즈 API에서 서울경제 기사 수집
- 파라미터: start_date, end_date, keyword(optional)
```

### 6.2 기사 조회
```
GET /api/articles
- 기사 목록 조회
- 파라미터: reporter, date_from, date_to, page, limit

GET /api/articles/{id}
- 기사 상세 조회
```

### 6.3 정성평가
```
POST /api/evaluations
- 정성평가 입력
- Body: article_id, option1_type, option2_score, option2_comment, option3_type, option3_value

PUT /api/evaluations/{id}
- 정성평가 수정
```

### 6.4 통계/리포트
```
GET /api/reports/reporter/{name}
- 기자별 성과 리포트

GET /api/reports/period
- 기간별 성과 리포트
- 파라미터: start_date, end_date, group_by(reporter/department)
```

## 7. 기술 스택 제안

| 구분 | 기술 | 이유 |
|------|------|------|
| Backend | Python FastAPI | 빠른 개발, 빅카인즈 API 연동 용이 |
| Database | SQLite → PostgreSQL | 초기 SQLite, 확장시 PostgreSQL |
| Frontend | React / Vue.js | 대시보드 UI |
| 스케줄러 | APScheduler / Celery | 정기 기사 수집 |

## 8. 다음 단계

1. **빅카인즈 API 연결 테스트** - 네트워크 환경에서 실제 API 호출 확인
2. **면 정보 소스 확정** - 서울경제 내부 시스템 연동 방안 협의
3. **정성평가 기준 상세화** - 옵션1/2/3 세부 항목 및 가중치 확정
4. **MVP 개발** - 기본 기능 구현 후 피드백 반영
