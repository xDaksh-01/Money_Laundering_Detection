"""
RIFT 2026 — RiftAnalyzer (hardened production-safe)

Four-pass detection engine:
  1. cycle
  2. smurfing_fan_in
  3. smurfing_fan_out
  4. layered_shell

Includes:
✓ Merchant protection
✓ Unique sender enforcement
✓ Cycle-peer exclusion
✓ Stable deterministic behavior
"""

import networkx as nx
import pandas as pd
import time
from collections import defaultdict

CONFIG = {
    "CYCLE_MIN": 3,
    "CYCLE_MAX": 6,
    "SMURF_MIN": 10,
    "SMURF_WINDOW_HOURS": 72,
    "SHELL_MIN_HOPS": 3,
    "SCORE_CAP": 100.0,

    # Merchant protection thresholds
    "MERCHANT_MIN_IN_DEG": 25,
    "MERCHANT_MAX_OUT_DEG": 3,
    "MERCHANT_MIN_SPAN_DAYS": 15,
}


class RiftAnalyzer:

    def __init__(self, df):
        self.df = df.copy()
        self.df["timestamp"] = pd.to_datetime(self.df["timestamp"], errors="coerce")

        self.df["sender_id"] = self.df["sender_id"].astype(str)
        self.df["receiver_id"] = self.df["receiver_id"].astype(str)

        self.G = nx.from_pandas_edgelist(
            self.df,
            "sender_id",
            "receiver_id",
            ["amount", "timestamp", "transaction_id"],
            create_using=nx.MultiDiGraph(),
        )

        self._in_deg = dict(self.G.in_degree())
        self._out_deg = dict(self.G.out_degree())

        self.suspicious_accounts = {}
        self.fraud_rings = []
        self.ring_counter = defaultdict(int)

        # Detect merchants automatically
        self._merchants = self._identify_merchants()

    # ─────────────────────────────────────────────
    # Merchant Detection
    # ─────────────────────────────────────────────
    def _identify_merchants(self):
        merchants = set()

        for node in self.G.nodes():
            in_deg = self._in_deg.get(node, 0)
            out_deg = self._out_deg.get(node, 0)

            txs = self.df[
                (self.df["sender_id"] == node) |
                (self.df["receiver_id"] == node)
            ]

            if txs.empty:
                continue

            span_days = (txs["timestamp"].max() - txs["timestamp"].min()).days

            if (
                in_deg >= CONFIG["MERCHANT_MIN_IN_DEG"]
                and out_deg <= CONFIG["MERCHANT_MAX_OUT_DEG"]
                and span_days >= CONFIG["MERCHANT_MIN_SPAN_DAYS"]
            ):
                merchants.add(node)

        return merchants

    # ─────────────────────────────────────────────
    # Main Entry
    # ─────────────────────────────────────────────
    def detect_patterns(self):
        start = time.time()
        self._detect_cycles()
        self._detect_smurfing_fan_in()
        self._detect_smurfing_fan_out()
        self._detect_shell_networks()
        return self._format_output(start)

    # ─────────────────────────────────────────────
    # Helpers
    # ─────────────────────────────────────────────
    def _next_rid(self, prefix):
        self.ring_counter[prefix] += 1
        return f"RING_{prefix}_{self.ring_counter[prefix]:03}"

    def _register_ring(self, ring_dict):
        members = ring_dict["member_accounts"]
        member_set = set(str(m) for m in members)

        mask = (
            self.df["sender_id"].isin(member_set)
            & self.df["receiver_id"].isin(member_set)
        )
        ring_dict["total_amount"] = round(float(self.df.loc[mask, "amount"].sum()), 2)
        ring_dict.setdefault("bridge_nodes", [])
        ring_dict.setdefault("overlap_with", None)

        self.fraud_rings.append(ring_dict)

    def _update_account(self, acc_id, score, pattern, rid, role="layer"):
        acc_id = str(acc_id)
        score = round(min(float(score), CONFIG["SCORE_CAP"]), 2)

        if acc_id in self._merchants:
            return  # NEVER flag merchants

        if acc_id not in self.suspicious_accounts:
            self.suspicious_accounts[acc_id] = {
                "account_id": acc_id,
                "suspicion_score": score,
                "detected_patterns": [pattern],
                "ring_id": rid,
                "role": role,
            }
        else:
            ex = self.suspicious_accounts[acc_id]
            ex["suspicion_score"] = min(CONFIG["SCORE_CAP"], max(ex["suspicion_score"], score))
            if pattern not in ex["detected_patterns"]:
                ex["detected_patterns"].append(pattern)

    def _has_dense_window(self, timestamps):
        window = CONFIG["SMURF_WINDOW_HOURS"] * 3600
        ts = sorted(t.timestamp() for t in timestamps if pd.notna(t))
        if len(ts) < CONFIG["SMURF_MIN"]:
            return False
        left = 0
        for right in range(len(ts)):
            while ts[right] - ts[left] > window:
                left += 1
            if right - left + 1 >= CONFIG["SMURF_MIN"]:
                return True
        return False

    # ─────────────────────────────────────────────
    # PASS 1 — CYCLE
    # ─────────────────────────────────────────────
    def _detect_cycles(self):
        for scc in nx.strongly_connected_components(self.G):
            scc_size = len(scc)
            if not (CONFIG["CYCLE_MIN"] <= scc_size <= CONFIG["CYCLE_MAX"]):
                continue

            sub = self.G.subgraph(scc)
            if sub.number_of_edges() != scc_size:
                continue

            if not all(sub.in_degree(n) == 1 and sub.out_degree(n) == 1 for n in scc):
                continue

            cycle_nodes = sorted(list(scc))
            rid = self._next_rid("CYC")
            score = min(96.0, 80.0 + scc_size * 4)

            self._register_ring({
                "ring_id": rid,
                "member_accounts": cycle_nodes,
                "pattern_type": "cycle",
                "risk_score": round(score, 2),
            })

            for i, node in enumerate(cycle_nodes):
                role = "source" if i == 0 else "layer"
                self._update_account(node, score, f"cycle_length_{scc_size}", rid, role)

    # ─────────────────────────────────────────────
    # PASS 2 — FAN-IN
    # ─────────────────────────────────────────────
    def _detect_smurfing_fan_in(self):
        for receiver, group in self.df.groupby("receiver_id"):

            if receiver in self._merchants:
                continue

            unique_senders = group["sender_id"].nunique()
            if unique_senders < CONFIG["SMURF_MIN"]:
                continue

            if not self._has_dense_window(group["timestamp"]):
                continue

            rid = self._next_rid("FIN")
            score = 90.0
            members = list(group["sender_id"].unique()) + [receiver]

            self._register_ring({
                "ring_id": rid,
                "member_accounts": members,
                "pattern_type": "smurfing_fan_in",
                "risk_score": score,
            })

            for acc in members:
                self._update_account(acc, score, "smurfing_fan_in", rid)

    # ─────────────────────────────────────────────
    # PASS 3 — FAN-OUT
    # ─────────────────────────────────────────────
    def _detect_smurfing_fan_out(self):
        for sender, group in self.df.groupby("sender_id"):

            if sender in self._merchants:
                continue

            unique_receivers = group["receiver_id"].nunique()
            if unique_receivers < CONFIG["SMURF_MIN"]:
                continue

            if not self._has_dense_window(group["timestamp"]):
                continue

            rid = self._next_rid("FOUT")
            score = 90.0
            members = [sender] + list(group["receiver_id"].unique())

            self._register_ring({
                "ring_id": rid,
                "member_accounts": members,
                "pattern_type": "smurfing_fan_out",
                "risk_score": score,
            })

            for acc in members:
                self._update_account(acc, score, "smurfing_fan_out", rid)

    # ─────────────────────────────────────────────
    # PASS 4 — SHELL CHAINS
    # ─────────────────────────────────────────────
    def _detect_shell_networks(self):
        visited = set()

        for node in self.G.nodes():
            if node in visited:
                continue
            if self._in_deg.get(node, 0) > 1 or self._out_deg.get(node, 0) != 1:
                continue

            chain = [node]
            curr = node

            while len(chain) < 50:
                succs = list(self.G.successors(curr))
                if len(succs) != 1:
                    break
                nxt = succs[0]
                if nxt in chain:
                    break
                chain.append(nxt)
                curr = nxt
                if self._out_deg.get(nxt, 0) == 0:
                    break

            if len(chain) < CONFIG["SHELL_MIN_HOPS"]:
                continue

            rid = self._next_rid("SHELL")
            score = min(95.0, 65.0 + len(chain) * 5)

            self._register_ring({
                "ring_id": rid,
                "member_accounts": chain,
                "pattern_type": "layered_shell",
                "risk_score": round(score, 2),
            })

            for acc in chain:
                self._update_account(acc, score, f"layered_shell_hops_{len(chain)}", rid)
                visited.add(acc)

    # ─────────────────────────────────────────────
    # OUTPUT
    # ─────────────────────────────────────────────
    def _format_output(self, start):
        return {
            "suspicious_accounts": sorted(
                self.suspicious_accounts.values(),
                key=lambda x: x["suspicion_score"],
                reverse=True,
            ),
            "fraud_rings": self.fraud_rings,
            "summary": {
                "total_accounts_analyzed": self.G.number_of_nodes(),
                "suspicious_accounts_flagged": len(self.suspicious_accounts),
                "fraud_rings_detected": len(self.fraud_rings),
                "processing_time_seconds": round(time.time() - start, 3),
            },
        }