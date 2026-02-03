/**
 * S-CORE 점수 산출 시스템 - 핵심 계산 모듈
 * 
 * 기본 공식: 기사 점수 = (면 가중치 × 분량 가중치 × 기본 점수) + 품질 가점
 * 최대 점수: 20점
 * 최저 점수: 1.7점
 */

// 기본 설정 (Config에서 수정 가능)
const SCORE_CONFIG = {
    BASE_SCORE: 10,           // 기본 점수
    QUALITY_BONUS_CAP: 10,    // 품질 가점 상한
    MAX_SCORE: 20,            // 최대 점수
    
    // 면 가중치
    PAGE_WEIGHTS: {
        1: 1.00,              // 1면
        3: 0.85,              // 2~3면
        5: 0.70,              // 4~5면
        10: 0.55,             // 6~10면
        20: 0.40,             // 11~20면
        32: 0.30              // 21~32면
    },
    
    // 분량 가중치
    LENGTH_WEIGHTS: {
        2000: 1.00,           // 2,000자 이상
        1200: 0.70,           // 1,200~1,999자
        600: 0.55,            // 600~1,199자
        0: 0.55               // 600자 미만
    },
    
    // 품질 가점
    QUALITY_BONUS: {
        isTopArticle: 2,      // 면톱
        isExclusive: 5,       // 단독/특종
        isFeature: 5,         // 기획
        isSGrade: 3           // S등급
    }
};

/**
 * 면 가중치 계산
 * @param {number} page - 게재 면 (1~32)
 * @returns {number} 가중치 (0.30 ~ 1.00)
 */
function getPageWeight(page) {
    if (page === 1) return 1.00;
    if (page <= 3) return 0.85;
    if (page <= 5) return 0.70;
    if (page <= 10) return 0.55;
    if (page <= 20) return 0.40;
    return 0.30;
}

/**
 * 분량 가중치 계산
 * @param {number} charCount - 글자 수
 * @returns {number} 가중치 (0.55 ~ 1.00)
 */
function getLengthWeight(charCount) {
    if (charCount >= 2000) return 1.00;
    if (charCount >= 1200) return 0.70;
    return 0.55;
}

/**
 * 품질 가점 계산
 * @param {Object} article - 기사 객체
 * @returns {number} 품질 가점 (0 ~ 10)
 */
function calculateQualityBonus(article) {
    let bonus = 0;
    
    if (article.isTopArticle) bonus += SCORE_CONFIG.QUALITY_BONUS.isTopArticle;
    if (article.isExclusive) bonus += SCORE_CONFIG.QUALITY_BONUS.isExclusive;
    if (article.isFeature) bonus += SCORE_CONFIG.QUALITY_BONUS.isFeature;
    if (article.isSGrade) bonus += SCORE_CONFIG.QUALITY_BONUS.isSGrade;
    
    // 상한 10점
    return Math.min(bonus, SCORE_CONFIG.QUALITY_BONUS_CAP);
}

/**
 * 기사 점수 계산
 * @param {Object} article - 기사 객체
 * @returns {Object} { baseScore, qualityBonus, totalScore }
 */
function calculateArticleScore(article) {
    const pageWeight = getPageWeight(article.page);
    const lengthWeight = getLengthWeight(article.charCount);
    const qualityBonus = calculateQualityBonus(article);
    
    const baseScore = pageWeight * lengthWeight * SCORE_CONFIG.BASE_SCORE;
    let totalScore = baseScore + qualityBonus;
    
    // 최대 점수 제한 (예외 가점 제외)
    if (!article.hasAdminBonus) {
        totalScore = Math.min(totalScore, SCORE_CONFIG.MAX_SCORE);
    }
    
    return {
        pageWeight: pageWeight,
        lengthWeight: lengthWeight,
        baseScore: Math.round(baseScore * 10) / 10,
        qualityBonus: qualityBonus,
        totalScore: Math.round(totalScore * 10) / 10
    };
}

/**
 * 점수 등급 텍스트
 * @param {number} score - 점수
 * @returns {string} 등급 텍스트
 */
function getScoreGrade(score) {
    if (score >= 15) return 'S';
    if (score >= 10) return 'A';
    if (score >= 6) return 'B';
    if (score >= 3) return 'C';
    return 'D';
}

/**
 * 점수 색상 클래스
 * @param {number} score - 점수
 * @returns {string} CSS 클래스
 */
function getScoreColorClass(score) {
    if (score >= 15) return 'text-danger fw-bold';
    if (score >= 10) return 'text-warning fw-bold';
    if (score >= 6) return 'text-primary';
    return 'text-muted';
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
    
    console.log('=== S-CORE 테스트 케이스 검증 ===');
    let allPassed = true;
    
    testCases.forEach((tc, i) => {
        const result = calculateArticleScore(tc);
        const passed = result.totalScore === tc.expected;
        console.log(`TC-0${i+1}: ${passed ? '✅ PASS' : '❌ FAIL'} (예상: ${tc.expected}, 실제: ${result.totalScore})`);
        if (!passed) allPassed = false;
    });
    
    console.log(allPassed ? '\n✅ 모든 테스트 통과!' : '\n❌ 일부 테스트 실패');
    return allPassed;
}

// 모듈 내보내기 (브라우저 환경)
if (typeof window !== 'undefined') {
    window.SCORE_CONFIG = SCORE_CONFIG;
    window.getPageWeight = getPageWeight;
    window.getLengthWeight = getLengthWeight;
    window.calculateQualityBonus = calculateQualityBonus;
    window.calculateArticleScore = calculateArticleScore;
    window.getScoreGrade = getScoreGrade;
    window.getScoreColorClass = getScoreColorClass;
    window.runTestCases = runTestCases;
}
