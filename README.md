# 기자 정량평가 시스템

서울경제신문 기자 KPI 관리 시스템

## 배포 URL

- **메인**: http://kpi.sedaily.ai
- **S3 직접**: https://s3.amazonaws.com/kpi.sedaily.ai/index.html

## 주요 기능

- 기자별 기사 통계 (기사수, 글자수, 면별 분포)
- 기사 평가 (위치, 취재유형, 기사성격, 임팩트 등급)
- 일별/주별/월별/분기별/반기별 집계
- 면/글자수 수정 기능

## 페이지 구성

| 파일 | 설명 |
|------|------|
| `index.html` | 윤민혁 기자 샘플 페이지 |
| `list.html` | 기자 목록 (73명) |
| `reporter.html` | 기자 상세 페이지 |
| `data.json` | XML에서 변환된 기사 데이터 (128건) |

## 기술 스택

- HTML/CSS/JavaScript
- Bootstrap 5
- AWS S3 정적 호스팅

## 데이터 소스

- S3 버킷: `sedaily-news-xml-storage/daily-xml/`
- XML 파싱 후 JSON 변환

## 배포

```bash
aws s3 sync dashboard/ s3://kpi.sedaily.ai/
```

## 로컬 실행 (Flask 서버)

```bash
pip install -r requirements.txt
python src/app_v2.py
```

http://localhost:5000 접속
