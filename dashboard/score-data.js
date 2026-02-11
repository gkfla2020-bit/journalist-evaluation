/**
 * S-CORE 데이터 저장소 모듈
 * localStorage 기반 + Lambda API 동기화 지원
 * 
 * 배포 시 SYNC_ENABLED = true로 변경하면 Lambda와 실시간 동기화
 */

const ScoreDataStore = {
    // Storage Keys
    EVALS_KEY: 'score_article_evals',
    APPEALS_KEY: 'score_appeals',
    CONFIG_KEY: 'score_config',
    CONFIG_HISTORY_KEY: 'score_config_history',
    FEATURE_FLAGS_KEY: 'score_feature_flags',
    PENALTIES_KEY: 'score_penalties',
    DEPT_CONFIG_KEY: 'score_dept_config',
    LAST_SYNC_KEY: 'score_last_sync',

    // Lambda API 설정
    SYNC_ENABLED: true,
    get API_BASE_URL() { return typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.EVAL_API_URL : 'https://yyffk7tpfey7s2kv7hoitskxb40aljqw.lambda-url.us-east-1.on.aws/'; },

    // ========== 기사 평가 ==========
    getEvals() {
        return JSON.parse(localStorage.getItem(this.EVALS_KEY) || '{}');
    },

    saveEval(nsid, data) {
        const evals = this.getEvals();
        const oldData = evals[nsid] || {};
        evals[nsid] = { ...oldData, ...data, updatedAt: new Date().toISOString() };
        localStorage.setItem(this.EVALS_KEY, JSON.stringify(evals));
        
        // Lambda 동기화 (비동기) - 변경된 nsid만 전송
        if (this.SYNC_ENABLED) {
            const payload = {};
            payload[nsid] = evals[nsid];
            this._syncType('evals', payload).catch(e => console.log('[S-CORE] eval sync fail:', e));
        }
        
        return evals[nsid];
    },

    getEval(nsid) {
        const evals = this.getEvals();
        return evals[nsid] || null;
    },
    
    // 확정 상태 확인
    isConfirmed(nsid) {
        const evalData = this.getEval(nsid);
        return evalData && evalData.status === 'CONFIRMED';
    },
    
    // 기사 확정 (확정 후 수정 불가)
    confirmArticle(nsid, userId, userName) {
        if (this.isConfirmed(nsid)) {
            console.warn('이미 확정된 기사입니다:', nsid);
            return null;
        }
        return this.saveEval(nsid, {
            status: 'CONFIRMED',
            confirmedAt: new Date().toISOString(),
            confirmedBy: userId,
            confirmedByName: userName
        });
    },
    
    // 확정 취소 (Admin 전용)
    unconfirmArticle(nsid, userId, reason) {
        const evalData = this.getEval(nsid);
        if (!evalData || evalData.status !== 'CONFIRMED') return null;
        
        return this.saveEval(nsid, {
            status: 'PENDING',
            unconfirmedAt: new Date().toISOString(),
            unconfirmedBy: userId,
            unconfirmReason: reason
        });
    },

    // ========== 소명 관리 ==========
    getAppeals(filter = {}) {
        const appeals = JSON.parse(localStorage.getItem(this.APPEALS_KEY) || '[]');
        return appeals.filter(a => {
            if (filter.reporterId && a.reporterId !== filter.reporterId) return false;
            if (filter.department && a.department !== filter.department) return false;
            if (filter.status && a.status !== filter.status) return false;
            return true;
        });
    },

    createAppeal(appeal) {
        const appeals = JSON.parse(localStorage.getItem(this.APPEALS_KEY) || '[]');
        appeal.id = 'APL-' + Date.now();
        appeal.createdAt = new Date().toISOString();
        appeal.submittedAt = new Date().toISOString();
        appeal.status = 'SUBMITTED';
        appeals.push(appeal);
        localStorage.setItem(this.APPEALS_KEY, JSON.stringify(appeals));
        
        // 서버 동기화
        if (this.SYNC_ENABLED) {
            this._syncType('appeals', appeals).catch(e => console.log('[S-CORE] appeals sync fail:', e));
        }
        
        return appeal;
    },

    updateAppeal(appealId, updates) {
        const appeals = JSON.parse(localStorage.getItem(this.APPEALS_KEY) || '[]');
        const index = appeals.findIndex(a => a.id === appealId);
        if (index !== -1) {
            appeals[index] = { ...appeals[index], ...updates, updatedAt: new Date().toISOString() };
            localStorage.setItem(this.APPEALS_KEY, JSON.stringify(appeals));
            
            // 서버 동기화
            if (this.SYNC_ENABLED) {
                this._syncType('appeals', appeals).catch(e => console.log('[S-CORE] appeals sync fail:', e));
            }
            
            return appeals[index];
        }
        return null;
    },

    reviewAppeal(appealId, managerId, managerName, status, comment) {
        const appeal = this.updateAppeal(appealId, {
            status: status,
            managerId: managerId,
            managerName: managerName,
            managerComment: comment,
            reviewedAt: new Date().toISOString()
        });

        // 승인 시 기사에 가점 반영 + 점수 재계산
        if (status === 'APPROVED' && appeal) {
            const updates = {};
            // 동적 품질 가점 항목 매핑
            const qualityTypeMap = {
                'EXCLUSIVE': 'isExclusive',
                'FEATURE': 'isFeature',
                'S_GRADE': 'isSGrade',
                'A_GRADE': 'isAGrade',
                'TOP_ARTICLE': 'isTopArticle'
            };
            const fieldId = qualityTypeMap[appeal.qualityType];
            if (fieldId) updates[fieldId] = true;
            
            // 기존 평가 데이터 가져와서 점수 재계산
            const existingEval = this.getEval(appeal.nsid) || {};
            const updatedEval = { ...existingEval, ...updates };
            
            // 점수 재계산 (score.js의 calculateArticleScore 사용)
            if (typeof calculateArticleScore === 'function') {
                const scoreInput = {
                    page: updatedEval.page || appeal.page || 15,
                    charCount: updatedEval.charCount || appeal.charCount || 0
                };
                // 동적 품질 가점 항목 로드
                if (typeof getQualityBonusItems === 'function') {
                    getQualityBonusItems().forEach(item => {
                        scoreInput[item.id] = updatedEval[item.id] || false;
                    });
                }
                const scoreResult = calculateArticleScore(scoreInput);
                updates.calculatedScore = scoreResult.totalScore;
                updates.baseScore = scoreResult.baseScore;
                updates.qualityBonus = scoreResult.qualityBonus;
            }
            
            // 확정 상태가 아닌 경우에만 업데이트
            if (existingEval.status !== 'CONFIRMED') {
                this.saveEval(appeal.nsid, updates);
            }
        }

        return appeal;
    },

    // ========== 가중치 설정 ==========
    getConfig() {
        const saved = localStorage.getItem(this.CONFIG_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // v2 → v3 마이그레이션 (score.js의 함수 사용)
            if (typeof migrateConfigV2toV3 === 'function' && !Array.isArray(parsed.PAGE_WEIGHTS)) {
                const migrated = migrateConfigV2toV3(parsed);
                localStorage.setItem(this.CONFIG_KEY, JSON.stringify(migrated));
                return typeof restoreInfinity === 'function' ? restoreInfinity(migrated) : migrated;
            }
            return typeof restoreInfinity === 'function' ? restoreInfinity(parsed) : parsed;
        }
        // 기본값은 score.js의 DEFAULT_CONFIG_V3 사용
        if (typeof DEFAULT_CONFIG_V3 !== 'undefined') {
            return JSON.parse(JSON.stringify(DEFAULT_CONFIG_V3));
        }
        return {
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
    },

    saveConfig(config, userId, userName, reason) {
        const oldConfig = this.getConfig();
        localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
        
        // 변경 이력 저장
        this.addConfigHistory(oldConfig, config, userId, userName, reason);
        
        // 서버 동기화
        if (this.SYNC_ENABLED) {
            this._syncType('config', config).catch(e => console.log('[S-CORE] config sync fail:', e));
        }
        
        return config;
    },

    // ========== 가중치 변경 이력 ==========
    getConfigHistory() {
        return JSON.parse(localStorage.getItem(this.CONFIG_HISTORY_KEY) || '[]');
    },

    addConfigHistory(oldConfig, newConfig, userId, userName, reason) {
        const history = this.getConfigHistory();
        const changes = [];

        // 변경 사항 감지
        const compareObj = (oldObj, newObj, prefix) => {
            for (const key in newObj) {
                if (typeof newObj[key] === 'object') {
                    compareObj(oldObj[key] || {}, newObj[key], `${prefix}.${key}`);
                } else if (oldObj[key] !== newObj[key]) {
                    changes.push({
                        field: `${prefix}.${key}`,
                        oldValue: oldObj[key],
                        newValue: newObj[key]
                    });
                }
            }
        };

        compareObj(oldConfig, newConfig, '');

        if (changes.length > 0) {
            history.unshift({
                id: 'CHG-' + Date.now(),
                changedAt: new Date().toISOString(),
                changedBy: userId,
                changedByName: userName,
                reason: reason || '',
                changes: changes
            });
            // 최근 100건만 유지
            localStorage.setItem(this.CONFIG_HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
        }
        return history;
    },

    // ========== Feature Flags ==========
    getFeatureFlags() {
        const saved = localStorage.getItem(this.FEATURE_FLAGS_KEY);
        if (saved) return JSON.parse(saved);
        return {
            SHOW_MY_SCORE: true,
            SHOW_PREVIOUS_MONTH: true,
            SHOW_DEPT_AVERAGE: false,
            SHOW_DEPT_RANKING: false
        };
    },

    saveFeatureFlags(flags) {
        localStorage.setItem(this.FEATURE_FLAGS_KEY, JSON.stringify(flags));
        
        // 서버 동기화
        if (this.SYNC_ENABLED) {
            this._syncType('flags', flags).catch(e => console.log('[S-CORE] flags sync fail:', e));
        }
        
        return flags;
    },

    // ========== 부서 설정 ==========
    getDeptConfig() {
        const saved = localStorage.getItem(this.DEPT_CONFIG_KEY);
        if (saved) return JSON.parse(saved);
        return {};
    },

    saveDeptConfig(config) {
        localStorage.setItem(this.DEPT_CONFIG_KEY, JSON.stringify(config));
        return config;
    },

    /**
     * 표시 가능한 부서 목록 반환
     * @param {Array} allDepartments - 전체 부서 목록
     * @returns {Array} visible=true인 부서만 반환
     */
    getVisibleDepartments(allDepartments) {
        const config = this.getDeptConfig();
        return allDepartments.filter(d => config[d]?.visible !== false);
    },

    /**
     * 서버에서 부서 설정 로드
     */
    async loadDeptConfigFromServer() {
        try {
            const apiUrl = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.EVAL_API_URL : 'https://yyffk7tpfey7s2kv7hoitskxb40aljqw.lambda-url.us-east-1.on.aws/';
            const res = await fetch(apiUrl + '?t=' + Date.now());
            if (res.ok) {
                const data = await res.json();
                if (data._deptConfig) {
                    this.saveDeptConfig(data._deptConfig);
                    return data._deptConfig;
                }
            }
        } catch (e) {
            console.log('부서 설정 로드 실패:', e);
        }
        return this.getDeptConfig();
    },

    // ========== 가감점 관리 ==========
    
    /**
     * 감점 유형:
     * - DEPT_WARNING: 시말서(부서) -2점, 1개월간 해당 월 한번만 감점
     * - REPEAT_WARNING: 시말서(반복) -5점, 동일 사안 2회 이상 반복 시, 1개월
     * - EDITOR_PENALTY: 편집국장 -5점, 6개월간 매월 감점
     */
    PENALTY_TYPES: {
        DEPT_WARNING: { name: '시말서(부서)', score: -2, duration: 1, description: '부서 단위 시말서' },
        REPEAT_WARNING: { name: '시말서(반복)', score: -5, duration: 1, description: '동일 사안 2회 이상 반복' },
        EDITOR_PENALTY: { name: '편집국장', score: -5, duration: 6, description: '편집국장 감점 (6개월)' }
    },
    
    getPenalties(filter = {}) {
        const penalties = JSON.parse(localStorage.getItem(this.PENALTIES_KEY) || '[]');
        return penalties.filter(p => {
            if (filter.reporterId && p.reporterId !== filter.reporterId) return false;
            if (filter.department && p.department !== filter.department) return false;
            if (filter.status && p.status !== filter.status) return false;
            if (filter.type && p.type !== filter.type) return false;
            return true;
        });
    },
    
    createPenalty(penalty) {
        const penalties = JSON.parse(localStorage.getItem(this.PENALTIES_KEY) || '[]');
        penalty.id = 'PEN-' + Date.now();
        penalty.createdAt = new Date().toISOString();
        penalty.status = 'ACTIVE';
        
        // 적용 시작월 (현재 월)
        const now = new Date();
        penalty.startMonth = penalty.startMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        // 적용 종료월 계산
        const typeInfo = this.PENALTY_TYPES[penalty.type];
        if (typeInfo) {
            const startDate = new Date(penalty.startMonth + '-01');
            startDate.setMonth(startDate.getMonth() + typeInfo.duration - 1);
            penalty.endMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
            penalty.score = typeInfo.score;
        }
        
        penalties.push(penalty);
        localStorage.setItem(this.PENALTIES_KEY, JSON.stringify(penalties));
        
        // 서버 동기화 (전체 배열 전송)
        if (this.SYNC_ENABLED) {
            this._syncType('penalties', penalties).catch(e => console.log('[S-CORE] penalties sync fail:', e));
        }
        
        return penalty;
    },
    
    updatePenalty(penaltyId, updates) {
        const penalties = JSON.parse(localStorage.getItem(this.PENALTIES_KEY) || '[]');
        const index = penalties.findIndex(p => p.id === penaltyId);
        if (index !== -1) {
            penalties[index] = { ...penalties[index], ...updates, updatedAt: new Date().toISOString() };
            localStorage.setItem(this.PENALTIES_KEY, JSON.stringify(penalties));
            
            // 서버 동기화
            if (this.SYNC_ENABLED) {
                this._syncType('penalties', penalties).catch(e => console.log('[S-CORE] penalties sync fail:', e));
            }
            
            return penalties[index];
        }
        return null;
    },
    
    deletePenalty(penaltyId) {
        const penalties = JSON.parse(localStorage.getItem(this.PENALTIES_KEY) || '[]');
        const index = penalties.findIndex(p => p.id === penaltyId);
        if (index !== -1) {
            penalties[index].status = 'DELETED';
            penalties[index].deletedAt = new Date().toISOString();
            localStorage.setItem(this.PENALTIES_KEY, JSON.stringify(penalties));
            
            // 서버 동기화
            if (this.SYNC_ENABLED) {
                this._syncType('penalties', penalties).catch(e => console.log('[S-CORE] penalties sync fail:', e));
            }
            
            return true;
        }
        return false;
    },
    
    /**
     * 특정 기자의 특정 월 가감점 합계 계산 (가점 + 감점 모두 반영)
     * @param {string} reporterId - 기자 ID
     * @param {string} yearMonth - 'YYYY-MM' 형식
     * @returns {object} { totalPenalty: number, penalties: array, bonusTotal: number, deductionTotal: number }
     */
    calculatePenaltyForMonth(reporterId, yearMonth) {
        const penalties = this.getPenalties({ reporterId, status: 'ACTIVE' });
        const applicablePenalties = [];
        let totalPenalty = 0;
        let bonusTotal = 0;
        let deductionTotal = 0;
        
        penalties.forEach(p => {
            // 해당 월이 적용 기간 내인지 확인
            if (yearMonth >= p.startMonth && yearMonth <= p.endMonth) {
                // 기존 시말서(부서) 중복 방지 로직 유지
                if (p.type === 'DEPT_WARNING') {
                    const existing = applicablePenalties.find(ap => ap.type === 'DEPT_WARNING');
                    if (!existing) {
                        applicablePenalties.push(p);
                        totalPenalty += p.score;
                        deductionTotal += p.score;
                    }
                } else {
                    applicablePenalties.push(p);
                    totalPenalty += p.score;
                    if (p.category === 'BONUS' || p.score > 0) {
                        bonusTotal += p.score;
                    } else {
                        deductionTotal += p.score;
                    }
                }
            }
        });
        
        return { totalPenalty, penalties: applicablePenalties, bonusTotal, deductionTotal };
    },
    
    /**
     * 부서 전체의 특정 월 감점 목록
     */
    getDepartmentPenaltiesForMonth(department, yearMonth) {
        const penalties = this.getPenalties({ department, status: 'ACTIVE' });
        return penalties.filter(p => yearMonth >= p.startMonth && yearMonth <= p.endMonth);
    },

    // ========== 데이터 리셋 ==========
    resetAll() {
        localStorage.removeItem(this.EVALS_KEY);
        localStorage.removeItem(this.APPEALS_KEY);
        localStorage.removeItem(this.CONFIG_KEY);
        localStorage.removeItem(this.CONFIG_HISTORY_KEY);
        localStorage.removeItem(this.FEATURE_FLAGS_KEY);
        localStorage.removeItem(this.PENALTIES_KEY);
        localStorage.removeItem(this.LAST_SYNC_KEY);
    },
    
    // ========== Lambda 동기화 (통합 API) ==========
    
    /**
     * 서버에 특정 타입 데이터 저장 (POST {type, data})
     * evals: 병합 방식 (기존 데이터에 새 데이터 merge)
     * penalties, appeals: 배열 전체 교체
     * config, flags, dept_groups: 객체 전체 교체
     */
    async _syncType(type, data) {
        try {
            const res = await fetch(this.API_BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, data })
            });
            if (!res.ok) throw new Error(`Sync ${type} failed: ${res.status}`);
            console.log(`[S-CORE] Synced ${type}`);
            return true;
        } catch (err) {
            console.error('[S-CORE] Sync error:', err);
            this._addPendingSync(type, data);
            return false;
        }
    },
    
    /**
     * 서버에서 전체 데이터 로드 → localStorage 갱신
     * 각 페이지 DOMContentLoaded에서 호출
     */
    async loadAllFromServer() {
        try {
            const res = await fetch(this.API_BASE_URL + '?type=all&t=' + Date.now());
            if (!res.ok) throw new Error('Load all failed: ' + res.status);
            
            const server = await res.json();
            
            // evals: 서버 데이터와 로컬 병합 (서버 우선)
            if (server.evals && Object.keys(server.evals).length > 0) {
                const local = this.getEvals();
                const merged = { ...local };
                for (const key in server.evals) {
                    if (!merged[key] || 
                        new Date(server.evals[key].updatedAt || 0) >= new Date(merged[key].updatedAt || 0)) {
                        merged[key] = server.evals[key];
                    }
                }
                localStorage.setItem(this.EVALS_KEY, JSON.stringify(merged));
            }
            
            // penalties: 서버에 데이터 있으면 로컬과 병합
            if (server.penalties && Array.isArray(server.penalties) && server.penalties.length > 0) {
                const local = JSON.parse(localStorage.getItem(this.PENALTIES_KEY) || '[]');
                const merged = this._mergeArrayById(local, server.penalties);
                localStorage.setItem(this.PENALTIES_KEY, JSON.stringify(merged));
            }
            
            // appeals: 서버에 데이터 있으면 로컬과 병합
            if (server.appeals && Array.isArray(server.appeals) && server.appeals.length > 0) {
                const local = JSON.parse(localStorage.getItem(this.APPEALS_KEY) || '[]');
                const merged = this._mergeArrayById(local, server.appeals);
                localStorage.setItem(this.APPEALS_KEY, JSON.stringify(merged));
            }
            
            // config: 서버에 데이터 있으면 덮어쓰기
            if (server.config && Object.keys(server.config).length > 0) {
                localStorage.setItem(this.CONFIG_KEY, JSON.stringify(server.config));
            }
            
            // flags: 서버에 데이터 있으면 덮어쓰기
            if (server.flags && Object.keys(server.flags).length > 0) {
                localStorage.setItem(this.FEATURE_FLAGS_KEY, JSON.stringify(server.flags));
            }
            
            // dept_groups: 서버에 데이터 있으면 덮어쓰기
            if (server.dept_groups && Object.keys(server.dept_groups).length > 0) {
                localStorage.setItem('dept_group_weights', JSON.stringify(server.dept_groups));
            }
            
            localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
            console.log('[S-CORE] All data loaded from server');
            return true;
        } catch (err) {
            console.error('[S-CORE] Load all error:', err);
            return false;
        }
    },
    
    /**
     * 배열 데이터 병합 (id 기준, 최신 타임스탬프 우선)
     */
    _mergeArrayById(local, server) {
        const map = new Map();
        local.forEach(item => map.set(item.id, item));
        server.forEach(item => {
            const existing = map.get(item.id);
            if (!existing || 
                new Date(item.updatedAt || item.createdAt || 0) >= new Date(existing.updatedAt || existing.createdAt || 0)) {
                map.set(item.id, item);
            }
        });
        return Array.from(map.values());
    },
    
    // 데이터 병합 (최신 타임스탬프 우선) - 기존 호환
    mergeData(local, server) {
        const merged = { ...local };
        for (const key in server) {
            if (!merged[key] || new Date(server[key].updatedAt) > new Date(merged[key].updatedAt || 0)) {
                merged[key] = server[key];
            }
        }
        return merged;
    },
    
    // 소명 데이터 병합 - 기존 호환
    mergeAppeals(local, server) {
        return this._mergeArrayById(local, server);
    },
    
    // 실패한 동기화 저장 (나중에 재시도)
    _addPendingSync(type, data) {
        const pending = JSON.parse(localStorage.getItem('score_pending_sync') || '[]');
        pending.push({ type, data, timestamp: new Date().toISOString() });
        localStorage.setItem('score_pending_sync', JSON.stringify(pending.slice(-50)));
    },
    
    // 대기 중인 동기화 재시도
    async retryPendingSync() {
        const pending = JSON.parse(localStorage.getItem('score_pending_sync') || '[]');
        if (pending.length === 0) return;
        
        const remaining = [];
        for (const item of pending) {
            const ok = await this._syncType(item.type, item.data);
            if (!ok) remaining.push(item);
        }
        localStorage.setItem('score_pending_sync', JSON.stringify(remaining));
    },
    
    // 부서 가중치 서버 저장
    async saveDeptGroupsToServer(deptGroups) {
        localStorage.setItem('dept_group_weights', JSON.stringify(deptGroups));
        if (this.SYNC_ENABLED) {
            return this._syncType('dept_groups', deptGroups);
        }
    },
    
    // 마지막 동기화 시간
    getLastSyncTime() {
        return localStorage.getItem(this.LAST_SYNC_KEY);
    }
};

// 전역 내보내기
if (typeof window !== 'undefined') {
    window.ScoreDataStore = ScoreDataStore;
}
