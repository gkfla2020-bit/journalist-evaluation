/**
 * S-CORE 점수 산출 시스템 - 핵심 계산 모듈
 * 
 * 기본 공식: 기사 점수 = (면 가중치 × 분량 가중치 × 기본 점수) + 품질 가점
 * 최대 점수: 20점
 * 최저 점수: 1.7점
 */

// 기본 설정 (localStorage에서 로드, 없으면 기본값)
function getScoreConfig() {
    const saved = localStorage.getItem('score_config');
    if (saved) {
        return JSON.parse(saved);
    }
    return {
        BASE_SCORE: 10,
        QUALITY_BONUS_CAP: 10,
        MAX_SCORE: 20,
        PAGE_WEIGHTS: { 1: 1.00, 3: 0.85, 5: 0.70, 10: 0.55, 20: 0.40, 32: 0.30 },
        LENGTH_WEIGHTS: { 2000: 1.00, 1200: 0.70, 600: 0.55, 0: 0.55 },
        QUALITY_BONUS: { isTopArticle: 2, isExclusive: 5, isFeature: 5, isSGrade: 3 }
    };
}

function saveScoreConfig(config) {
    localStorage.setItem('score_config', JSON.stringify(config));
}

// 면 가중치 계산 (설정값 사용)
function getPageWeight(page) {
    const config = getScoreConfig();
    const pw = config.PAGE_WEIGHTS;
    
    // 설정된 임계값 기준으로 가중치 반환
    if (page === 1) return pw[1] || 1.00;
    if (page <= 3) return pw[3] || 0.85;
    if (page <= 5) return pw[5] || 0.70;
    if (page <= 10) return pw[10] || 0.55;
    if (page <= 20) return pw[20] || 0.40;
    return pw[32] || 0.30;
}

// 분량 가중치 계산 (설정값 사용)
function getLengthWeight(charCount) {
    const config = getScoreConfig();
    const lw = config.LENGTH_WEIGHTS;
    
    if (charCount >= 2000) return lw[2000] || 1.00;
    if (charCount >= 1200) return lw[1200] || 0.70;
    return lw[600] || lw[0] || 0.55;
}

// 품질 가점 계산 (설정값 사용)
function calculateQualityBonus(article) {
    const config = getScoreConfig();
    let bonus = 0;
    if (article.isTopArticle) bonus += config.QUALITY_BONUS.isTopArticle || 2;
    if (article.isExclusive) bonus += config.QUALITY_BONUS.isExclusive || 5;
    if (article.isFeature) bonus += config.QUALITY_BONUS.isFeature || 5;
    if (article.isSGrade) bonus += config.QUALITY_BONUS.isSGrade || 3;
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

// 테스트 케이스 검증
function runTestCases() {
    const testCases = [
        { page: 1, charCount: 2100, isTopArticle: true, isExclusive: true, isFeature: true, isSGrade: true, expected: 20.0 },
        { page: 1, charCount: 2000, isTopArticle: true, isExclusive: true, isFeature: false, isSGrade: false, expected: 17.0 },
        { page: 3, charCount: 1500, isTopArticle: true, isExclusive: false, isFeature: true, isSGrade: false, expected: 13.0 },
        { page: 5, charCount: 1500, isTopArticle: true, isExclusive: false, isFeature: false, isSGrade: false, expected: 6.9 },
        { page: 10, charCount: 1300, isTopArticle: false, isExclusive: false, isFeature: false, isSGrade: false, expected: 3.9 },
        { page: 15, charCount: 1000, isTopArticle: false, isExclusive: false, isFeature: false, isSGrade: false, expected: 2.2 },
        { page: 30, charCount: 400, isTopArticle: false, isExclusive: false, isFeature: false, isSGrade: false, expected: 1.7 }
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
    window.getScoreConfig = getScoreConfig;
    window.saveScoreConfig = saveScoreConfig;
    window.getPageWeight = getPageWeight;
    window.getLengthWeight = getLengthWeight;
    window.calculateQualityBonus = calculateQualityBonus;
    window.calculateArticleScore = calculateArticleScore;
    window.runTestCases = runTestCases;
}
