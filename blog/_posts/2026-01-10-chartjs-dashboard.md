---
layout: default
title: "Chart.js로 대시보드 만들기"
date: 2026-01-10
---

# Chart.js로 대시보드 만들기

데이터 시각화를 위한 Chart.js 사용법을 정리합니다.

## 설치

CDN으로 간단하게:

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
```

## 바 차트 (일별 추이)

```html
<canvas id="dailyChart"></canvas>

<script>
const ctx = document.getElementById('dailyChart').getContext('2d');

new Chart(ctx, {
    type: 'bar',
    data: {
        labels: ['01-15', '01-16', '01-17', '01-18', '01-19'],
        datasets: [{
            label: '기사수',
            data: [45, 52, 38, 61, 55],
            backgroundColor: '#1a5f7a',
            borderRadius: 4
        }]
    },
    options: {
        responsive: true,
        plugins: {
            legend: { display: false }
        },
        scales: {
            y: { beginAtZero: true }
        }
    }
});
</script>
```

## 도넛 차트 (비율)

```javascript
new Chart(ctx, {
    type: 'doughnut',
    data: {
        labels: ['1면', '2-3면', '4면+'],
        datasets: [{
            data: [15, 30, 55],
            backgroundColor: ['#ffd700', '#17a2b8', '#6c757d']
        }]
    },
    options: {
        plugins: {
            legend: { position: 'right' }
        }
    }
});
```

## 라인 차트 (추세)

```javascript
new Chart(ctx, {
    type: 'line',
    data: {
        labels: ['1월', '2월', '3월'],
        datasets: [{
            label: '월별 기사수',
            data: [120, 150, 180],
            borderColor: '#1a5f7a',
            tension: 0.3,
            fill: false
        }]
    }
});
```

## 팁

- `responsive: true`로 반응형 처리
- `maintainAspectRatio: false`로 컨테이너 크기에 맞춤
- 차트 업데이트: `chart.destroy()` 후 새로 생성
