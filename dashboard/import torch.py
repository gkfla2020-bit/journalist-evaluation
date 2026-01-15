import torch
import torch.nn as nn
import numpy as np
import time
import pandas as pd
from tqdm import tqdm

# ==========================================
# 1. 설정 (Hyperparameters)
# ==========================================
NUM_ASSETS = 50       # 종목 수 (예: 암호화폐 50개)
SEQ_LENGTH = 60       # 시퀀스 길이 (과거 60분 데이터로 다음 예측)
INPUT_DIM = 5         # 입력 특성 (Open, High, Low, Close, Volume)
HIDDEN_DIM = 128      # LSTM 은닉층 크기
NUM_LAYERS = 2        # LSTM 레이어 수
OUTPUT_DIM = 1        # 출력 (다음 봉의 수익률 예측)
DATA_SIZE = 10000     # 백테스팅 기간 (샘플 데이터 수)
BATCH_SIZE = 256      # 배치 크기

# ==========================================
# 2. 모델 정의 (LSTM)
# ==========================================
class QuantLSTM(nn.Module):
    def __init__(self, input_dim, hidden_dim, num_layers, output_dim):
        super(QuantLSTM, self).__init__()
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_dim, output_dim)

    def forward(self, x):
        # x shape: (batch_size, seq_length, input_dim)
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_dim).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_dim).to(x.device)
        
        out, _ = self.lstm(x, (h0, c0))
        # 마지막 시점의 hidden state만 사용
        out = self.fc(out[:, -1, :])
        return out

# ==========================================
# 3. 데이터 생성 (Dummy Data)
# ==========================================
def generate_data():
    print(f"Generating synthetic data for {NUM_ASSETS} assets...")
    # (샘플 수, 시퀀스, 특성) 형태의 텐서 생성
    X = torch.randn(DATA_SIZE, SEQ_LENGTH, INPUT_DIM)
    y = torch.randn(DATA_SIZE, OUTPUT_DIM)
    return X, y

# ==========================================
# 4. 벤치마크 함수
# ==========================================
def run_benchmark(device_name, X, y):
    # 장치 설정 (Mac은 'mps', 일반 PC는 'cuda' or 'cpu')
    if device_name == 'mps' and torch.backends.mps.is_available():
        device = torch.device("mps")
        print(">>> Testing on Apple Silicon GPU (MPS)...")
    elif device_name == 'cuda' and torch.cuda.is_available():
        device = torch.device("cuda")
        print(">>> Testing on NVIDIA GPU (CUDA)...")
    else:
        device = torch.device("cpu")
        print(">>> Testing on CPU...")

    # 모델 및 데이터 이동
    model = QuantLSTM(INPUT_DIM, HIDDEN_DIM, NUM_LAYERS, OUTPUT_DIM).to(device)
    X_device = X.to(device)
    y_device = y.to(device)
    
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    
    model.train()
    
    start_time = time.time()
    
    # 배치 단위 학습 시뮬레이션
    steps = DATA_SIZE // BATCH_SIZE
    for _ in tqdm(range(steps), desc=f"Processing on {device_name.upper()}"):
        # 랜덤 배치를 가져온다고 가정
        indices = torch.randint(0, DATA_SIZE, (BATCH_SIZE,))
        batch_X = X_device[indices]
        batch_y = y_device[indices]
        
        # Forward pass
        outputs = model(batch_X)
        loss = criterion(outputs, batch_y)
        
        # Backward pass & Optimize
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        
    end_time = time.time()
    elapsed = end_time - start_time
    
    return elapsed

# ==========================================
# 5. 메인 실행
# ==========================================
if __name__ == "__main__":
    # 데이터 준비
    X, y = generate_data()
    print("-" * 50)

    # 1. CPU 테스트
    cpu_time = run_benchmark('cpu', X, y)
    print(f"CPU Time: {cpu_time:.4f} seconds")
    print("-" * 50)

    # 2. GPU (MPS/CUDA) 테스트
    # Mac 환경에서는 MPS가 자동으로 감지됩니다.
    gpu_target = 'mps' if torch.backends.mps.is_available() else 'cuda'
    gpu_time = run_benchmark(gpu_target, X, y)
    print(f"GPU ({gpu_target.upper()}) Time: {gpu_time:.4f} seconds")
    print("-" * 50)
    
    # 결과 비교
    speedup = cpu_time / gpu_time
    print(f"Result: GPU is {speedup:.2f}x faster than CPU")
    print("-" * 50)