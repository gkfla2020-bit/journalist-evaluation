import urllib.request
import json

SYNC_API = "https://3pxmyosj2eunachemenbx4b6ay0dzqvd.lambda-url.us-east-1.on.aws/"
EVAL_API = "https://yyffk7tpfey7s2kv7hoitskxb40aljqw.lambda-url.us-east-1.on.aws/"

print("=== 동기화 API 테스트 ===")
try:
    r = urllib.request.urlopen(SYNC_API)
    data = json.loads(r.read().decode())
    print(f"상태: OK")
    print(f"기사 수: {len(data.get('articles', []))}")
except Exception as e:
    print(f"오류: {e}")

print("\n=== 평가 API 테스트 ===")
try:
    r = urllib.request.urlopen(EVAL_API)
    data = json.loads(r.read().decode())
    print(f"상태: OK")
    print(f"키 목록: {list(data.keys())[:5]}")
except Exception as e:
    print(f"오류: {e}")
