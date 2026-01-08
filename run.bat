@echo off
echo === 기자 성과 측정 시스템 ===
echo.
echo 1. 패키지 설치 중...
pip install -r requirements.txt
echo.
echo 2. 서버 시작...
echo    http://localhost:5000 에서 확인하세요!
echo.
python src/app.py
pause
