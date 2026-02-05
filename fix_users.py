import json
import pandas as pd

# 엑셀에서 사번을 문자열로 읽기 (앞의 0 유지)
df = pd.read_excel('편집국기자_20260204.xlsx', dtype={'사번': str})

# 부서명 정규화 함수
def normalize_dept(dept):
    if pd.isna(dept):
        return ''
    # "편집국 경제부" -> "경제부"
    dept = str(dept).replace('편집국 ', '').replace('편집국', '')
    # "AX콘텐츠랩 디지털편집부" -> "디지털편집부"
    if 'AX콘텐츠랩' in dept and '디지털편집부' in dept:
        return '디지털편집부'
    if 'AX콘텐츠랩' in dept:
        return 'AX콘텐츠랩'
    # "편집부 디자인팀" -> "디자인팀"
    if '편집부' in dept and '디자인팀' in dept:
        return '디자인팀'
    return dept.strip()

# (이름, 부서) -> 사번 매핑
excel_map = {}
for _, row in df.iterrows():
    emp_id = row['사번']
    name = row['성명']
    dept = normalize_dept(row['부서'])
    excel_map[(name, dept)] = emp_id

# users.json 다시 읽기 (원본에서)
# 먼저 원본 백업에서 복원하거나 새로 생성
with open('dashboard/users.json', encoding='utf-8') as f:
    users = json.load(f)

# 수정된 사번 목록
changes = []
not_found = []

for user in users:
    if user['id'] == 'admin':
        continue
    
    name = user['name']
    dept = user['department']
    old_id = user['id']
    
    # 엑셀에서 해당 (이름, 부서)의 사번 찾기
    key = (name, dept)
    if key in excel_map:
        new_id = excel_map[key]
        if old_id != new_id:
            changes.append(f"{name}({dept}): {old_id} -> {new_id}")
            user['id'] = new_id
            user['emp_id'] = new_id
    else:
        not_found.append(f"{name}({dept}): {old_id}")

# 저장
with open('dashboard/users.json', 'w', encoding='utf-8') as f:
    json.dump(users, f, ensure_ascii=False, indent=2)

print(f"총 {len(changes)}건 사번 수정됨:")
for c in changes:
    print(c)

if not_found:
    print(f"\n엑셀에서 찾지 못한 사용자 {len(not_found)}명:")
    for nf in not_found:
        print(nf)
