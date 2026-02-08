/**
 * S-CORE 점수 산출 시스템 - 핵심 계산 모듈 v3.0
 * 
 * 기본 공식: 기사 점수 = (면 가중치 × 분량 가중치 × 기본 점수) + 품질 가점
 * 최대 점수: 20점
 * 최저 점수: 1.7점
 * 
 * v3.0: 동적 가중치 설정 지원 (배열 기반)
 *   - PAGE_WEIGHTS: [{min, max, label, weight}, ...]
 *   - LENGTH_WEIGHTS: [{min, max, label, weight}, ...]
 *   - QUALITY_BONUS: [{id, label, icon, points, cssClass}, ...]
 */

// ========== 기본 설정 (v3 배열 포맷) ==========
const DEFAULT_CONFIG_V3 = {
    BASE_SCORE: 10,
    QUALITY_BONUS_CAP: 10,
    MAX_SCORE: 20,
    PAGE_WEIGHTS: [
        { min: 1, max: 1, label: '1면', weight: 1.00 },
        { min: 2, max: 3, label: '2~3면', weight: 0.85 },
        { min: 4, max: 5, label: '4~5면', weight: 0.70 },
        { min: 6, max: 10, label: '6~10면', weight: 0.55 },
        { min: 11, max: 20, label: '11~20면', weight: 0.40 },
        { min: 21, max: 32, label: '21~32면', weight: 0.30 }
    ],
    LENGTH_WEIGHTS: [
        { min: 2000, max: Infinity, label: '2,000자 이상', weight: 1.00 },
        { min: 1200, max: 1999, label: '1,200~1,999자', weight: 0.70 },
        { min: 600, max: 1199, label: '600~1,199자', weight: 0.55 },
        { min: 0, max: 599, label: '600자 미만', weight: 0.55 }
    ],
    QUALITY_BONUS: [
        { id: 'isTopArticle', label: '면톱', icon: '🏅', points: 2, cssClass: 'top' },
        { id: 'isExclusive', label: '단독', icon: '⭐', points: 5, cssClass: 'exclusive' },
        { id: 'isFeature', label: '기획', icon: '💡', points: 5, cssClass: 'feature' },
        { id: 'isSGrade', label: 'S등급', icon: '🏆', points: 3, cssClass: 'sgrade' },
        { id: 'isAGrade', label: 'A등급', icon: '🅰️', points: 2, cssClass: 'agrade' }
    ]
};

/**
 * v2 (구 포맷) → v3 (배열 포맷) 마이그레이션
 * 기존 localStorage에 저장된 v2 config를 v3로 변환
 */
function migrateConfigV2toV3(oldConfig) {
    // 이미 v3 포맷이면 그대로 반환
    if (Array.isArray(oldConfig.PAGE_WEIGHTS)) return oldConfig;
    
    const newConfig = {
        BASE_SCORE: oldConfig.BASE_SCORE || 10,
        QUALITY_BONUS_CAP: oldConfig.QUALITY_BONUS_CAP || 10,
        MAX_SCORE: oldConfig.MAX_SCORE || 20,
        PAGE_WEIGHTS: [],
        LENGTH_WEIGHTS: [],
        QUALITY_BONUS: []
    };
    
    // PAGE_WEIGHTS 변환: {1: 1.00, 3: 0.85, ...} → 배열
    const pw = oldConfig.PAGE_WEIGHTS || {};
    const pageKeys = Object.keys(pw).map(Number).sort((a, b) => a - b);
    const defaultRanges = [
        { key: 1, min: 1, max: 1, label: '1면' },
        { key: 3, min: 2, max: 3, label: '2~3면' },
        { key: 5, min: 4, max: 5, label: '4~5면' },
        { key: 10, min: 6, max: 10, label: '6~10면' },
        { key: 20, min: 11, max: 20, label: '11~20면' },
        { key: 32, min: 21, max: 32, label: '21~32면' }
    ];
    defaultRanges.forEach(r => {
        newConfig.PAGE_WEIGHTS.push({
            min: r.min, max: r.max, label: r.label,
            weight: pw[r.key] !== undefined ? pw[r.key] : DEFAULT_CONFIG_V3.PAGE_WEIGHTS.find(d => d.min === r.min)?.weight || 0.30
        });
    });
    
    // LENGTH_WEIGHTS 변환: {2000: 1.00, 1200: 0.70, ...} → 배열
    const lw = oldConfig.LENGTH_WEIGHTS || {};
    const defaultLengths = [
        { key: 2000, min: 2000, max: Infinity, label: '2,000자 이상' },
        { key: 1200, min: 1200, max: 1999, label: '1,200~1,999자' },
        { key: 600, min: 600, max: 1199, label: '600~1,199자' },
        { key: 0, min: 0, max: 599, label: '600자 미만' }
    ];
    defaultLengths.forEach(r => {
        newConfig.LENGTH_WEIGHTS.push({
            min: r.min, max: r.max, label: r.label,
            weight: lw[r.key] !== undefined ? lw[r.key] : DEFAULT_CONFIG_V3.LENGTH_WEIGHTS.find(d => d.min === r.min)?.weight || 0.55
        });
    });
    
    // QUALITY_BONUS 변환: {isTopArticle: 2, ...} → 배열
    const qb = oldConfig.QUALITY_BONUS || {};
    const defaultQB = DEFAULT_CONFIG_V3.QUALITY_BONUS;
    defaultQB.forEach(item => {
        newConfig.QUALITY_BONUS.push({
            ...item,
            points: qb[item.id] !== undefined ? qb[item.id] : item.points
        });
    });
    
    return newConfig;
}

// 기본 설정 (localStorage에서 로드, 없으면 기본값)
function getScoreConfig() {
    const saved = localStorage.getItem('score_config');
    if (saved) {
        const parsed = JSON.parse(saved);
        // v2 → v3 마이그레이션
        if (!Array.isArray(parsed.PAGE_WEIGHTS)) {
            const migrated = migrateConfigV2toV3(parsed);
            localStorage.setItem('score_config', JSON.stringify(migrated));
            return restoreInfinity(migrated);
        }
        return restoreInfinity(parsed);
    }
    return restoreInfinity(JSON.parse(JSON.stringify(DEFAULT_CONFIG_V3)));
}

// JSON 직렬화 시 Infinity → null 복원
function restoreInfinity(config) {
    if (config.LENGTH_WEIGHTS && Array.isArray(config.LENGTH_WEIGHTS)) {
        config.LENGTH_WEIGHTS.forEach(w => {
            if (w.max === null || w.max === undefined || w.max === 'Infinity') {
                w.max = Infinity;
            }
        });
    }
    return config;
}

function saveScoreConfig(config) {
    localStorage.setItem('score_config', JSON.stringify(config));
}

// 면 가중치 계산 (배열 순회)
function getPageWeight(page) {
    const config = getScoreConfig();
    const weights = config.PAGE_WEIGHTS;
    
    for (let i = 0; i < weights.length; i++) {
        if (page >= weights[i].min && page <= weights[i].max) {
            return weights[i].weight;
        }
    }
    // 매칭 안 되면 마지막 항목의 가중치 반환
    return weights.length > 0 ? weights[weights.length - 1].weight : 0.30;
}

// 분량 가중치 계산 (배열 순회, 내림차순 min 기준)
function getLengthWeight(charCount) {
    const config = getScoreConfig();
    const weights = config.LENGTH_WEIGHTS;
    
    // min 내림차순으로 정렬하여 큰 범위부터 매칭
    const sorted = [...weights].sort((a, b) => b.min - a.min);
    for (let i = 0; i < sorted.length; i++) {
        if (charCount >= sorted[i].min) {
            return sorted[i].weight;
        }
    }
    // 매칭 안 되면 마지막 항목
    return weights.length > 0 ? weights[weights.length - 1].weight : 0.55;
}

// 품질 가점 계산 (배열 순회)
function calculateQualityBonus(article) {
    const config = getScoreConfig();
    let bonus = 0;
    config.QUALITY_BONUS.forEach(item => {
        if (article[item.id]) {
            bonus += item.points;
        }
    });
    return Math.min(bonus, config.QUALITY_BONUS_CAP || 10);
}

// 기사 점수 계산
function calculateArticleScore(article) {
    const config = getScoreConfig();
    const pageWeight = getPageWeight(article.page);
    const lengthWeight = getLengthWeight(article.charCount || article.char_count);
    const qualityBonus = calculateQualityBonus(article);
    
    const baseScore = pageWeight * lengthWeight * (config.BASE_SCORE || 10);
    let totalScore = baseScore + qualityBonus;
    
    if (!article.hasAdminBonus) {
        totalScore = Math.min(totalScore, config.MAX_SCORE || 20);
    }
    
    return {
        pageWeight,
        lengthWeight,
        baseScore: Math.round(baseScore * 10) / 10,
        qualityBonus,
        totalScore: Math.round(totalScore * 10) / 10
    };
}

/**
 * 기자의 월별 총점 계산 (가감점 포함)
 */
function calculateMonthlyScore(reporterId, yearMonth, articleScore) {
    if (typeof ScoreDataStore !== 'undefined' && ScoreDataStore.calculatePenaltyForMonth) {
        const penaltyResult = ScoreDataStore.calculatePenaltyForMonth(reporterId, yearMonth);
        const finalScore = Math.max(0, articleScore + penaltyResult.totalPenalty);
        
        return {
            articleScore: Math.round(articleScore * 10) / 10,
            penaltyScore: penaltyResult.totalPenalty,
            bonusScore: penaltyResult.bonusTotal || 0,
            deductionScore: penaltyResult.deductionTotal || 0,
            finalScore: Math.round(finalScore * 10) / 10,
            penalties: penaltyResult.penalties
        };
    }
    
    return {
        articleScore: Math.round(articleScore * 10) / 10,
        penaltyScore: 0, bonusScore: 0, deductionScore: 0,
        finalScore: Math.round(articleScore * 10) / 10,
        penalties: []
    };
}

function hasPenalty(reporterId, yearMonth) {
    if (typeof ScoreDataStore !== 'undefined' && ScoreDataStore.calculatePenaltyForMonth) {
        const result = ScoreDataStore.calculatePenaltyForMonth(reporterId, yearMonth);
        return result.totalPenalty !== 0;
    }
    return false;
}

/**
 * 품질 가점 항목 목록 반환 (동적 UI 렌더링용)
 * @returns {Array} [{id, label, icon, points, cssClass}, ...]
 */
function getQualityBonusItems() {
    const config = getScoreConfig();
    return config.QUALITY_BONUS || DEFAULT_CONFIG_V3.QUALITY_BONUS;
}

/**
 * 품질 가점 버튼 HTML 생성 (공통 헬퍼)
 * @param {string} nsid - 기사 ID
 * @param {object} scoreInput - {isTopArticle: true, ...} 현재 평가 상태
 * @param {boolean} isConfirmed - 확정 여부
 * @param {string} toggleFn - 토글 함수명 (예: 'toggleQuality', 'toggleQualityReporter')
 * @param {object} article - 원본 기사 (is_auto_top 체크용)
 * @returns {string} HTML
 */
function renderQualityButtons(nsid, scoreInput, isConfirmed, toggleFn, article) {
    const items = getQualityBonusItems();
    let html = '';
    
    // 자동 면톱 배지
    if (article && article.is_auto_top) {
        html += `<span class="badge bg-warning text-dark me-1" style="font-size:0.65rem;">자동</span>`;
    }
    
    items.forEach(item => {
        const isActive = scoreInput[item.id] || false;
        html += `<button class="quality-btn ${item.cssClass} ${isActive ? 'active' : ''}" 
                    onclick="${toggleFn}('${nsid}', '${item.id}')" ${isConfirmed ? 'disabled' : ''}>${item.label}</button>`;
    });
    
    return html;
}

/**
 * 평가 여부 확인 (품질 가점 하나라도 있는지)
 */
function hasAnyQualityBonus(scoreInput) {
    const items = getQualityBonusItems();
    return items.some(item => scoreInput[item.id]);
}

/**
 * 품질 가점 정보 텍스트 생성 (매트릭스 하단 등)
 */
function getQualityBonusInfoText() {
    const config = getScoreConfig();
    const items = config.QUALITY_BONUS;
    const parts = items.map(item => `${item.label} +${item.points}점`);
    return `품질 가점: ${parts.join(', ')} (상한 ${config.QUALITY_BONUS_CAP}점)`;
}

/**
 * 점수 매트릭스 데이터 생성 (score-config, score-eval 등에서 공통 사용)
 */
function getScoreMatrixData() {
    const config = getScoreConfig();
    return {
        pages: config.PAGE_WEIGHTS,
        lengths: config.LENGTH_WEIGHTS,
        baseScore: config.BASE_SCORE
    };
}

/**
 * 점수 매트릭스 HTML 렌더링
 */
function renderScoreMatrixHTML(targetId) {
    const { pages, lengths, baseScore } = getScoreMatrixData();
    const tbody = document.getElementById(targetId);
    if (!tbody) return;
    
    // 헤더 업데이트 (동적 컬럼)
    const thead = tbody.closest('table')?.querySelector('thead tr');
    if (thead) {
        thead.innerHTML = '<th>면 \\ 글자수</th>' + lengths.map(l => `<th>${l.label}</th>`).join('');
    }
    
    tbody.innerHTML = pages.map(p => {
        const cells = lengths.map(l => {
            const score = Math.round(p.weight * l.weight * baseScore * 10) / 10;
            return `<td class="matrix-cell">${score}</td>`;
        }).join('');
        return `<tr><td class="fw-bold">${p.label}</td>${cells}</tr>`;
    }).join('');
}

// 테스트 케이스 검증
function runTestCases() {
    const testCases = [
        { page: 1, charCount: 2100, isTopArticle: true, isExclusive: true, isFeature: true, isSGrade: true, isAGrade: false, expected: 20.0 },
        { page: 1, charCount: 2000, isTopArticle: true, isExclusive: true, isFeature: false, isSGrade: false, isAGrade: false, expected: 17.0 },
        { page: 3, charCount: 1500, isTopArticle: true, isExclusive: false, isFeature: true, isSGrade: false, isAGrade: false, expected: 13.0 },
        { page: 5, charCount: 1500, isTopArticle: true, isExclusive: false, isFeature: false, isSGrade: false, isAGrade: false, expected: 6.9 },
        { page: 10, charCount: 1300, isTopArticle: false, isExclusive: false, isFeature: false, isSGrade: false, isAGrade: false, expected: 3.9 },
        { page: 15, charCount: 1000, isTopArticle: false, isExclusive: false, isFeature: false, isSGrade: false, isAGrade: false, expected: 2.2 },
        { page: 30, charCount: 400, isTopArticle: false, isExclusive: false, isFeature: false, isSGrade: false, isAGrade: false, expected: 1.7 }
    ];
    
    let results = [];
    testCases.forEach((tc, i) => {
        const result = calculateArticleScore(tc);
        const passed = result.totalScore === tc.expected;
        results.push({ id: `TC-0${i+1}`, passed, expected: tc.expected, actual: result.totalScore });
    });
    return results;
}

// 전역 내보내기
if (typeof window !== 'undefined') {
    window.DEFAULT_CONFIG_V3 = DEFAULT_CONFIG_V3;
    window.getScoreConfig = getScoreConfig;
    window.saveScoreConfig = saveScoreConfig;
    window.restoreInfinity = restoreInfinity;
    window.getPageWeight = getPageWeight;
    window.getLengthWeight = getLengthWeight;
    window.calculateQualityBonus = calculateQualityBonus;
    window.calculateArticleScore = calculateArticleScore;
    window.calculateMonthlyScore = calculateMonthlyScore;
    window.hasPenalty = hasPenalty;
    window.getQualityBonusItems = getQualityBonusItems;
    window.renderQualityButtons = renderQualityButtons;
    window.hasAnyQualityBonus = hasAnyQualityBonus;
    window.getQualityBonusInfoText = getQualityBonusInfoText;
    window.getScoreMatrixData = getScoreMatrixData;
    window.renderScoreMatrixHTML = renderScoreMatrixHTML;
    window.runTestCases = runTestCases;
    window.migrateConfigV2toV3 = migrateConfigV2toV3;
}
