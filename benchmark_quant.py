"""
퀀트/딥러닝 벤치마크 테스트
윈도우 vs 맥북 성능 비교용
"""
import time
import platform
import numpy as np

print("=" * 50)
print(f"시스템: {platform.system()} {platform.machine()}")
print(f"프로세서: {platform.processor()}")
print("=" * 50)

# 1. NumPy 행렬 연산 벤치마크
print("\n[1] NumPy 행렬 연산 (5000x5000)")
start = time.time()
a = np.random.randn(5000, 5000)
b = np.random.randn(5000, 5000)
c = np.dot(a, b)
numpy_time = time.time() - start
print(f"소요 시간: {numpy_time:.2f}초")

# 2. PyTorch 딥러닝 벤치마크
try:
    import torch
    import torch.nn as nn
    
    device = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\n[2] PyTorch 딥러닝 (device: {device})")
    
    # 간단한 신경망
    model = nn.Sequential(
        nn.Linear(1000, 2000),
        nn.ReLU(),
        nn.Linear(2000, 2000),
        nn.ReLU(),
        nn.Linear(2000, 1000),
    ).to(device)
    
    x = torch.randn(1000, 1000).to(device)
    
    # 워밍업
    for _ in range(10):
        _ = model(x)
    
    # 벤치마크
    start = time.time()
    for _ in range(100):
        _ = model(x)
    if device != "cpu":
        torch.cuda.synchronize() if device == "cuda" else torch.mps.synchronize()
    pytorch_time = time.time() - start
    print(f"100회 추론 소요 시간: {pytorch_time:.2f}초")
    
    # 학습 벤치마크
    print("\n[3] PyTorch 학습 (LSTM 시계열)")
    
    lstm = nn.LSTM(input_size=50, hidden_size=128, num_layers=2, batch_first=True).to(device)
    fc = nn.Linear(128, 1).to(device)
    optimizer = torch.optim.Adam(list(lstm.parameters()) + list(fc.parameters()), lr=0.001)
    criterion = nn.MSELoss()
    
    # 가상 주가 데이터 (배치 64, 시퀀스 100, 피처 50)
    train_x = torch.randn(64, 100, 50).to(device)
    train_y = torch.randn(64, 1).to(device)
    
    start = time.time()
    for epoch in range(50):
        optimizer.zero_grad()
        out, _ = lstm(train_x)
        pred = fc(out[:, -1, :])
        loss = criterion(pred, train_y)
        loss.backward()
        optimizer.step()
    if device != "cpu":
        torch.cuda.synchronize() if device == "cuda" else torch.mps.synchronize()
    lstm_time = time.time() - start
    print(f"50 에폭 학습 소요 시간: {lstm_time:.2f}초")

except ImportError:
    print("\n[!] PyTorch 미설치 - pip install torch")
    pytorch_time = None
    lstm_time = None

# 3. 판다스 데이터 처리
try:
    import pandas as pd
    
    print("\n[4] Pandas 대용량 데이터 처리")
    start = time.time()
    df = pd.DataFrame({
        'date': pd.date_range('2000-01-01', periods=1000000, freq='T'),
        'open': np.random.randn(1000000).cumsum() + 100,
        'high': np.random.randn(1000000).cumsum() + 101,
        'low': np.random.randn(1000000).cumsum() + 99,
        'close': np.random.randn(1000000).cumsum() + 100,
        'volume': np.random.randint(1000, 100000, 1000000)
    })
    df['ma20'] = df['close'].rolling(20).mean()
    df['ma60'] = df['close'].rolling(60).mean()
    df['rsi'] = df['close'].pct_change().rolling(14).apply(lambda x: 100 - 100/(1 + (x[x>0].sum() / abs(x[x<0].sum()) if x[x<0].sum() != 0 else 1)))
    df['signal'] = np.where(df['ma20'] > df['ma60'], 1, -1)
    pandas_time = time.time() - start
    print(f"100만 행 처리 소요 시간: {pandas_time:.2f}초")

except ImportError:
    print("\n[!] Pandas 미설치")
    pandas_time = None

# 결과 요약
print("\n" + "=" * 50)
print("📊 벤치마크 결과 요약")
print("=" * 50)
print(f"NumPy 행렬곱 (5000x5000): {numpy_time:.2f}초")
if pytorch_time:
    print(f"PyTorch 추론 (100회): {pytorch_time:.2f}초")
if lstm_time:
    print(f"LSTM 학습 (50에폭): {lstm_time:.2f}초")
if pandas_time:
    print(f"Pandas 처리 (100만행): {pandas_time:.2f}초")
print("=" * 50)
