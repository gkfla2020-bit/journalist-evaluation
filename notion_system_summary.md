# 기자 정량평가 시스템 (KPI System)

## 📌 개요
서울경제신문 기자들의 기사 실적을 자동으로 집계하고 정량/정성 평가를 지원하는 웹 기반 시스템

**접속 URL**: http://kpi.sedaily.ai

---

## 🏗️ 시스템 구성

### AWS 리소스
| 서비스 | 용도 | 리소스명 |
|--------|------|----------|
| S3 | XML 원본 저장 | sedaily-news-xml-storage |
| S3 | 웹 호스팅 | kpi.sedaily.ai |
| Lambda | 데이터 동기화 | kpi-sync-data |
| Lambda | 평가 저장 API | kpi-evaluation-api |
| Route 53 | DNS 관리 | kpi.sedaily.ai |

### 데이터 흐름
```
XML 원본 (S3) → Lambda 파싱 → data.json (S3) → 웹 대시보드
                                    ↓
                         evaluations.json (평가 저장)
```

---

## ⚙️ 주요 기능

### 1. 자동 처리 (정량)
- **지면 기사 필터링**: paperNumber ≥ 1인 기사만 집계
- **톱기사 자동 분류**: XML의 paragraph=TOP 자동 감지
- **기자별 통계**: 기사수, 글자수, 면별 분포 자동 계산
- **공동 취재 분리**: 한 기사에 여러 기자면 각각 집계

### 2. 수동 입력 (정성)
- **위치**: 톱, 사이드(좌/우), 하단, 기타
- **취재유형**: 특종, 단독, 기획발굴, 현장취재, 단순발생, 보도자료, 인용외신
- **기사성격**: 탐사심층, 해설분석, 인터뷰, 르포스케치, 스트레이트, 가십미담
- **임팩트 등급**: S, A, B, C, D

### 3. 기간별 조회
- 일별 / 주별 / 월별 / 분기별 / 반기별 필터링
- 기준일: 동기화 시점의 전날 (오늘 동기화 → 어제 데이터)

---

## 📊 화면 구성

### 기자 목록 (list.html)
- 전체 기자 리스트
- 기사수, 글자수 기준 정렬
- 기간별 필터링
- 데이터 동기화 버튼

### 기자 상세 (reporter.html)
- 개인별 KPI 요약 (기사수, 글자수, 특종, 단독, S/A등급)
- 면별 기사 분포 (1~32면)
- 기사별 평가 입력 및 저장
- 직위 수정 기능

---

## 🔄 데이터 동기화

### 수동 동기화
- 웹에서 "데이터 동기화" 버튼 클릭
- Lambda가 S3 XML 파싱 → data.json 생성

### 자동 동기화 (예정)
- 매일 오전 6시 EventBridge 트리거

### Lambda Function URLs
| 기능 | URL |
|------|-----|
| 데이터 동기화 | https://3pxmyosj2eunachemenbx4b6ay0dzqvd.lambda-url.us-east-1.on.aws/ |
| 평가 저장 API | https://yyffk7tpfey7s2kv7hoitskxb40aljqw.lambda-url.us-east-1.on.aws/ |

---

## 📁 파일 구조

```
dashboard/
├── list.html          # 기자 목록
├── reporter.html      # 기자 상세
├── index.html         # 리다이렉트
├── data.json          # 기사 데이터
└── architecture.html  # 시스템 구조도 (로컬용)

lambda/
├── sync_data/         # 동기화 Lambda
│   └── lambda_function.py
└── evaluation_api/    # 평가 저장 Lambda
    └── lambda_function.py
```

---

## 🔐 보안 및 접근

- S3 정적 웹 호스팅 (퍼블릭)
- Lambda Function URL (인증 없음, 내부용)
- 평가 데이터는 S3에 JSON으로 저장 (모든 사용자 공유)

---

## 📝 개발 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-08 | 프로젝트 시작, XML 파싱 구현 |
| 2026-01-09 | 웹 대시보드 MVP 완성 |
| 2026-01-14 | 기간별 필터링, 직위 수정 기능 |
| 2026-01-15 | CORS 수정, GitHub 백업 |
| 2026-01-16 | 평가 서버 저장 기능, 캐시 제어 |

---

## 🔗 관련 링크

- **서비스**: http://kpi.sedaily.ai
- **GitHub**: https://github.com/gkfla2020-bit/journalist-evaluation
- **시스템 구조도**: dashboard/architecture.html
