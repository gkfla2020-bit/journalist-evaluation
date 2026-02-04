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

    // Lambda API 설정 (배포 시 활성화)
    SYNC_ENABLED: false,
    API_BASE_URL: 'https://3pxmyosj2eunachemenbx4b6ay0dzqvd.lambda-url.us-east-1.on.aws',

    // ========== 기사 평가 ==========
    getEvals() {
        return JSON.parse(localStorage.getItem(this.EVALS_KEY) || '{}');
    },

    saveEval(nsid, data) {
        const evals = this.getEvals();
        const oldData = evals[nsid] || {};
        evals[nsid] = { ...oldData, ...data, updatedAt: new Date().toISOString() };
        localStorage.setItem(this.EVALS_KEY, JSON.stringify(evals));
        
        // Lambda 동기화 (비동기)
        if (this.SYNC_ENABLED) {
            this.syncToServer('eval', nsid, evals[nsid]);
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
        return appeal;
    },

    updateAppeal(appealId, updates) {
        const appeals = JSON.parse(localStorage.getItem(this.APPEALS_KEY) || '[]');
        const index = appeals.findIndex(a => a.id === appealId);
        if (index !== -1) {
            appeals[index] = { ...appeals[index], ...updates, updatedAt: new Date().toISOString() };
            localStorage.setItem(this.APPEALS_KEY, JSON.stringify(appeals));
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
            if (appeal.qualityType === 'EXCLUSIVE') updates.isExclusive = true;
            if (appeal.qualityType === 'FEATURE') updates.isFeature = true;
            if (appeal.qualityType === 'S_GRADE') updates.isSGrade = true;
            if (appeal.qualityType === 'TOP_ARTICLE') updates.isTopArticle = true;
            
            // 기존 평가 데이터 가져와서 점수 재계산
            const existingEval = this.getEval(appeal.nsid) || {};
            const updatedEval = { ...existingEval, ...updates };
            
            // 점수 재계산 (score.js의 calculateArticleScore 사용)
            if (typeof calculateArticleScore === 'function') {
                const scoreResult = calculateArticleScore({
                    page: updatedEval.page || appeal.page || 15,
                    charCount: updatedEval.charCount || appeal.charCount || 0,
                    isTopArticle: updatedEval.isTopArticle || false,
                    isExclusive: updatedEval.isExclusive || false,
                    isFeature: updatedEval.isFeature || false,
                    isSGrade: updatedEval.isSGrade || false
                });
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
        if (saved) return JSON.parse(saved);
        return {
            BASE_SCORE: 10,
            QUALITY_BONUS_CAP: 10,
            MAX_SCORE: 20,
            PAGE_WEIGHTS: { 1: 1.00, 3: 0.85, 5: 0.70, 10: 0.55, 20: 0.40, 32: 0.30 },
            LENGTH_WEIGHTS: { 2000: 1.00, 1200: 0.70, 600: 0.55, 0: 0.55 },
            QUALITY_BONUS: { isTopArticle: 2, isExclusive: 5, isFeature: 5, isSGrade: 3 }
        };
    },

    saveConfig(config, userId, userName, reason) {
        const oldConfig = this.getConfig();
        localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
        
        // 변경 이력 저장
        this.addConfigHistory(oldConfig, config, userId, userName, reason);
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
            const res = await fetch('https://yyffk7tpfey7s2kv7hoitskxb40aljqw.lambda-url.us-east-1.on.aws/?t=' + Date.now());
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

    // ========== 감점 관리 ==========
    
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
        
        // Lambda 동기화
        if (this.SYNC_ENABLED) {
            this.syncToServer('penalty', penalty.id, penalty);
        }
        
        return penalty;
    },
    
    updatePenalty(penaltyId, updates) {
        const penalties = JSON.parse(localStorage.getItem(this.PENALTIES_KEY) || '[]');
        const index = penalties.findIndex(p => p.id === penaltyId);
        if (index !== -1) {
            penalties[index] = { ...penalties[index], ...updates, updatedAt: new Date().toISOString() };
            localStorage.setItem(this.PENALTIES_KEY, JSON.stringify(penalties));
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
            return true;
        }
        return false;
    },
    
    /**
     * 특정 기자의 특정 월 감점 합계 계산
     * @param {string} reporterId - 기자 ID
     * @param {string} yearMonth - 'YYYY-MM' 형식
     * @returns {object} { totalPenalty: number, penalties: array }
     */
    calculatePenaltyForMonth(reporterId, yearMonth) {
        const penalties = this.getPenalties({ reporterId, status: 'ACTIVE' });
        const applicablePenalties = [];
        let totalPenalty = 0;
        
        penalties.forEach(p => {
            // 해당 월이 감점 적용 기간 내인지 확인
            if (yearMonth >= p.startMonth && yearMonth <= p.endMonth) {
                // 시말서(부서)는 해당 월에 한 번만 감점
                if (p.type === 'DEPT_WARNING') {
                    // 이미 같은 유형의 감점이 있는지 확인
                    const existing = applicablePenalties.find(ap => ap.type === 'DEPT_WARNING');
                    if (!existing) {
                        applicablePenalties.push(p);
                        totalPenalty += p.score;
                    }
                } else {
                    applicablePenalties.push(p);
                    totalPenalty += p.score;
                }
            }
        });
        
        return { totalPenalty, penalties: applicablePenalties };
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
    
    // ========== Lambda 동기화 ==========
    
    // 서버로 데이터 전송 (비동기)
    async syncToServer(type, id, data) {
        if (!this.SYNC_ENABLED) return;
        
        try {
            const response = await fetch(`${this.API_BASE_URL}/score/${type}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, data, timestamp: new Date().toISOString() })
            });
            if (!response.ok) throw new Error('Sync failed');
            console.log(`[S-CORE] Synced ${type}:${id}`);
        } catch (err) {
            console.error('[S-CORE] Sync error:', err);
            // 실패 시 로컬에 pending 상태로 저장 (나중에 재시도)
            this.addPendingSync(type, id, data);
        }
    },
    
    // 서버에서 데이터 로드 (새로고침 시)
    async loadFromServer() {
        if (!this.SYNC_ENABLED) return false;
        
        try {
            const response = await fetch(`${this.API_BASE_URL}/score/all?t=${Date.now()}`);
            if (!response.ok) throw new Error('Load failed');
            
            const serverData = await response.json();
            
            // 서버 데이터가 더 최신이면 로컬 업데이트
            if (serverData.evals) {
                const localEvals = this.getEvals();
                const mergedEvals = this.mergeData(localEvals, serverData.evals);
                localStorage.setItem(this.EVALS_KEY, JSON.stringify(mergedEvals));
            }
            
            if (serverData.appeals) {
                const localAppeals = JSON.parse(localStorage.getItem(this.APPEALS_KEY) || '[]');
                const mergedAppeals = this.mergeAppeals(localAppeals, serverData.appeals);
                localStorage.setItem(this.APPEALS_KEY, JSON.stringify(mergedAppeals));
            }
            
            if (serverData.config) {
                localStorage.setItem(this.CONFIG_KEY, JSON.stringify(serverData.config));
            }
            
            localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
            console.log('[S-CORE] Data loaded from server');
            return true;
        } catch (err) {
            console.error('[S-CORE] Load error:', err);
            return false;
        }
    },
    
    // 데이터 병합 (최신 타임스탬프 우선)
    mergeData(local, server) {
        const merged = { ...local };
        for (const key in server) {
            if (!merged[key] || new Date(server[key].updatedAt) > new Date(merged[key].updatedAt || 0)) {
                merged[key] = server[key];
            }
        }
        return merged;
    },
    
    // 소명 데이터 병합
    mergeAppeals(local, server) {
        const merged = [...local];
        const localIds = new Set(local.map(a => a.id));
        
        server.forEach(serverAppeal => {
            if (!localIds.has(serverAppeal.id)) {
                merged.push(serverAppeal);
            } else {
                const idx = merged.findIndex(a => a.id === serverAppeal.id);
                if (idx !== -1 && new Date(serverAppeal.updatedAt || serverAppeal.createdAt) > 
                    new Date(merged[idx].updatedAt || merged[idx].createdAt)) {
                    merged[idx] = serverAppeal;
                }
            }
        });
        
        return merged;
    },
    
    // 실패한 동기화 저장 (나중에 재시도)
    addPendingSync(type, id, data) {
        const pending = JSON.parse(localStorage.getItem('score_pending_sync') || '[]');
        pending.push({ type, id, data, timestamp: new Date().toISOString() });
        localStorage.setItem('score_pending_sync', JSON.stringify(pending.slice(-100))); // 최대 100건
    },
    
    // 대기 중인 동기화 재시도
    async retryPendingSync() {
        if (!this.SYNC_ENABLED) return;
        
        const pending = JSON.parse(localStorage.getItem('score_pending_sync') || '[]');
        if (pending.length === 0) return;
        
        const remaining = [];
        for (const item of pending) {
            try {
                await this.syncToServer(item.type, item.id, item.data);
            } catch {
                remaining.push(item);
            }
        }
        localStorage.setItem('score_pending_sync', JSON.stringify(remaining));
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
