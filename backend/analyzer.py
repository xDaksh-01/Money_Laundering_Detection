"""
RIFT 2026 — RiftAnalyzer (Final Stable Version)

Detection Engine:
1. cycle (3–6 nodes only)
2. smurfing_fan_in (10+ within 72h)
3. smurfing_fan_out (10+ within 72h)
4. layered_shell (strict 3+ hop relay chains)
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

    # ─────────────────────────────────────────────
    # ENTRY
    # ─────────────────────────────────────────────
    def detect_patterns(self):
        start = time.time()
        self._detect_cycles()
        self._detect_smurfing_fan_in()
        self._detect_smurfing_fan_out()
        self._detect_shell_networks()
        return self._format_output(start)

    # ─────────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────────
    def _next_rid(self, prefix):
        self.ring_counter[prefix] += 1
        return f"RING_{prefix}_{self.ring_counter[prefix]:03}"

    def _register_ring(self, ring_dict):
        members = set(str(m) for m in ring_dict["member_accounts"])
        mask = (
            self.df["sender_id"].isin(members)
            & self.df["receiver_id"].isin(members)
        )
        ring_dict["total_amount"] = round(
            float(self.df.loc[mask, "amount"].sum()), 2
        )
        ring_dict.setdefault("bridge_nodes", [])
        ring_dict.setdefault("overlap_with", None)
        self.fraud_rings.append(ring_dict)

    def _update_account(self, acc_id, score, pattern, rid, role="layer"):
        acc_id = str(acc_id)
        score = round(min(score, CONFIG["SCORE_CAP"]), 2)

        if acc_id not in self.suspicious_accounts:
            self.suspicious_accounts[acc_id] = {
                "account_id": acc_id,
                "suspicion_score": score,
                "detected_patterns": [pattern],
                "ring_id": rid,
                "role": role,
            }
        else:
            existing = self.suspicious_accounts[acc_id]
            existing["suspicion_score"] = max(
                existing["suspicion_score"], score
            )
            if pattern not in existing["detected_patterns"]:
                existing["detected_patterns"].append(pattern)

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
    # PASS 1 — CYCLES
    # ─────────────────────────────────────────────
    def _detect_cycles(self):
        for scc in nx.strongly_connected_components(self.G):
            size = len(scc)

            if not (CONFIG["CYCLE_MIN"] <= size <= CONFIG["CYCLE_MAX"]):
                continue

            sub = self.G.subgraph(scc)

            if not all(
                sub.in_degree(n) == 1 and sub.out_degree(n) == 1
                for n in scc
            ):
                continue

            nodes = sorted(list(scc))
            rid = self._next_rid("CYC")
            score = min(96.0, 80.0 + size * 4)

            self._register_ring({
                "ring_id": rid,
                "member_accounts": nodes,
                "pattern_type": "cycle",
                "risk_score": round(score, 2),
            })

            for node in nodes:
                self._update_account(
                    node,
                    score,
                    f"cycle_length_{size}",
                    rid,
                    "layer"
                )

    # ─────────────────────────────────────────────
    # PASS 2 — FAN-IN
    # ─────────────────────────────────────────────
    def _detect_smurfing_fan_in(self):
        for receiver, group in self.df.groupby("receiver_id"):

            senders = group["sender_id"].unique()

            if len(senders) < CONFIG["SMURF_MIN"]:
                continue

            if not self._has_dense_window(group["timestamp"]):
                continue

            rid = self._next_rid("FIN")
            score = 90.0
            members = list(senders) + [receiver]

            self._register_ring({
                "ring_id": rid,
                "member_accounts": members,
                "pattern_type": "smurfing_fan_in",
                "risk_score": score,
            })

            for s in senders:
                self._update_account(
                    s, score * 0.65, "smurfing_fan_in", rid, "source"
                )

            self._update_account(
                receiver, score, "smurfing_fan_in", rid, "collector"
            )

    # ─────────────────────────────────────────────
    # PASS 3 — FAN-OUT
    # ─────────────────────────────────────────────
    def _detect_smurfing_fan_out(self):
        for sender, group in self.df.groupby("sender_id"):

            receivers = group["receiver_id"].unique()

            if len(receivers) < CONFIG["SMURF_MIN"]:
                continue

            if not self._has_dense_window(group["timestamp"]):
                continue

            rid = self._next_rid("FOUT")
            score = 90.0
            members = [sender] + list(receivers)

            self._register_ring({
                "ring_id": rid,
                "member_accounts": members,
                "pattern_type": "smurfing_fan_out",
                "risk_score": score,
            })

            self._update_account(
                sender, score, "smurfing_fan_out", rid, "source"
            )

            for r in receivers:
                self._update_account(
                    r, score * 0.7, "smurfing_fan_out", rid, "layer"
                )

    # ─────────────────────────────────────────────
    # PASS 4 — STRICT LAYERED SHELL CHAINS
    # ─────────────────────────────────────────────
    def _detect_shell_networks(self):

        visited = set()

        # Precompute transaction counts per account
        tx_counts = defaultdict(int)
        for sender, receiver in zip(self.df["sender_id"], self.df["receiver_id"]):
            tx_counts[sender] += 1
            tx_counts[receiver] += 1

        for node in self.G.nodes():

            if node in visited:
                continue

            # Start must have exactly 1 outgoing edge
            if self._out_deg.get(node, 0) != 1:
                continue

            chain = [node]
            curr = node

            while True:

                successors = list(self.G.successors(curr))

                if len(successors) != 1:
                    break

                nxt = successors[0]

                if nxt in chain or nxt in visited:
                    break

                chain.append(nxt)
                curr = nxt

                if len(chain) > 10:
                    break

            # Must meet hop requirement
            if len(chain) < CONFIG["SHELL_MIN_HOPS"]:
                continue

            # STRICT FRAUD CONDITION:
            # Intermediate nodes must have 2–3 total transactions
            valid = True

            for mid in chain[1:-1]:
                if tx_counts[mid] < 2 or tx_counts[mid] > 3:
                    valid = False
                    break

            if not valid:
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
                self._update_account(
                    acc,
                    score,
                    f"layered_shell_hops_{len(chain)}",
                    rid
                )

            visited.update(chain)

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