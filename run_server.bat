@echo off
echo ========================================
echo   KPI 시스템 서버 시작
echo ========================================
echo.

cd /d "%~dp0"

REM 가상환경 활성화 (있으면)
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

REM 필요한 패키지 설치
pip install flask flask-cors boto3 -q

REM 서버 시작
echo.
echo 서버 시작중...
echo   - 메인: http://localhost:5000
echo   - 관리: http://localhost:5000/admin
echo   - 기자상세: http://localhost:5000/reporter.html?name=기자명
echo.
python src/app_v2.py

pause

