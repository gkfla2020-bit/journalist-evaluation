/**
 * S-CORE 글로벌 설정 파일
 * API URL, 부서 그룹 등 하드코딩 방지용 중앙 관리
 */

const APP_CONFIG = {
    // Lambda API URLs
    EVAL_API_URL: 'https://yyffk7tpfey7s2kv7hoitskxb40aljqw.lambda-url.us-east-1.on.aws/',
    SYNC_API_URL: 'https://3pxmyosj2eunachemenbx4b6ay0dzqvd.lambda-url.us-east-1.on.aws',
    USERS_API_URL: 'https://aesyomxdaohdy3tykjsbzo6nr40zfnap.lambda-url.us-east-1.on.aws/',

    // 부서 가중치 기본값
    DEFAULT_DEPT_GROUPS: {
        groupA: ['경제부','금융부','건설부동산부','마켓시그널부','산업부','정치부','사회부','국제부','바이오부','테크성장부','생활산업부'],
        groupB: ['문화부','골프스포츠부','여론독자부','사진부','편집부','디지털편집부'],
        groupAWeight: 1.0,
        groupBWeight: 1.1
    },

    // localStorage 키 (참조용)
    STORAGE_KEYS: {
        SESSION: 'kpi_session',
        DEPT_GROUPS: 'dept_group_weights'
    },

    /**
     * 부서 가중치 데이터 가져오기 (localStorage 우선, 없으면 기본값)
     */
    getDeptGroups() {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.DEPT_GROUPS) || 'null') || { ...this.DEFAULT_DEPT_GROUPS };
    }
};

// 전역 내보내기
if (typeof window !== 'undefined') {
    window.APP_CONFIG = APP_CONFIG;
}
