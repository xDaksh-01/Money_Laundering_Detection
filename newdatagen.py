import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import uuid

def generate_gather_back_dataset(filename="rift_consolidation_demo.csv"):
    data = []
    base_time = datetime(2026, 2, 19, 10, 0, 0)
    
    # 1. GENERATE GATHER-BACK DIAMONDS (The pattern in your image)
    # 5 distinct "Diamond" structures
    for d_idx in range(5):
        # A few clean accounts originate the money (GREEN)
        sources = [f"Clean_Src_{d_idx}_{i}" for i in range(2)]
        # Intermediate fanning accounts (YELLOW)
        mules = [f"Mule_Layer_{d_idx}_{i}" for i in range(6)]
        # The final gathering point (RED)
        collector = f"Final_Sink_{d_idx}"
        
        # Phase 1: Split money from clean accounts to mules
        for src in sources:
            for mule in mules[:3]: # Half to first 3
                data.append([str(uuid.uuid4())[:8], src, mule, 1500.0, 
                             (base_time + timedelta(minutes=np.random.randint(0, 60))).strftime('%Y-%m-%d %H:%M:%S')])
        
        # Phase 2: Gather money from all mules to one collector
        for mule in mules:
            data.append([str(uuid.uuid4())[:8], mule, collector, 1450.0, 
                         (base_time + timedelta(hours=1, minutes=np.random.randint(0, 60))).strftime('%Y-%m-%d %H:%M:%S')])

    # 2. ADD STANDARD RIFT PATTERNS (Cycles & Smurfing)
    # Cycles (Green -> Yellow -> Red/Green)
    for c in range(3):
        nodes = [f"Cyc_A_{c}", f"Cyc_B_{c}", f"Cyc_C_{c}"]
        for i in range(3):
            data.append([str(uuid.uuid4())[:8], nodes[i], nodes[(i+1)%3], 500.0, base_time.strftime('%Y-%m-%d %H:%M:%S')])

    # 3. FILL WITH NOISE (Up to 10,000 rows)
    while len(data) < 10000:
        s, r = f"User_{np.random.randint(1000, 9999)}", f"User_{np.random.randint(1000, 9999)}"
        data.append([str(uuid.uuid4())[:8], s, r, round(np.random.uniform(10, 2000), 2), 
                     (base_time + timedelta(days=np.random.randint(0, 5))).strftime('%Y-%m-%d %H:%M:%S')])

    df = pd.DataFrame(data, columns=['transaction_id', 'sender_id', 'receiver_id', 'amount', 'timestamp'])
    df.to_csv(filename, index=False)
    print(f"Success! Generated {filename} with complex 'Gather-Back' diamond patterns.")

generate_gather_back_dataset()