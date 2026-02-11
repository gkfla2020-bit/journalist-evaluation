"""
Lambda: S-CORE 데이터 저장/불러오기 API (통합)
- GET /?type=evals       → evaluations.json
- GET /?type=penalties    → penalties.json
- GET /?type=appeals      → appeals.json
- GET /?type=config       → score_config.json
- GET /?type=flags        → feature_flags.json
- GET /?type=dept_groups  → dept_groups.json
- GET /?type=all          → 전체 데이터 한번에
- POST (body: {type, data}) → 해당 타입 저장
"""
import boto3
import json
from datetime import datetime, timezone, timedelta
from urllib.parse import parse_qs

s3 = boto3.client('s3')
cloudfront = boto3.client('cloudfront')
BUCKET = 'kpi.sedaily.ai'
CLOUDFRONT_DIST_ID = 'E1DJQD9MHS4VRO'
KST = timezone(timedelta(hours=9))

# 타입별 S3 키 매핑
TYPE_KEY_MAP = {
    'evals': 'evaluations.json',
    'penalties': 'penalties.json',
    'appeals': 'appeals.json',
    'config': 'score_config.json',
    'flags': 'feature_flags.json',
    'dept_groups': 'dept_groups.json'
}

def get_s3_data(key):
    """S3에서 JSON 데이터 읽기"""
    try:
        response = s3.get_object(Bucket=BUCKET, Key=key)
        return json.loads(response['Body'].read().decode('utf-8'))
    except s3.exceptions.NoSuchKey:
        return {} if not key.endswith('penalties.json') and not key.endswith('appeals.json') else []
    except Exception:
        return {} if not key.endswith('penalties.json') and not key.endswith('appeals.json') else []

def put_s3_data(key, data):
    """S3에 JSON 데이터 저장"""
    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8'),
        ContentType='application/json; charset=utf-8',
        CacheControl='no-cache, no-store, must-revalidate'
    )

def invalidate_cache(paths):
    """CloudFront 캐시 무효화"""
    try:
        cloudfront.create_invalidation(
            DistributionId=CLOUDFRONT_DIST_ID,
            InvalidationBatch={
                'Paths': {'Quantity': len(paths), 'Items': paths},
                'CallerReference': f'eval-{datetime.now(KST).strftime("%Y%m%d%H%M%S%f")}'
            }
        )
    except Exception:
        pass


def lambda_handler(event, context):
    method = event.get('requestContext', {}).get('http', {}).get('method', 'GET')
    headers = {'Content-Type': 'application/json'}

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}

    # GET: 데이터 불러오기
    if method == 'GET':
        # 쿼리 파라미터에서 type 추출
        qs = event.get('queryStringParameters') or {}
        raw_qs = event.get('rawQueryString', '')
        data_type = qs.get('type', '')

        # type 파라미터 없으면 기존 호환 (evaluations.json 반환)
        if not data_type or data_type == 'evals':
            data = get_s3_data('evaluations.json')
            return {'statusCode': 200, 'headers': headers,
                    'body': json.dumps(data, ensure_ascii=False)}

        if data_type == 'all':
            # 전체 데이터 한번에 반환
            result = {}
            for t, key in TYPE_KEY_MAP.items():
                result[t] = get_s3_data(key)
            return {'statusCode': 200, 'headers': headers,
                    'body': json.dumps(result, ensure_ascii=False)}

        if data_type in TYPE_KEY_MAP:
            data = get_s3_data(TYPE_KEY_MAP[data_type])
            return {'statusCode': 200, 'headers': headers,
                    'body': json.dumps(data, ensure_ascii=False)}

        return {'statusCode': 400, 'headers': headers,
                'body': json.dumps({'error': f'Unknown type: {data_type}'})}

    # POST: 데이터 저장
    if method == 'POST':
        try:
            body = event.get('body', '{}')
            if isinstance(body, str):
                body = json.loads(body)

            data_type = body.get('type', '')
            data = body.get('data')

            # 기존 호환: type 필드 없으면 evaluations로 처리 (기존 방식)
            if not data_type:
                # 기존 방식: body 자체가 {nsid: {...}, nsid: {...}} 형태
                existing = get_s3_data('evaluations.json')
                existing.update(body)
                put_s3_data('evaluations.json', existing)
                invalidate_cache(['/evaluations.json'])
                return {'statusCode': 200, 'headers': headers,
                        'body': json.dumps({'success': True, 'saved': len(body)})}

            if data_type not in TYPE_KEY_MAP:
                return {'statusCode': 400, 'headers': headers,
                        'body': json.dumps({'error': f'Unknown type: {data_type}'})}

            s3_key = TYPE_KEY_MAP[data_type]

            if data_type == 'evals':
                # evals는 병합 (기존 데이터에 새 데이터 merge)
                existing = get_s3_data(s3_key)
                if isinstance(existing, dict) and isinstance(data, dict):
                    existing.update(data)
                    data = existing

            # penalties, appeals는 배열 전체 교체
            put_s3_data(s3_key, data)
            invalidate_cache([f'/{s3_key}'])

            return {'statusCode': 200, 'headers': headers,
                    'body': json.dumps({'success': True, 'type': data_type},
                                       ensure_ascii=False)}
        except Exception as e:
            return {'statusCode': 500, 'headers': headers,
                    'body': json.dumps({'error': str(e)})}

    return {'statusCode': 405, 'headers': headers,
            'body': json.dumps({'error': 'Method not allowed'})}
