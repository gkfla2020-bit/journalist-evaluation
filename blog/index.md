---
layout: default
title: Home
---

# Ha Rim Jung

> Quantitative Researcher & Financial Engineer

금융공학과 데이터 분석을 기반으로 퀀트 리서치를 수행하고 있습니다.  
2026년 3월부터 서강대학교 컴퓨터공학과 석박통합과정에 진학 예정입니다.

---

## 🎓 Education

**서강대학교 대학원** | 컴퓨터공학 석박통합과정  
*2026.03 ~ (예정)*

**한양대학교** | 경제학 학사  
*2023.03 ~ 2025.08*

---

## 🏆 Awards & Honors

**뱅키스 모의투자대회 3위** | 한국투자증권  
*2025.09* | 전국 단위 실전 모의투자 대회

**이공계 TOP 100 장학금** | 롯데재단  
*2025.08* | 이공계 우수 인재 선발 장학금

**투자 포트폴리오 아이디어 공모전 대상** | KCGI자산운용  
*2025.06* | 자산배분 전략 및 포트폴리오 설계

---

## 💼 Experience

### 서울경제신문 | IT 풀스택 개발 인턴
*2025.12 ~ 현재*

기자 정량평가 시스템을 기획부터 배포까지 단독으로 개발했습니다.
- AWS 서버리스 아키텍처 설계 (Lambda, S3, EventBridge)
- XML 데이터 파싱 및 자동 동기화 파이프라인 구축
- 대시보드 및 통계 시각화 기능 개발

### 그린하버자산운용 | 사업타당성 평가 프로젝트 인턴
*2025.11 ~ 2025.12*

해상풍력 대체투자 프로젝트의 재무 모델링을 수행했습니다.
- DCF 기반 사업성 분석
- 민감도 분석 및 시나리오 테스트

### 한국토지주택공사 (LH) | 인턴
*2024.03 ~ 2024.06*

---

## 🚀 Projects

### 기자 정량평가 시스템

서울경제신문 기자들의 KPI를 관리하는 풀스택 웹 애플리케이션입니다.

**Tech Stack**  
`HTML/CSS/JS` `Bootstrap` `Chart.js` `AWS Lambda` `S3` `EventBridge`

**주요 기능**
- 일간 XML 데이터 자동 수집 및 파싱 (하루 2회 스케줄링)
- 기자별 기사 통계 대시보드 (기사수, 글자수, 면별 분포)
- 정성 평가 입력 시스템 (취재유형, 임팩트 등급)
- 기간별 필터링 (일별/주별/월별/분기별/반기별)
- 엑셀 내보내기 기능

**Links**  
[GitHub Repository](https://github.com/gkfla2020-bit/journalist-evaluation) | [Live Demo](https://kpi.sedaily.ai)

---

### 펀딩레이트 기반 트레이딩 전략 개발

FIND-A 금융 데이터 분석 학회에서 진행 중인 퀀트 리서치 프로젝트입니다.

**Research Focus**
- 암호화폐 선물 시장의 펀딩레이트 분석
- 시장 센티먼트 지표로서의 활용 가능성 검증
- 백테스팅 기반 전략 수익률 분석

*2025.07 ~ 진행중*

---

## 📜 Certifications

| 자격증 | 취득일 |
|--------|--------|
| 투자자산운용사 | 2025.10 |
| 펀드투자권유자문인력 | 2024.10 |

---

## 📝 Blog Posts

{% for post in site.posts %}
### [{{ post.title }}]({{ post.url }})
*{{ post.date | date: "%Y년 %m월 %d일" }}*

{% endfor %}

---

## 📫 Contact

- **GitHub**: [gkfla2020-bit](https://github.com/gkfla2020-bit)
- **Email**: gkfla2020@hanyang.ac.kr
