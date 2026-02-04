@echo off
echo === S3 배포 시작 ===
aws s3 sync dashboard/ s3://kpi.sedaily.ai/ --delete
echo.
echo === CloudFront 캐시 무효화 ===
aws cloudfront create-invalidation --distribution-id E1DJQD9MHS4VRO --paths "/*"
echo.
echo === 배포 완료 ===
pause
