@echo off
chcp 65001 > nul
echo ========================================
echo  KPI 데이터 동기화 및 S3 배포
echo ========================================
echo.

echo [1/3] S3에서 최신 XML 가져와서 data.json 생성...
python src/generate_data.py
if errorlevel 1 (
    echo 오류: data.json 생성 실패
    pause
    exit /b 1
)

echo.
echo [2/3] S3에 파일 업로드...
aws s3 cp dashboard/data.json s3://kpi.sedaily.ai/data.json --content-type "application/json; charset=utf-8"
aws s3 cp dashboard/list.html s3://kpi.sedaily.ai/list.html --content-type "text/html; charset=utf-8"
aws s3 cp dashboard/reporter.html s3://kpi.sedaily.ai/reporter.html --content-type "text/html; charset=utf-8"

echo.
echo [3/3] 완료!
echo ========================================
echo  배포 완료: http://kpi.sedaily.ai
echo ========================================
pause
