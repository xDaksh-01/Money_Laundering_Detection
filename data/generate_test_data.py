import pandas as pd
import uuid
import random
from datetime import datetime, timedelta

def generate_realistic_rift_data(filename="data/test_input.csv", num_noise=10000):
    transactions = []
    # Base starting point for the dataset
    start_date = datetime(2026, 2, 1, 8, 30, 0)

    def gen_id(): return f"ACC_{uuid.uuid4().hex[:8].upper()}"
    def gen_tx(): return f"TX_{uuid.uuid4().hex[:10].upper()}"

    # --- 1. PATTERN: THE HIGH-VELOCITY CYCLE (3 Hops) ---
    # Money moves through A -> B -> C -> A within 45 minutes
    c_nodes = [gen_id() for _ in range(3)]
    for i in range(3):
        # Sequential hops with 10-15 min delay
        ts = start_date + timedelta(minutes=i * random.randint(10, 15))
        transactions.append({
            "transaction_id": gen_tx(),
            "sender_id": c_nodes[i],
            "receiver_id": c_nodes[(i + 1) % 3],
            "amount": 12500.00 - (i * 5), # Subtle "peeling" or fees
            "timestamp": ts.strftime('%Y-%m-%d %H:%M:%S')
        })

    # --- 2. PATTERN: THE 72-HOUR SMURFING BURST (Fan-out) ---
    # 1 Source -> 15 Mules. All transactions within a 12-hour window.
    source = gen_id()
    smurf_start = start_date + timedelta(days=2)
    for i in range(15):
        # High frequency: transactions every 5-30 minutes
        ts = smurf_start + timedelta(minutes=i * random.randint(5, 30))
        transactions.append({
            "transaction_id": gen_tx(),
            "sender_id": source,
            "receiver_id": gen_id(),
            "amount": round(random.uniform(450, 495), 2), # Just below $500 threshold
            "timestamp": ts.strftime('%Y-%m-%d %H:%M:%S')
        })

    # --- 3. PATTERN: THE LAYERED SHELL (4 Hops) ---
    # Linear chain: S -> M1 -> M2 -> M3 -> D (Low count accounts)
    shell_nodes = [gen_id() for _ in range(5)]
    for i in range(4):
        ts = start_date + timedelta(days=4, hours=i*6)
        transactions.append({
            "transaction_id": gen_tx(),
            "sender_id": shell_nodes[i],
            "receiver_id": shell_nodes[i+1],
            "amount": 8000.00,
            "timestamp": ts.strftime('%Y-%m-%d %H:%M:%S')
        })

    # --- 4. NOISE: RANDOM LEGITIMATE TRAFFIC (10k Rows) ---
    # Spread randomly across 10 days with random hours/mins/secs
    for _ in range(num_noise):
        random_day = random.randint(0, 10)
        random_hour = random.randint(0, 23)
        random_min = random.randint(0, 59)
        random_sec = random.randint(0, 59)
        ts = start_date + timedelta(days=random_day, hours=random_hour, minutes=random_min, seconds=random_sec)
        
        transactions.append({
            "transaction_id": gen_tx(),
            "sender_id": gen_id(),
            "receiver_id": gen_id(),
            "amount": round(random.uniform(5, 5000), 2),
            "timestamp": ts.strftime('%Y-%m-%d %H:%M:%S')
        })

    df = pd.DataFrame(transactions)
    # Shuffle so fraud isn't all at the top of the file
    df = df.sample(frac=1).reset_index(drop=True)
    df.to_csv(filename, index=False)
    print(f"✅ Created {filename} with {len(df)} realistic transactions.")

if __name__ == "__main__":
    generate_realistic_rift_data()