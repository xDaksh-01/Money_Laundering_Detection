import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import uuid

def generate_rift_demo_10k(filename="rift_demo_10k.csv"):
    total_rows = 10000
    data = []
    base_time = datetime(2026, 2, 19, 10, 0, 0)

    # 1. CIRCULAR ROUTING (12 nodes) - 3 distinct rings of 4 hops
    for c_idx in range(3):
        nodes = [f"ACC_CYC_{c_idx}_{i}" for i in range(4)]
        for i in range(4):
            data.append([str(uuid.uuid4())[:8], nodes[i], nodes[(i+1)%4], 1250.0, 
                         (base_time + timedelta(hours=i)).strftime('%Y-%m-%d %H:%M:%S')])

    # 2. SMURFING (30 nodes) - 2 rings (Fan-out)
    for s_idx in range(2):
        sender = f"ACC_SMURF_BOSS_{s_idx}"
        for i in range(14):
            data.append([str(uuid.uuid4())[:8], sender, f"MULE_{s_idx}_{i}", 495.0, 
                         (base_time + timedelta(minutes=i*12)).strftime('%Y-%m-%d %H:%M:%S')])

    # 3. LAYERED SHELL NETWORKS (20 nodes) - 4 chains of 5 hops
    # Intermediate accounts will have exactly 2 transactions (1 in, 1 out)
    for l_idx in range(4):
        curr = f"SHELL_START_{l_idx}"
        for h in range(5):
            receiver = f"SHELL_HOP_{l_idx}_{h}"
            # Slightly decreasing amount to simulate "peeling" within a shell chain
            data.append([str(uuid.uuid4())[:8], curr, receiver, 9000.0 - (h*50), 
                         (base_time + timedelta(days=1, hours=h)).strftime('%Y-%m-%d %H:%M:%S')])
            curr = receiver

    # 4. RANDOM NOISE (Fill remaining 9,938 rows)
    for _ in range(total_rows - len(data)):
        s, r = f"ACC_{np.random.randint(1000, 9999)}", f"ACC_{np.random.randint(1000, 9999)}"
        data.append([str(uuid.uuid4())[:8], s, r, round(np.random.uniform(50, 3000), 2), 
                     (base_time + timedelta(days=np.random.randint(0, 10), seconds=np.random.randint(0, 86400))).strftime('%Y-%m-%d %H:%M:%S')])

    df = pd.DataFrame(data, columns=['transaction_id', 'sender_id', 'receiver_id', 'amount', 'timestamp'])
    df.to_csv(filename, index=False)
    print(f"Success! {filename} generated with {len(df)} rows and 62 targeted fraud nodes.")

generate_rift_demo_10k()