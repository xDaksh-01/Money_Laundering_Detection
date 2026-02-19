import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import uuid

def generate_traffic_light_data(filename="traffic_light_demo.csv"):
    data = []
    base_time = datetime(2026, 2, 19, 10, 0, 0)

    # 1. 5 CYCLES (20 nodes)
    for c in range(5):
        nodes = [f"SRC_CYC_{c}", f"LYR_CYC_{c}_1", f"LYR_CYC_{c}_2", f"COLL_CYC_{c}"]
        for i in range(4):
            data.append([str(uuid.uuid4())[:8], nodes[i], nodes[(i+1)%4], 1000.0, (base_time + timedelta(hours=i)).strftime('%Y-%m-%d %H:%M:%S')])

    # 2. 2 SMURFING RINGS (1 source -> 12 layers)
    for s in range(2):
        src = f"SRC_SMURF_{s}"
        for i in range(12):
            data.append([str(uuid.uuid4())[:8], src, f"LYR_MULE_{s}_{i}", 450.0, (base_time + timedelta(minutes=i*10)).strftime('%Y-%m-%d %H:%M:%S')])

    # 3. 5 SHELL CHAINS (Source -> 2 Layers -> Collector)
    for l in range(5):
        nodes = [f"SRC_SHELL_{l}", f"LYR_SH1_{l}", f"LYR_SH2_{l}", f"COLL_DEST_{l}"]
        for i in range(3):
            data.append([str(uuid.uuid4())[:8], nodes[i], nodes[i+1], 5000.0, (base_time + timedelta(days=1, hours=i)).strftime('%Y-%m-%d %H:%M:%S')])

    # 4. RANDOM NOISE (Fill to 10k)
    for _ in range(10000 - len(data)):
        s, r = f"ACC_{np.random.randint(1000, 9999)}", f"ACC_{np.random.randint(1000, 9999)}"
        data.append([str(uuid.uuid4())[:8], s, r, round(np.random.uniform(10, 2000), 2), (base_time + timedelta(days=np.random.randint(0, 10))).strftime('%Y-%m-%d %H:%M:%S')])

    pd.DataFrame(data, columns=['transaction_id', 'sender_id', 'receiver_id', 'amount', 'timestamp']).to_csv(filename, index=False)
    print(f"File created: {filename}")

generate_traffic_light_data()