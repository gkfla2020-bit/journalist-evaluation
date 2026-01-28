"""
Lambda: 평가 데이터 저장/불러오기 API
- GET: S3에서 evaluations.json 불러오기
- POST: S3에 evaluations.json 저장
"""
import boto3
import json
from datetime import datetime, timezone, timedelta

s3 = boto3.client('s3')
cloudfront = boto3.client('cloudfront')
BUCKET = 'kpi.sedaily.ai'
KEY = 'evaluations.json'
CLOUDFRONT_DIST_ID = 'E1DJQD9MHS4VRO'
KST = timezone(timedelta(hours=9))

def lambda_handler(event, context):
    method = event.get('requestContext', {}).get('http', {}).get('method', 'GET')
    
    # 헤더 (CORS는 Function URL에서 처리)
    headers = {
        'Content-Type': 'application/json'
    }
    
    # OPTIONS (preflight)
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}
    
    # GET: 평가 데이터 불러오기
    if method == 'GET':
        try:
            response = s3.get_object(Bucket=BUCKET, Key=KEY)
            data = json.loads(response['Body'].read().decode('utf-8'))
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(data, ensure_ascii=False)
            }
        except s3.exceptions.NoSuchKey:
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({}, ensure_ascii=False)
            }
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': str(e)})
            }
    
    # POST: 평가 데이터 저장
    if method == 'POST':
        try:
            body = event.get('body', '{}')
            if isinstance(body, str):
                data = json.loads(body)
            else:
                data = body
            
            # 기존 데이터 불러오기
            try:
                response = s3.get_object(Bucket=BUCKET, Key=KEY)
                existing = json.loads(response['Body'].read().decode('utf-8'))
            except:
                existing = {}
            
            # 새 데이터 병합
            existing.update(data)
            
            # S3에 저장
            s3.put_object(
                Bucket=BUCKET,
                Key=KEY,
                Body=json.dumps(existing, ensure_ascii=False, indent=2),
                ContentType='application/json; charset=utf-8',
                CacheControl='no-cache, no-store, must-revalidate'
            )
            
            # CloudFront 캐시 무효화
            try:
                cloudfront.create_invalidation(
                    DistributionId=CLOUDFRONT_DIST_ID,
                    InvalidationBatch={
                        'Paths': {'Quantity': 1, 'Items': ['/evaluations.json']},
                        'CallerReference': f'eval-{datetime.now(KST).strftime("%Y%m%d%H%M%S")}'
                    }
                )
            except:
                pass
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({'success': True, 'saved': len(data)}, ensure_ascii=False)
            }
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': str(e)})
            }
    
    return {
        'statusCode': 405,
        'headers': headers,
        'body': json.dumps({'error': 'Method not allowed'})
    }
