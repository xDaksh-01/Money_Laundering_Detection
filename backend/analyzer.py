import networkx as nx
import time

class RiftAnalyzer:
    def __init__(self, df):
        self.df = df
        self.G = nx.from_pandas_edgelist(
            df, 'sender_id', 'receiver_id', 
            ['amount', 'timestamp', 'transaction_id'], 
            create_using=nx.MultiDiGraph()
        )
        self.suspicious_accounts = {}
        self.fraud_rings = []
        self.cyc_counter = 1
        self.smurf_counter = 1

    def detect_patterns(self):
        start_time = time.time()
        self._detect_cycles()
        self._detect_smurfing()
        return self._format_output(start_time)

    def _detect_cycles(self):
        """Detects loops and labels them with cycle length."""
        cycles = list(nx.simple_cycles(self.G, length_bound=5))
        for nodes in cycles:
            if len(nodes) >= 3:
                rid = f"RING_CYC_{self.cyc_counter:03}"
                self.cyc_counter += 1
                
                # Combined Pattern: Length + Type
                pattern_label = f"cycle_length_{len(nodes)}"
                score = round(80.0 + (len(nodes) * 4), 2)
                
                self.fraud_rings.append({
                    "ring_id": rid,
                    "member_accounts": list(set(nodes)),
                    "pattern_type": "cycle",
                    "risk_score": score
                })
                
                for node in nodes:
                    self._update_account(node, score, pattern_label, rid)

    def _detect_smurfing(self):
        """Detects 72h bursts and labels roles (High Velocity vs Mule)."""
        for node in self.G.nodes():
            out_edges = self.G.out_edges(node, data=True)
            if len(out_edges) >= 10:
                timestamps = sorted([e[2]['timestamp'] for e in out_edges])
                duration = (max(timestamps) - min(timestamps)).total_seconds()
                
                if duration <= 259200: # 72 hours
                    rid = f"RING_SMURF_{self.smurf_counter:03}"
                    self.smurf_counter += 1
                    
                    velocity_score = round(65.0 + (len(out_edges) * 1.5), 2)
                    
                    self.fraud_rings.append({
                        "ring_id": rid,
                        "member_accounts": list(set([node] + [e[1] for e in out_edges])),
                        "pattern_type": "smurfing",
                        "risk_score": velocity_score
                    })
                    
                    # Tag Source: high_velocity
                    self._update_account(node, velocity_score, "high_velocity", rid)
                    
                    # Tag Receivers: fan_out_mule
                    for _, mule, _ in out_edges:
                        self._update_account(mule, velocity_score * 0.7, "fan_out_mule", rid)

    def _update_account(self, acc_id, score, pattern, rid):
        if acc_id not in self.suspicious_accounts:
            self.suspicious_accounts[acc_id] = {
                "account_id": acc_id,
                "suspicion_score": round(score, 2),
                "detected_patterns": [pattern],
                "ring_id": rid
            }
        else:
            self.suspicious_accounts[acc_id]["suspicion_score"] = max(
                self.suspicious_accounts[acc_id]["suspicion_score"], round(score, 2)
            )
            if pattern not in self.suspicious_accounts[acc_id]["detected_patterns"]:
                self.suspicious_accounts[acc_id]["detected_patterns"].append(pattern)

    def _format_output(self, start):
        return {
            "suspicious_accounts": sorted(
                self.suspicious_accounts.values(), 
                key=lambda x: x['suspicion_score'], 
                reverse=True
            ),
            "fraud_rings": self.fraud_rings,
            "summary": {
                "total_accounts_analyzed": self.G.number_of_nodes(),
                "suspicious_accounts_flagged": len(self.suspicious_accounts),
                "fraud_rings_detected": len(self.fraud_rings),
                "processing_time_seconds": round(time.time() - start, 3)
            }
        }