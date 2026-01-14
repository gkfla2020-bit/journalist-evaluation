# 기자 정량평가 시스템 (KPI System)

서울경제신문 기자 정량평가를 위한 웹 기반 KPI 관리 시스템

## 📋 프로젝트 개요

신문사 기자들의 기사 작성 현황을 정량적으로 분석하고 평가하는 시스템입니다. XML 형식의 기사 데이터를 파싱하여 기자별 통계를 제공합니다.

## 🏗️ 시스템 아키텍처

![시스템 구조도](dashboard/architecture.html)

### 구성 요소

| 구성요소 | 설명 |
|---------|------|
| **S3 (XML 저장소)** | 일별 기사 XML 파일 저장 |
| **Lambda** | XML 파싱 및 data.json 생성 |
| **S3 (웹 호스팅)** | 정적 웹사이트 호스팅 |
| **Route 53** | DNS 관리 |
| **EventBridge** | 매일 오전 6시 자동 동기화 (예정) |

### 데이터 흐름
```
XML 저장소 → Lambda (파싱) → data.json → 웹 대시보드
```

## ✨ 주요 기능

### 데이터 처리
- **지면 기사만 파싱**: `paperNumber >= 1` 조건으로 지면 기사만 집계
- **공동 기자 분리**: 한 기사에 여러 기자가 있으면 각각 분리하여 통계
- **톱(자동) 감지**: XML의 `<paragraph>TOP</paragraph>` 감지하여 자동 표시
- **2026년 1월 8일 이후 XML 파싱**

### 기자 목록 페이지 (list.html)
- 전체 기자 목록 및 기사 통계
- 기간별 필터링 (전체/일별/주별/월별)
- 기자명 검색
- 데이터 동기화 버튼

### 기자 상세 페이지 (reporter.html)
- 기자별 상세 기사 목록
- 기간별 필터링 (일별/주별/월별/분기별/반기별)
- 면별 기사 분포 시각화
- 직위 수정 기능
- 톱(자동) 표시 (수정 불가)
- 평가 항목: 위치, 취재유형, 기사성격, 임팩트 등급

### 동기화 기능
- 수동: 동기화 버튼 클릭
- 자동: 매일 오전 6시 (EventBridge 예정)

## 📁 프로젝트 구조

```
├── dashboard/
│   ├── list.html          # 기자 목록 페이지
│   ├── reporter.html      # 기자 상세 페이지
│   ├── index.html         # 메인 (리다이렉트)
│   ├── architecture.html  # 시스템 구조도
│   └── data.json          # 기사 데이터
├── lambda/
│   └── sync_data/
│       └── lambda_function.py  # Lambda 함수
├── src/
│   ├── xml_parser.py      # XML 파서
│   └── ...
└── README.md
```

## 🔧 기술 스택

- **Frontend**: HTML, CSS, JavaScript, Bootstrap 5
- **Backend**: AWS Lambda (Python 3.11)
- **Storage**: AWS S3
- **DNS**: AWS Route 53
- **Scheduling**: AWS EventBridge (예정)

## 📊 수정 내역 (2026-01-14)

### 1. reporter.html - 기자 상세 페이지 기간별 필터링 추가
- 일별/주별/월별/분기별/반기별 탭 클릭 시 해당 기간 기사만 필터링
- 통계 카드(기사건수, 글자수 등) 기간별로 재계산
- 상단 "조회 기간" 텍스트 동적 업데이트
- 기준일: period_end의 전날 (오늘 동기화하면 어제 데이터 기준)

### 2. list.html - 기자 목록 페이지 수정
- 기간 네비게이션 UI 표시 버그 수정
- 검색어 유지 버그 수정 (기간 변경 시 검색어 초기화 방지)
- 일별 기준일을 period_end 전날로 변경

### 3. Lambda CORS 중복 헤더 수정
- Lambda 코드에서 Access-Control-Allow-Origin 헤더 제거
- Function URL 설정과 중복되어 브라우저 CORS 에러 발생하던 문제 해결

### 구현 완료 기능
- ✅ 기자 직위 변경 기능
- ✅ 지면 기사만 파싱
- ✅ 동기화 버튼 (수동)
- ✅ 톱(자동) 기능 추가
- ✅ 공동 기자 분리 통계
- ✅ 2026년 1월 8일 이후 XML 파싱

### 예정 기능
- ⏳ 매일 오전 6시 자동 동기화 (EventBridge)

## 🚀 배포

### S3 배포
```bash
aws s3 cp dashboard/list.html s3://[버킷명]/list.html --content-type "text/html; charset=utf-8"
aws s3 cp dashboard/reporter.html s3://[버킷명]/reporter.html --content-type "text/html; charset=utf-8"
aws s3 cp dashboard/index.html s3://[버킷명]/index.html --content-type "text/html; charset=utf-8"
```

### Lambda 배포
```bash
cd lambda/sync_data
zip -r ../sync_data.zip .
aws lambda update-function-code --function-name [함수명] --zip-file fileb://../sync_data.zip
```

## 📝 라이선스

MIT License
