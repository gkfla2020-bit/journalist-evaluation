---
layout: default
title: "AWS 서버리스 아키텍처로 자동화 시스템 구축하기"
date: 2026-01-15
---

# AWS 서버리스 아키텍처로 자동화 시스템 구축하기

> Lambda + EventBridge + S3 조합으로 서버 관리 없이 자동화 시스템을 구축하는 방법을 정리합니다.

---

## 서버리스란?

서버리스(Serverless)는 서버를 직접 관리하지 않고 클라우드 제공자가 인프라를 관리하는 아키텍처입니다.

### 장점
- 비용 효율: 실행 시간만큼만 과금
- 자동 스케일링: 트래픽에 따라 자동 확장
- 운영 부담 감소: 서버 관리 불필요

---

## Lambda 함수 작성

```python
import boto3
import json
from datetime import datetime, timezone, timedelta

s3 = boto3.client('s3')
KST = timezone(timedelta(hours=9))

def lambda_handler(event, context):
    data = process_data()
    
    s3.put_object(
        Bucket='my-bucket',
        Key='data.json',
        Body=json.dumps(data, ensure_ascii=False),
        ContentType='application/json'
    )
    
    return {'statusCode': 200, 'body': 'Success'}
```

---

## EventBridge 스케줄

매일 오전 6시(KST) 실행:

```
cron(0 21 * * ? *)  # UTC 21시 = KST 06시
```

---

## 비용

소규모 프로젝트는 거의 무료로 운영 가능합니다.

- Lambda: 월 100만 건 무료
- S3: 5GB 무료
- EventBridge: 무료
