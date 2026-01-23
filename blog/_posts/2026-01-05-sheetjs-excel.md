---
layout: default
title: "SheetJS로 브라우저에서 엑셀 파일 생성하기"
date: 2026-01-05
---

# SheetJS로 브라우저에서 엑셀 파일 생성하기

서버 없이 클라이언트에서 바로 엑셀 파일을 만드는 방법입니다.

## 설치

```html
<script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"></script>
```

## 기본 사용법

```javascript
// 데이터 준비
const data = [
    { 이름: '홍길동', 기사수: 15, 글자수: 12000 },
    { 이름: '김철수', 기사수: 12, 글자수: 9500 },
    { 이름: '이영희', 기사수: 18, 글자수: 15000 }
];

// 워크북 생성
const wb = XLSX.utils.book_new();

// 시트 생성
const ws = XLSX.utils.json_to_sheet(data);

// 워크북에 시트 추가
XLSX.utils.book_append_sheet(wb, ws, '기자목록');

// 파일 다운로드
XLSX.writeFile(wb, '기자통계.xlsx');
```

## 컬럼 너비 설정

```javascript
ws['!cols'] = [
    { wch: 15 },  // 이름
    { wch: 10 },  // 기사수
    { wch: 12 }   // 글자수
];
```

## 여러 시트 추가

```javascript
// 요약 시트
const summaryData = [
    { 항목: '총 기자수', 값: 45 },
    { 항목: '총 기사수', 값: 320 },
    { 항목: '평균 기사수', 값: 7.1 }
];

const ws2 = XLSX.utils.json_to_sheet(summaryData);
XLSX.utils.book_append_sheet(wb, ws2, '요약');
```

## 실전 예제

```javascript
function exportExcel() {
    const articles = getFilteredArticles();
    
    // 기사 목록 데이터
    const excelData = articles.map((a, i) => ({
        '번호': i + 1,
        '날짜': a.pub_date,
        '제목': a.title,
        '면': a.paper_number,
        '글자수': a.char_count
    }));
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, '기사목록');
    
    XLSX.writeFile(wb, `기사목록_${new Date().toISOString().slice(0,10)}.xlsx`);
}
```

서버 비용 없이 클라이언트에서 바로 엑셀 생성 가능!
