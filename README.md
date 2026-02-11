# 📊 S-CORE - 기자 지면 기여도 평가 시스템

서울경제신문 기자 지면 기여도를 정량적으로 분석하고 평가하는 웹 기반 시스템

🔗 **Live**: [kpi.sedaily.ai](https://kpi.sedaily.ai)

---

## ✨ 주요 기능

### 🔐 권한 기반 로그인 시스템
| 권한 | 접근 범위 | 기능 |
|------|----------|------|
| **관리자 (admin)** | 전체 대시보드 | 모든 부서/기자 조회, 평가, 가중치 설정, 사원 관리 |
| **부장 (manager)** | 소속 부서 | 부서 내 기자 목록 조회 및 평가 |
| **기자 (reporter)** | 본인 페이지 | 본인 실적 조회, 소명 신청 |

### 📈 S-CORE 점수 산출 시스템
```
기사 점수 = (면 가중치 × 분량 가중치 × 10) + 품질 가점
```

| 구분 | 가중치 |
|------|--------|
| **면 가중치** | 1면(1.0), 2~3면(0.85), 4~5면(0.70), 6~10면(0.55), 11~20면(0.40), 21~32면(0.30) |
| **분량 가중치** | 2,000자↑(1.0), 1,200~1,999자(0.70), 600자↓(0.55) |
| **품질 가점** | 면톱(+2), 단독(+5), 기획(+5), S등급(+3) / 상한 10점 |

### 🎛️ Feature Flags (점수 공개 정책)
관리자가 기자에게 공개되는 정보를 제어할 수 있습니다.

| Flag | 설명 |
|------|------|
| `SHOW_MY_SCORE` | 본인 점수 표시 (OFF 시 "-"로 표시) |
| `SHOW_DEPT_AVERAGE` | 부서 평균 점수 표시 |
| `SHOW_DEPT_RANKING` | 부서 내 순위 표시 |

### 📝 주요 페이지
| 페이지 | 파일 | 설명 |
|--------|------|------|
| 대시보드 | home.html | 전체 현황 요약 (Admin) |
| 부서 대시보드 | score-dashboard.html | 부서별 상세 통계 |
| 기자 목록 | list.html | 기자별 실적 목록 |
| 기사 평가 | score-eval.html | 품질 가점 입력, 확정 기능 |
| 소명 관리 | score-appeals.html | 기자 이의제기 처리 |
| 가중치 설정 | score-config.html | 점수 가중치 조정, Feature Flags |
| 사원 관리 | admin.html | 사원 정보 관리 (Admin) |
| 사용설명서 | guide.html | 시스템 사용 가이드 |

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
│   ├── config.js            # ⭐ 글로벌 설정 (API URL, 부서 그룹 등 중앙 관리)
│   ├── common.js            # 공통 유틸리티 (로딩, 토스트, 에러 처리)
│   ├── common.css           # 공통 스타일
│   ├── score.js             # 점수 계산 모듈 (v3, 동적 가중치)
│   ├── score-data.js        # 데이터 저장소 (localStorage + Lambda 동기화)
│   ├── login.html           # 로그인 페이지
│   ├── home.html            # 대시보드 (admin)
│   ├── list.html            # 기자 목록 (절대/상대평가, 가중치)
│   ├── reporter.html        # 기자 상세
│   ├── score-dashboard.html # 부서 대시보드
│   ├── score-eval.html      # 기사 평가
│   ├── score-appeals.html   # 소명 관리
│   ├── score-penalties.html # 가감점 관리 (감점/가점/정보보고)
│   ├── score-config.html    # 가중치 설정, 부서 가군/나군, Feature Flags
│   ├── score-my.html        # 내 점수 (기자용)
│   ├── admin.html           # 사원 관리 (admin)
│   ├── dept-manage.html     # 부서 관리
│   ├── guide.html           # 사용설명서
│   ├── users.json           # 사용자 데이터 (248명)
│   └── data.json            # 기사 데이터
├── lambda/
│   ├── sync_data/           # 동기화 Lambda
│   ├── evaluation_api/      # 평가 API Lambda
│   └── users_api/           # 사용자 API Lambda
├── src/
│   ├── xml_parser.py        # XML 파서
│   └── ...
├── XML/                     # 2026년 1월 XML
├── November_xml/            # 2025년 12월 XML
└── README.md
```

### ⭐ config.js - 중앙 설정 관리

모든 API URL과 부서 그룹 설정은 `dashboard/config.js` 한 곳에서 관리합니다.
각 페이지에서 `APP_CONFIG.EVAL_API_URL` 등으로 참조하므로, URL 변경 시 config.js만 수정하면 됩니다.

```javascript
// dashboard/config.js
const APP_CONFIG = {
    EVAL_API_URL: '...',    // 평가 저장/불러오기 Lambda
    SYNC_API_URL: '...',    // XML 동기화 Lambda
    USERS_API_URL: '...',   // 사용자 관리 Lambda
    DEFAULT_DEPT_GROUPS: {  // 부서 가군/나군 기본값
        groupA: [...],
        groupB: [...],
        groupAWeight: 1.0,
        groupBWeight: 1.1
    }
};
```

### JS 모듈 로드 순서 (중요)
각 HTML 페이지에서 스크립트는 반드시 아래 순서로 로드해야 합니다:
```html
<script src="common.js"></script>    <!-- 유틸리티 -->
<script src="config.js"></script>    <!-- ⭐ API URL, 부서 설정 -->
<script src="score.js"></script>     <!-- 점수 계산 -->
<script src="score-data.js"></script><!-- 데이터 저장소 -->
```

---

## 🔧 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | HTML, CSS, JavaScript, Bootstrap 5, Chart.js |
| Backend | AWS Lambda (Python 3.11) |
| Storage | AWS S3, localStorage |
| CDN | AWS CloudFront |
| DNS | AWS Route 53 |

---

## 📊 데이터 처리 규칙

- **지면 기사만 파싱**: `paperNumber >= 1` 조건
- **공동 기자 분리**: 한 기사에 여러 기자 → 각각 분리 통계
- **톱(자동) 감지**: XML `<paragraph>TOP</paragraph>` 자동 표시
- **데이터 기간**: 2025년 12월 ~ 현재

---

## 🚀 배포

```bash
# S3 업로드 + CloudFront 캐시 무효화
deploy.bat

# 또는 수동 실행
aws s3 sync dashboard/ s3://kpi.sedaily.ai/ --delete
aws cloudfront create-invalidation --distribution-id E1DJQD9MHS4VRO --paths "/*"
```

## 🚀 로컬 테스트

```bash
cd dashboard
python -m http.server 8080
# http://localhost:8080/login.html 접속
```

### 테스트 계정
| 권한 | 사번 | 이름 | 비밀번호 |
|------|------|------|----------|
| 관리자 | admin | 관리자 | 1234 |
| 부장 | 80486 | 서일범 | 1234 |
| 기자 | 211010 | 주재현 | 1234 |

---

## 📝 업데이트 내역

### v3.0 (2026-02-11)
- ✅ `config.js` 도입 - API URL, 부서 그룹 설정 중앙 관리 (하드코딩 제거)
- ✅ `reporter.html` localStorage 키 불일치 수정 (`kpi_evaluations` → `score_article_evals`)
- ✅ 기자 목록 - 절대평가/상대평가(표준편차 변환) 점수 표시
- ✅ 부서 가군/나군 가중치 설정 (score-config.html)
- ✅ 가감점 관리 - 정보보고 전용 버튼 추가 (6등급 + 핵심 가점)
- ✅ 가감점 관리 - 가점/감점 버튼 순서 변경
- ✅ 부장 페이지 네비게이션 깜빡임 수정 (admin 메뉴 기본 숨김)
- ✅ 사용설명서 v3.0 업데이트

### v2.1 (2026-02-03)
- ✅ Feature Flags 기자 페이지 완전 적용 (reporter.html)
- ✅ 확정 기능 구현 (PENDING/CONFIRMED 상태 관리)
- ✅ 소명 처리 후 점수 자동 재계산
- ✅ 부서 평균/순위 실제 데이터 기반 계산
- ✅ 실시간 동기화 준비 (SYNC_ENABLED 플래그)
- ✅ 사용설명서 v2.1 업데이트

### v2.0 (2026-02-01)
- ✅ S-CORE 점수 산출 시스템 구현
- ✅ 부서 대시보드 탭 기능
- ✅ 기사 평가 페이지 (품질 가점)
- ✅ 소명 관리 페이지
- ✅ 가중치 설정 페이지
- ✅ 테마 통일 (네이비 블루 그라데이션)

### v1.0 (2026-01-28)
- ✅ 사원 관리 페이지 추가
- ✅ 권한 기반 로그인 시스템 구현
- ✅ 248명 사용자 계정 생성
- ✅ 12월 XML 데이터 동기화 완료

---

## 📄 라이선스

MIT License
