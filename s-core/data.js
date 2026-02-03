/**
 * S-CORE 테스트용 샘플 데이터
 */

// 샘플 기사 데이터
const SAMPLE_ARTICLES = [
    // 경제부 기사
    {
        id: 'ART-2026-001',
        title: '삼성전자, 1분기 실적 전망 "반도체 회복세 뚜렷"',
        reporterId: '211010',
        reporterName: '주재현',
        departmentId: 'DEPT-01',
        department: '경제부',
        publishDate: '2026-01-28',
        page: 1,
        charCount: 2100,
        isTopArticle: true,
        isExclusive: true,
        isFeature: false,
        isSGrade: false,
        status: 'PENDING'
    },
    {
        id: 'ART-2026-002',
        title: '금리 인하 기대감에 코스피 2,800 돌파',
        reporterId: '211010',
        reporterName: '주재현',
        departmentId: 'DEPT-01',
        department: '경제부',
        publishDate: '2026-01-28',
        page: 3,
        charCount: 1800,
        isTopArticle: true,
        isExclusive: false,
        isFeature: false,
        isSGrade: false,
        status: 'PENDING'
    },
    {
        id: 'ART-2026-003',
        title: '현대차, 미국 전기차 공장 증설 검토',
        reporterId: '200101',
        reporterName: '김기자',
        departmentId: 'DEPT-01',
        department: '경제부',
        publishDate: '2026-01-28',
        page: 5,
        charCount: 1500,
        isTopArticle: false,
        isExclusive: false,
        isFeature: false,
        isSGrade: false,
        status: 'PENDING'
    },
    {
        id: 'ART-2026-004',
        title: '원/달러 환율 1,300원대 안착',
        reporterId: '200101',
        reporterName: '김기자',
        departmentId: 'DEPT-01',
        department: '경제부',
        publishDate: '2026-01-28',
        page: 8,
        charCount: 1200,
        isTopArticle: false,
        isExclusive: false,
        isFeature: false,
        isSGrade: false,
        status: 'PENDING'
    },
    {
        id: 'ART-2026-005',
        title: '코스닥 벤처기업 IPO 러시',
        reporterId: '211010',
        reporterName: '주재현',
        departmentId: 'DEPT-01',
        department: '경제부',
        publishDate: '2026-01-27',
        page: 12,
        charCount: 950,
        isTopArticle: false,
        isExclusive: false,
        isFeature: false,
        isSGrade: false,
        status: 'CONFIRMED'
    },
    {
        id: 'ART-2026-006',
        title: '국내 증시 외국인 순매수 지속',
        reporterId: '200101',
        reporterName: '김기자',
        departmentId: 'DEPT-01',
        department: '경제부',
        publishDate: '2026-01-27',
        page: 15,
        charCount: 800,
        isTopArticle: false,
        isExclusive: false,
        isFeature: false,
        isSGrade: false,
        status: 'CONFIRMED'
    },
    // 산업부 기사
    {
        id: 'ART-2026-007',
        title: 'SK하이닉스, HBM 생산량 2배 확대',
        reporterId: '200102',
        reporterName: '이기자',
        departmentId: 'DEPT-02',
        department: '산업부',
        publishDate: '2026-01-28',
        page: 2,
        charCount: 2200,
        isTopArticle: true,
        isExclusive: true,
        isFeature: true,
        isSGrade: false,
        status: 'PENDING'
    },
    {
        id: 'ART-2026-008',
        title: 'LG에너지솔루션, 북미 배터리 공장 가동',
        reporterId: '200102',
        reporterName: '이기자',
        departmentId: 'DEPT-02',
        department: '산업부',
        publishDate: '2026-01-28',
        page: 4,
        charCount: 1600,
        isTopArticle: false,
        isExclusive: false,
        isFeature: true,
        isSGrade: false,
        status: 'PENDING'
    },
    {
        id: 'ART-2026-009',
        title: '조선업계 수주 호황 지속',
        reporterId: '200102',
        reporterName: '이기자',
        departmentId: 'DEPT-02',
        department: '산업부',
        publishDate: '2026-01-27',
        page: 18,
        charCount: 1100,
        isTopArticle: false,
        isExclusive: false,
        isFeature: false,
        isSGrade: false,
        status: 'CONFIRMED'
    },
    {
        id: 'ART-2026-010',
        title: '철강업계 중국발 공급과잉 우려',
        reporterId: '200102',
        reporterName: '이기자',
        departmentId: 'DEPT-02',
        department: '산업부',
        publishDate: '2026-01-26',
        page: 22,
        charCount: 600,
        isTopArticle: false,
        isExclusive: false,
        isFeature: false,
        isSGrade: false,
        status: 'CONFIRMED'
    }
];

// 샘플 소명 데이터
const SAMPLE_APPEALS = [
    {
        id: 'APL-001',
        reporterId: '211010',
        reporterName: '주재현',
        departmentId: 'DEPT-01',
        articleId: 'ART-2026-005',
        articleTitle: '코스닥 벤처기업 IPO 러시',
        appealType: 'QUALITY_APPEAL',
        qualityType: 'EXCLUSIVE',
        reason: '해당 기사는 벤처기업 관계자 단독 인터뷰를 통해 작성된 단독 기사입니다. 타 매체보다 2시간 먼저 보도했습니다.',
        status: 'SUBMITTED',
        createdAt: '2026-01-28T10:30:00',
        submittedAt: '2026-01-28T10:30:00'
    }
];

// 부서 정보
const DEPARTMENTS = [
    { id: 'DEPT-01', name: '경제부', group: '가군', weight: 1.0 },
    { id: 'DEPT-02', name: '산업부', group: '가군', weight: 1.0 },
    { id: 'DEPT-03', name: '정치부', group: '가군', weight: 1.0 },
    { id: 'DEPT-04', name: '사회부', group: '가군', weight: 1.0 },
    { id: 'DEPT-05', name: '문화부', group: '나군', weight: 1.1 },
    { id: 'DEPT-06', name: '스포츠부', group: '나군', weight: 1.1 }
];

// 데이터 저장소 (localStorage 기반)
const DataStore = {
    ARTICLES_KEY: 'score_articles',
    APPEALS_KEY: 'score_appeals',
    
    // 초기화
    init() {
        if (!localStorage.getItem(this.ARTICLES_KEY)) {
            localStorage.setItem(this.ARTICLES_KEY, JSON.stringify(SAMPLE_ARTICLES));
        }
        if (!localStorage.getItem(this.APPEALS_KEY)) {
            localStorage.setItem(this.APPEALS_KEY, JSON.stringify(SAMPLE_APPEALS));
        }
    },
    
    // 기사 조회
    getArticles(filter = {}) {
        const articles = JSON.parse(localStorage.getItem(this.ARTICLES_KEY) || '[]');
        return articles.filter(a => {
            if (filter.reporterId && a.reporterId !== filter.reporterId) return false;
            if (filter.department && a.department !== filter.department) return false;
            if (filter.status && a.status !== filter.status) return false;
            return true;
        });
    },
    
    // 기사 업데이트
    updateArticle(articleId, updates) {
        const articles = JSON.parse(localStorage.getItem(this.ARTICLES_KEY) || '[]');
        const index = articles.findIndex(a => a.id === articleId);
        if (index !== -1) {
            articles[index] = { ...articles[index], ...updates, updatedAt: new Date().toISOString() };
            localStorage.setItem(this.ARTICLES_KEY, JSON.stringify(articles));
            return articles[index];
        }
        return null;
    },
    
    // 기사 확정
    confirmArticle(articleId, managerId) {
        return this.updateArticle(articleId, {
            status: 'CONFIRMED',
            confirmedAt: new Date().toISOString(),
            confirmedBy: managerId
        });
    },
    
    // 전체 확정
    confirmAllArticles(department, managerId) {
        const articles = JSON.parse(localStorage.getItem(this.ARTICLES_KEY) || '[]');
        articles.forEach(a => {
            if (a.department === department && a.status === 'PENDING') {
                a.status = 'CONFIRMED';
                a.confirmedAt = new Date().toISOString();
                a.confirmedBy = managerId;
            }
        });
        localStorage.setItem(this.ARTICLES_KEY, JSON.stringify(articles));
    },
    
    // 소명 조회
    getAppeals(filter = {}) {
        const appeals = JSON.parse(localStorage.getItem(this.APPEALS_KEY) || '[]');
        return appeals.filter(a => {
            if (filter.reporterId && a.reporterId !== filter.reporterId) return false;
            if (filter.departmentId && a.departmentId !== filter.departmentId) return false;
            if (filter.status && a.status !== filter.status) return false;
            return true;
        });
    },
    
    // 소명 생성
    createAppeal(appeal) {
        const appeals = JSON.parse(localStorage.getItem(this.APPEALS_KEY) || '[]');
        appeal.id = 'APL-' + Date.now();
        appeal.createdAt = new Date().toISOString();
        appeal.submittedAt = new Date().toISOString();
        appeal.status = 'SUBMITTED';
        appeals.push(appeal);
        localStorage.setItem(this.APPEALS_KEY, JSON.stringify(appeals));
        return appeal;
    },
    
    // 소명 처리
    reviewAppeal(appealId, managerId, status, comment) {
        const appeals = JSON.parse(localStorage.getItem(this.APPEALS_KEY) || '[]');
        const index = appeals.findIndex(a => a.id === appealId);
        if (index !== -1) {
            appeals[index].status = status;
            appeals[index].managerId = managerId;
            appeals[index].managerComment = comment;
            appeals[index].reviewedAt = new Date().toISOString();
            localStorage.setItem(this.APPEALS_KEY, JSON.stringify(appeals));
            
            // 승인 시 기사에 가점 반영
            if (status === 'APPROVED') {
                const appeal = appeals[index];
                const updates = {};
                if (appeal.qualityType === 'EXCLUSIVE') updates.isExclusive = true;
                if (appeal.qualityType === 'FEATURE') updates.isFeature = true;
                if (appeal.qualityType === 'S_GRADE') updates.isSGrade = true;
                if (appeal.qualityType === 'TOP_ARTICLE') updates.isTopArticle = true;
                this.updateArticle(appeal.articleId, updates);
            }
            
            return appeals[index];
        }
        return null;
    },
    
    // 데이터 리셋
    reset() {
        localStorage.setItem(this.ARTICLES_KEY, JSON.stringify(SAMPLE_ARTICLES));
        localStorage.setItem(this.APPEALS_KEY, JSON.stringify(SAMPLE_APPEALS));
    }
};

// 초기화
DataStore.init();

// 전역 내보내기
if (typeof window !== 'undefined') {
    window.SAMPLE_ARTICLES = SAMPLE_ARTICLES;
    window.SAMPLE_APPEALS = SAMPLE_APPEALS;
    window.DEPARTMENTS = DEPARTMENTS;
    window.DataStore = DataStore;
}
