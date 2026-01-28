import pandas as pd
import json

df = pd.read_excel('기자 지면 기여도 평가 관리 시스템(S-CORE) 사용자 계정 관련.xlsx')

users = []

# admin 계정 추가
users.append({
    'id': 'admin',
    'password': '1234',
    'name': '관리자',
    'department': '전체',
    'role': 'admin',
    'position': '관리자',
    'email': 'admin@sedaily.com'
})

for _, row in df.iterrows():
    dept = str(row['부서']).strip()
    emp_id = str(row['사번']).strip()
    name = str(row['이름']).strip()
    position = str(row['직급/직책']).strip() if pd.notna(row['직급/직책']) else ''
    email = str(row['이메일(@sedaily.com)']).strip() if pd.notna(row['이메일(@sedaily.com)']) else ''
    
    # 역할 판별: 부장/국장/실장/팀장 포함시 manager, 아니면 reporter
    if any(x in position for x in ['부장', '국장', '실장', '팀장', '랩장', '본부장']):
        role = 'manager'
    else:
        role = 'reporter'
    
    users.append({
        'id': emp_id,  # 사번을 ID로
        'password': '1234',
        'name': name,
        'department': dept,
        'role': role,
        'position': position,
        'email': f'{email}@sedaily.com',
        'emp_id': emp_id
    })

print(f'총 {len(users)}명 사용자')
print(f'admin: 1명')
manager_count = len([u for u in users if u['role'] == 'manager'])
reporter_count = len([u for u in users if u['role'] == 'reporter'])
print(f'manager: {manager_count}명')
print(f'reporter: {reporter_count}명')

with open('dashboard/users.json', 'w', encoding='utf-8') as f:
    json.dump(users, f, ensure_ascii=False, indent=2)
print('dashboard/users.json 생성 완료')
