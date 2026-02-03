/**
 * S-CORE 공통 JavaScript - 로딩, 에러 처리, 유틸리티
 */

const SCore = {
    // ===== 로딩 오버레이 =====
    showLoading: function(message = '데이터를 불러오는 중...') {
        let overlay = document.getElementById('loadingOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            `;
            document.body.appendChild(overlay);
        } else {
            overlay.querySelector('.loading-text').textContent = message;
            overlay.classList.remove('hidden');
        }
    },

    hideLoading: function() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    },

    // ===== 인라인 로딩 (테이블 등) =====
    showInlineLoading: function(containerId, colspan = 1) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <tr>
                    <td colspan="${colspan}" class="loading-inline">
                        <div class="spinner-sm"></div>
                        <span>데이터를 불러오는 중...</span>
                    </td>
                </tr>
            `;
        }
    },

    // ===== 에러 표시 =====
    showError: function(containerId, options = {}) {
        const {
            title = '데이터를 불러올 수 없습니다',
            message = '네트워크 연결을 확인하고 다시 시도해주세요.',
            retryCallback = null,
            colspan = 1,
            isTable = true
        } = options;

        const container = document.getElementById(containerId);
        if (!container) return;

        const errorHtml = `
            <div class="error-container">
                <div class="error-icon"><i class="bi bi-exclamation-triangle"></i></div>
                <div class="error-title">${title}</div>
                <div class="error-message">${message}</div>
                ${retryCallback ? '<button class="btn btn-outline-primary error-retry-btn" onclick="' + retryCallback + '"><i class="bi bi-arrow-clockwise me-1"></i>다시 시도</button>' : ''}
            </div>
        `;

        if (isTable) {
            container.innerHTML = `<tr><td colspan="${colspan}">${errorHtml}</td></tr>`;
        } else {
            container.innerHTML = errorHtml;
        }
    },

    // ===== 토스트 메시지 =====
    toast: function(message, type = 'success') {
        // 기존 토스트 컨테이너 확인 또는 생성
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }

        // 타입별 설정
        const typeConfig = {
            success: { bg: 'success', icon: 'check-circle' },
            error: { bg: 'danger', icon: 'exclamation-triangle' },
            warning: { bg: 'warning', icon: 'exclamation-circle', textClass: 'text-dark' },
            info: { bg: 'info', icon: 'info-circle' }
        };

        const config = typeConfig[type] || typeConfig.success;

        // 에러 메시지 개선
        let displayMessage = message;
        if (type === 'error') {
            displayMessage = this.getErrorMessage(message);
        }

        // 토스트 생성
        const toastId = 'toast-' + Date.now();
        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center text-bg-${config.bg} ${config.textClass || ''} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        <i class="bi bi-${config.icon} me-2"></i>${displayMessage}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="닫기"></button>
                </div>
            </div>
        `;

        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastEl = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastEl, { delay: type === 'error' ? 5000 : 3000 });
        toast.show();

        // 토스트 제거
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    },

    // ===== 에러 메시지 변환 =====
    getErrorMessage: function(error) {
        // 일반적인 에러 메시지를 사용자 친화적으로 변환
        const errorMap = {
            'Failed to fetch': '서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.',
            'NetworkError': '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
            'TypeError': '데이터 처리 중 오류가 발생했습니다.',
            '401': '로그인이 필요합니다. 다시 로그인해주세요.',
            '403': '접근 권한이 없습니다.',
            '404': '요청한 데이터를 찾을 수 없습니다.',
            '500': '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
            '502': '서버가 응답하지 않습니다. 잠시 후 다시 시도해주세요.',
            '503': '서비스가 일시적으로 중단되었습니다. 잠시 후 다시 시도해주세요.'
        };

        if (typeof error === 'string') {
            for (const [key, value] of Object.entries(errorMap)) {
                if (error.includes(key)) {
                    return value;
                }
            }
            return error;
        }

        if (error instanceof Error) {
            for (const [key, value] of Object.entries(errorMap)) {
                if (error.message.includes(key) || error.name.includes(key)) {
                    return value;
                }
            }
            return error.message || '알 수 없는 오류가 발생했습니다.';
        }

        return '알 수 없는 오류가 발생했습니다.';
    },

    // ===== 버튼 로딩 상태 =====
    setButtonLoading: function(button, loading = true) {
        if (typeof button === 'string') {
            button = document.querySelector(button);
        }
        if (!button) return;

        if (loading) {
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = `<span class="btn-text">${button.innerHTML}</span>`;
            button.classList.add('btn-loading');
            button.disabled = true;
        } else {
            button.innerHTML = button.dataset.originalText || button.innerHTML;
            button.classList.remove('btn-loading');
            button.disabled = false;
        }
    },

    // ===== API 호출 래퍼 =====
    async fetch: async function(url, options = {}) {
        const {
            showLoadingOverlay = false,
            loadingMessage = '데이터를 불러오는 중...',
            showErrorToast = true
        } = options;

        if (showLoadingOverlay) {
            this.showLoading(loadingMessage);
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(response.status.toString());
            }

            return await response.json();
        } catch (error) {
            if (showErrorToast) {
                this.toast(error, 'error');
            }
            throw error;
        } finally {
            if (showLoadingOverlay) {
                this.hideLoading();
            }
        }
    },

    // ===== 디바운스 =====
    debounce: function(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // ===== 모바일 감지 =====
    isMobile: function() {
        return window.innerWidth <= 768;
    },

    // ===== HTML 이스케이프 =====
    escapeHtml: function(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    },

    // ===== 날짜 포맷 =====
    formatDate: function(date, format = 'YYYY-MM-DD') {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day);
    },

    // ===== 숫자 포맷 =====
    formatNumber: function(num) {
        return num.toLocaleString('ko-KR');
    }
};

// 전역 에러 핸들러
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    SCore.toast(event.reason, 'error');
});

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 모바일에서 테이블 컬럼 숨김 처리
    if (SCore.isMobile()) {
        document.querySelectorAll('.hide-on-mobile').forEach(el => {
            el.style.display = 'none';
        });
    }
});
