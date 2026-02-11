---
inclusion: always
---

# S-CORE 프로젝트 컨텍스트

## 프로젝트 개요
서울경제신문 기자 지면 기여도 평가 시스템 (S-CORE)
- Live: https://kpi.sedaily.ai
- 호스팅: AWS S3 + CloudFront
- 프론트엔드 only (HTML/CSS/JS), 백엔드는 Lambda

## 핵심 아키텍처 규칙

### config.js 중앙 관리 (필수)
모든 API URL과 부서 설정은 `dashboard/config.js`의 `APP_CONFIG` 객체에서 관리.
절대 각 HTML 파일에 API URL을 직접 하드코딩하지 말 것.

```
APP_CONFIG.EVAL_API_URL  → 평가 저장/불러오기 Lambda
APP_CONFIG.SYNC_API_URL  → XML 동기화 Lambda  
APP_CONFIG.USERS_API_URL → 사용자 관리 Lambda
APP_CONFIG.DEFAULT_DEPT_GROUPS → 부서 가군/나군 기본값
APP_CONFIG.getDeptGroups() → localStorage 우선, 없으면 기본값
```

### JS 로드 순서 (필수)
새 페이지 추가 시 반드시 이 순서로 로드:
```html
<script src="common.js"></script>
<script src="config.js"></script>
<script src="score.js"></script>
<script src="score-data.js"></script>
```

### localStorage 키
- `kpi_session` - 로그인 세션
- `score_article_evals` - 기사 평가 데이터 (ScoreDataStore.EVALS_KEY)
- `score_config` - 가중치 설정
- `score_penalties` - 가감점 데이터
- `score_appeals` - 소명 데이터
- `dept_group_weights` - 부서 가군/나군 설정
- `score_feature_flags` - Feature Flags

⚠️ 주의: `kpi_evaluations`는 구 키. 현재는 `score_article_evals` 사용.

### 권한 체계
- admin: 전체 접근
- manager: 소속 부서만
- reporter: 본인 페이지만

### 네비게이션 메뉴 규칙
admin 전용 메뉴(대시보드, 설정, 사원관리, 부서관리)는 HTML에서 `style="display:none"`으로 기본 숨김 처리하고, JS에서 `session.role === 'admin'`일 때만 표시.

## 배포
```bash
aws s3 sync dashboard/ s3://kpi.sedaily.ai/ --delete
aws cloudfront create-invalidation --distribution-id E1DJQD9MHS4VRO --paths "/*"
```
또는 `deploy.bat` 실행.

## Git
- origin: https://github.com/gkfla2020-bit/journalist-evaluation.git (main)
- 브랜치: main만 사용
