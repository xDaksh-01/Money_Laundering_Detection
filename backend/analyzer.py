import networkx as nx
import pandas as pd
import time
from collections import defaultdict

CONFIG = {
    "CYCLE_MIN": 3,
    "CYCLE_MAX": 5,
    "SMURF_MIN": 10,
    "SMURF_WINDOW_HOURS": 72,
    "SHELL_MIN_HOPS": 3,
    "SHELL_MIN_TOTAL_TX": 2,
    "SHELL_MAX_TOTAL_TX": 3,
    "MERCHANT_IN_DEG": 30,
    "MERCHANT_OUT_DEG": 3,
    "MERCHANT_MIN_SPAN_DAYS": 30,
    "SCORE_CAP": 100.0,
}

class RiftAnalyzer:

    def __init__(self, df):

        self.df = df.copy()
        self.df["timestamp"] = pd.to_datetime(self.df["timestamp"])

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

        self._ring_members = {}
        self._account_rings = defaultdict(list)
        self._cycle_members = set()

        self.ring_counter = defaultdict(int)

        self._identify_merchants()

    # ───────────────── UTILITIES ───────────────── #

    def _identify_merchants(self):
        self._merchants = set()

        for acc in sorted(self.G.nodes()):
            in_d = self._in_deg.get(acc, 0)
            out_d = self._out_deg.get(acc, 0)

            txs = self.df[
                (self.df["sender_id"] == acc) |
                (self.df["receiver_id"] == acc)
            ]

            if txs.empty:
                continue

            span_days = (txs["timestamp"].max() - txs["timestamp"].min()).days

            if (
                in_d >= CONFIG["MERCHANT_IN_DEG"]
                and out_d <= CONFIG["MERCHANT_OUT_DEG"]
                and span_days >= CONFIG["MERCHANT_MIN_SPAN_DAYS"]
            ):
                self._merchants.add(acc)

    def _next_rid(self, prefix):
        self.ring_counter[prefix] += 1
        return f"RING_{prefix}_{self.ring_counter[prefix]:03}"

    def _register_ring(self, ring_dict):
        rid = ring_dict["ring_id"]
        members = sorted(set(ring_dict["member_accounts"]))

        ring_dict["member_accounts"] = members
        self.fraud_rings.append(ring_dict)

        self._ring_members[rid] = set(members)

        for m in members:
            self._account_rings[str(m)].append(rid)

    def _update_account(self, acc_id, score, pattern, rid):
        acc_id = str(acc_id)
        score = round(float(score), 2)

        if acc_id not in self.suspicious_accounts:
            self.suspicious_accounts[acc_id] = {
                "account_id": acc_id,
                "suspicion_score": score,
                "detected_patterns": [pattern],
                "ring_id": rid,
            }
        else:
            ex = self.suspicious_accounts[acc_id]
            ex["suspicion_score"] = min(
                CONFIG["SCORE_CAP"],
                ex["suspicion_score"] + score * 0.35
            )
            if pattern not in ex["detected_patterns"]:
                ex["detected_patterns"].append(pattern)

    # ───────────────── PASS 1: CYCLES ───────────────── #

        def _detect_cycles(self):

            sccs = sorted(nx.strongly_connected_components(self.G), key=len)

            for scc in sccs:

                scc_size = len(scc)

                if not (CONFIG["CYCLE_MIN"] <= scc_size <= CONFIG["CYCLE_MAX"]):
                    continue

                sub = self.G.subgraph(scc)

                # Must have exactly N edges for a clean cycle
                if sub.number_of_edges() != scc_size:
                    continue

                # Each node must have exactly 1 in and 1 out
                valid_cycle = True
                for node in scc:
                    if sub.in_degree(node) != 1 or sub.out_degree(node) != 1:
                        valid_cycle = False
                        break

                if not valid_cycle:
                    continue

                cycle_nodes = sorted(list(scc))

                rid = self._next_rid("CYC")
                score = 80 + scc_size * 4

                self._register_ring({
                    "ring_id": rid,
                    "member_accounts": cycle_nodes,
                    "pattern_type": "cycle",
                    "risk_score": score,
                })

                for node in cycle_nodes:
                    self._update_account(
                        node,
                        score,
                        f"cycle_length_{scc_size}",
                        rid
                    )

                self._cycle_members.update(cycle_nodes)


    # ───────────────── SLIDING WINDOW ───────────────── #

    def _has_dense_window(self, timestamps):
        window = CONFIG["SMURF_WINDOW_HOURS"] * 3600
        ts = sorted(timestamps)
        left = 0

        for right in range(len(ts)):
            while ts[right].timestamp() - ts[left].timestamp() > window:
                left += 1
            if right - left + 1 >= CONFIG["SMURF_MIN"]:
                return True
        return False

    # ───────────────── PASS 2: FAN-IN ───────────────── #

    def _detect_smurfing_fan_in(self):

        for receiver, group in self.df.groupby("receiver_id"):

            if receiver in self._merchants:
                continue

            unique_senders = group["sender_id"].unique()

            if len(unique_senders) < CONFIG["SMURF_MIN"]:
                continue

            if not self._has_dense_window(group["timestamp"]):
                continue

            rid = self._next_rid("FIN")
            score = 90

            members = list(unique_senders) + [receiver]

            self._register_ring({
                "ring_id": rid,
                "member_accounts": members,
                "pattern_type": "smurfing_fan_in",
                "risk_score": score,
            })

            for acc in members:
                self._update_account(
                    acc,
                    score,
                    "smurfing_fan_in",
                    rid
                )

    # ───────────────── PASS 3: FAN-OUT ───────────────── #

    def _detect_smurfing_fan_out(self):

        for sender, group in self.df.groupby("sender_id"):

            if sender in self._merchants:
                continue

            unique_receivers = group["receiver_id"].unique()

            if len(unique_receivers) < CONFIG["SMURF_MIN"]:
                continue

            if not self._has_dense_window(group["timestamp"]):
                continue

            rid = self._next_rid("FOUT")
            score = 90

            members = [sender] + list(unique_receivers)

            self._register_ring({
                "ring_id": rid,
                "member_accounts": members,
                "pattern_type": "smurfing_fan_out",
                "risk_score": score,
            })

            for acc in members:
                self._update_account(
                    acc,
                    score,
                    "smurfing_fan_out",
                    rid
                )

    # ───────────────── PASS 4: SHELL CHAINS ───────────────── #

    def _detect_shell_networks(self):

        visited = set()

        for node in sorted(self.G.nodes()):

            if node in visited:
                continue

            chain = [node]
            curr = node

            while True:
                succ = list(self.G.successors(curr))
                if len(succ) != 1:
                    break

                nxt = succ[0]
                total_tx = self._in_deg.get(nxt, 0) + self._out_deg.get(nxt, 0)

                if CONFIG["SHELL_MIN_TOTAL_TX"] <= total_tx <= CONFIG["SHELL_MAX_TOTAL_TX"]:
                    chain.append(nxt)
                    curr = nxt
                else:
                    chain.append(nxt)
                    break

            if len(chain) >= CONFIG["SHELL_MIN_HOPS"]:

                rid = self._next_rid("SHELL")
                score = 88

                self._register_ring({
                    "ring_id": rid,
                    "member_accounts": chain,
                    "pattern_type": "layered_shell",
                    "risk_score": score,
                })

                for acc in chain:
                    self._update_account(
                        acc,
                        score,
                        f"layered_shell_hops_{len(chain)}",
                        rid
                    )

                visited.update(chain)

    # ───────────────── ENTRY ───────────────── #

    def detect_patterns(self):

        start = time.time()

        self._detect_cycles()
        self._detect_smurfing_fan_in()
        self._detect_smurfing_fan_out()
        self._detect_shell_networks()

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
