# 📊 KPI - 기자 지면 정보 정량평가 시스템

서울경제신문 기자 지면 기여도를 정량적으로 분석하고 평가하는 웹 기반 시스템

🔗 **Live**: [kpi.sedaily.ai](https://kpi.sedaily.ai)

---

## ✨ 주요 기능

### 🔐 권한 기반 로그인 시스템
| 권한 | 접근 범위 | 기능 |
|------|----------|------|
| **관리자 (admin)** | 전체 대시보드 | 모든 부서/기자 조회, 평가, 사원 관리 |
| **부장 (manager)** | 소속 부서 | 부서 내 기자 목록 조회 및 평가 |
| **기자 (reporter)** | 본인 페이지 | 본인 실적 조회만 가능 (평가 영역 숨김) |

### 📈 대시보드 (home.html)
- 전체 기사 통계 요약
- 부서별 기사 현황
- 일별 기사 추이 차트
- 부서별 바로가기

### 👥 기자 목록 (list.html)
- 부서별 필터링 (admin만)
- 기간별 조회 (전체/일별/주별/월별)
- 기자명 검색
- 엑셀 내보내기
- 데이터 동기화 버튼

### 📝 기자 상세 (reporter.html)
- 기자별 상세 기사 목록
- 기간별 필터링 (일별/주별/월별/분기별/반기별)
- 면별 기사 분포 시각화
- 톱(자동) 표시
- **정성평가 항목**: 위치, 취재유형, 기사성격, 임팩트 등급

### ⚙️ 사원 관리 (admin.html) `NEW`
- 부서/권한별 필터링
- 사원 검색
- 부서, 직급, 권한 변경
- 변경사항 JSON 다운로드

---

## 🏗️ 시스템 아키텍처

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  S3 (XML)   │────▶│   Lambda    │────▶│ S3 (Web)    │
│ daily-xml/  │     │ kpi-sync    │     │ data.json   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                    │
                           ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │ CloudFront  │◀────│  Route 53   │
                    │ 캐시 무효화  │     │ kpi.sedaily │
                    └─────────────┘     └─────────────┘
```

### AWS 리소스
| 서비스 | 리소스명 | 용도 |
|--------|---------|------|
| S3 | `sedaily-news-xml-storage` | XML 원본 저장 |
| S3 | `kpi.sedaily.ai` | 웹 호스팅 |
| Lambda | `kpi-sync-data` | XML 파싱 및 동기화 |
| Lambda | `kpi-evaluation-api` | 평가 저장/불러오기 |
| CloudFront | `E1DJQD9MHS4VRO` | CDN 배포 |
| Route 53 | `kpi.sedaily.ai` | DNS |

---

## 📁 프로젝트 구조

```
├── dashboard/
│   ├── login.html         # 로그인 페이지
│   ├── home.html          # 대시보드 (admin)
│   ├── list.html          # 기자 목록
│   ├── reporter.html      # 기자 상세
│   ├── admin.html         # 사원 관리 (admin)
│   ├── users.json         # 사용자 데이터 (235명)
│   ├── data.json          # 기사 데이터
│   └── architecture.html  # 시스템 구조도
├── lambda/
│   ├── sync_data/         # 동기화 Lambda
│   └── evaluation_api/    # 평가 API Lambda
├── src/
│   ├── xml_parser.py      # XML 파서
│   └── ...
├── XML/                   # 2026년 1월 XML
├── November_xml/          # 2025년 12월 XML
└── README.md
```

---

## 🔧 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | HTML, CSS, JavaScript, Bootstrap 5, Chart.js |
| Backend | AWS Lambda (Python 3.11) |
| Storage | AWS S3 |
| CDN | AWS CloudFront |
| DNS | AWS Route 53 |

---

## 📊 데이터 처리 규칙

- **지면 기사만 파싱**: `paperNumber >= 1` 조건
- **공동 기자 분리**: 한 기사에 여러 기자 → 각각 분리 통계
- **톱(자동) 감지**: XML `<paragraph>TOP</paragraph>` 자동 표시
- **데이터 기간**: 2025년 12월 ~ 현재

---

## 🚀 로컬 테스트

```bash
cd dashboard
python -m http.server 8080
# http://localhost:8080/login.html 접속
```

### 테스트 계정
| 권한 | 사번 | 비밀번호 |
|------|------|----------|
| 관리자 | admin | 1234 |
| 부장 | [사번] | 1234 |
| 기자 | [사번] | 1234 |

> 실제 계정 정보는 내부 문서 참조

---

## 📝 업데이트 내역

### 2026-01-28
- ✅ 사원 관리 페이지 추가 (부서/직급/권한 변경)
- ✅ 권한 기반 로그인 시스템 구현 (admin/manager/reporter)
- ✅ 235명 사용자 계정 생성
- ✅ 12월 XML 데이터 동기화 완료

### 2026-01-21
- ✅ 대시보드 페이지 추가
- ✅ 부서별 기자 목록 필터링

### 2026-01-14
- ✅ 기자 상세 페이지 기간별 필터링
- ✅ Lambda CORS 이슈 해결

### 2026-01-08
- ✅ 초기 시스템 구축
- ✅ XML 파싱 및 동기화 기능

---

## 📄 라이선스

MIT License
