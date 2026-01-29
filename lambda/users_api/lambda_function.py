import json
import boto3
from datetime import datetime

s3 = boto3.client('s3')
cloudfront = boto3.client('cloudfront')

WEB_BUCKET = 'kpi.sedaily.ai'
DISTRIBUTION_ID = 'E1DJQD9MHS4VRO'

def lambda_handler(event, context):
    """사용자 데이터 저장/조회 API"""
    
    method = event.get('requestContext', {}).get('http', {}).get('method', 'GET')
    
    try:
        if method == 'GET':
            # users.json 조회
            response = s3.get_object(Bucket=WEB_BUCKET, Key='users.json')
            users = json.loads(response['Body'].read().decode('utf-8'))
            return {
                'statusCode': 200,
                'body': json.dumps({'success': True, 'users': users}, ensure_ascii=False)
            }
        
        elif method == 'POST':
            # users.json 저장
            body = json.loads(event.get('body', '{}'))
            users = body.get('users', [])
            
            if not users:
                return {
                    'statusCode': 400,
                    'body': json.dumps({'success': False, 'error': 'users 데이터가 없습니다'})
                }
            
            # S3에 저장
            s3.put_object(
                Bucket=WEB_BUCKET,
                Key='users.json',
                Body=json.dumps(users, ensure_ascii=False, indent=2),
                ContentType='application/json; charset=utf-8'
            )
            
            # CloudFront 캐시 무효화
            cloudfront.create_invalidation(
                DistributionId=DISTRIBUTION_ID,
                InvalidationBatch={
                    'Paths': {'Quantity': 1, 'Items': ['/users.json']},
                    'CallerReference': f'users-{datetime.now().strftime("%Y%m%d%H%M%S")}'
                }
            )
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'success': True,
                    'message': f'{len(users)}명 사용자 데이터 저장 완료',
                    'saved_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }, ensure_ascii=False)
            }
        
        else:
            return {
                'statusCode': 405,
                'body': json.dumps({'success': False, 'error': 'Method not allowed'})
            }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'success': False, 'error': str(e)})
        }
