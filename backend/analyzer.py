"""
RIFT 2026 — RiftAnalyzer  (fixed version)

Six-pass detection engine:
  1. cycle              — circular routing rings (SCC-based)
  2. smurfing_fan_in    — many senders → single aggregator
  3. smurfing_fan_out   — single hub → many receivers
  4. layered_shell      — linear pass-through chains (≥3 hops)
  5. consolidation      — source → N mules → shared collector
  6. cross-pattern overlaps (hybrid bridge rings)
"""

import networkx as nx
import pandas as pd
import time
from collections import defaultdict

# ── Role priority: collector > source > layer ──────────────────
_ROLE_PRIORITY = {"collector": 3, "source": 2, "layer": 1}

CONFIG = {
    "CYCLE_MIN": 3,
    "CYCLE_MAX": 6,
    "SMURF_MIN": 10,
    "SMURF_WINDOW_HOURS": 72,
    "SHELL_MIN_HOPS": 3,
    "MAX_CYCLES": 2000,
    "MAX_CONSOL": 200,
    "SCORE_CAP": 100.0,
}


class RiftAnalyzer:

    def __init__(self, df):
        self.df = df.copy()
        self.df["timestamp"] = pd.to_datetime(self.df["timestamp"], errors="coerce")

        self.G = nx.from_pandas_edgelist(
            self.df,
            "sender_id",
            "receiver_id",
            ["amount", "timestamp", "transaction_id"],
            create_using=nx.MultiDiGraph(),
        )

        # O(1) degree lookups
        self._in_deg = dict(self.G.in_degree())
        self._out_deg = dict(self.G.out_degree())

        self.suspicious_accounts = {}
        self.fraud_rings = []

        self._ring_members: dict[str, set] = {}
        self._account_rings: dict[str, list] = defaultdict(list)
        self._rings_by_type: dict[str, list] = defaultdict(list)

        self.ring_counter = defaultdict(int)

    # ──────────────────────────────────────────────────────────────
    #  MAIN ENTRY POINT
    # ──────────────────────────────────────────────────────────────
    def detect_patterns(self):
        start = time.time()
        self._detect_cycles()
        self._detect_smurfing_fan_in()
        self._detect_smurfing_fan_out()
        self._detect_shell_networks()
        self._detect_consolidation_rings()
        self._detect_cross_pattern_overlaps()
        return self._format_output(start)

    # ──────────────────────────────────────────────────────────────
    #  INTERNAL HELPERS
    # ──────────────────────────────────────────────────────────────
    def _next_rid(self, prefix):
        self.ring_counter[prefix] += 1
        return f"RING_{prefix}_{self.ring_counter[prefix]:03}"

    def _register_ring(self, ring_dict):
        """Append ring to fraud_rings and update membership index."""
        rid = ring_dict["ring_id"]
        members = ring_dict["member_accounts"]
        member_set = set(str(m) for m in members)

        # Ensure all required fields exist
        ring_dict.setdefault("total_amount", 0.0)
        ring_dict.setdefault("bridge_nodes", [])
        ring_dict.setdefault("overlap_with", None)

        # Compute total transacted amount within the ring
        if len(member_set) <= 200:
            ring_dict["total_amount"] = self._compute_ring_amount(member_set)

        self.fraud_rings.append(ring_dict)
        self._ring_members[rid] = member_set
        for m in members:
            self._account_rings[str(m)].append(rid)
        self._rings_by_type[ring_dict["pattern_type"]].append(rid)

    def _update_account(self, acc_id, score, pattern, rid, role="layer"):
        """Update or create a suspicious account entry with role priority."""
        acc_id = str(acc_id)
        score = round(min(float(score), CONFIG["SCORE_CAP"]), 2)

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
            ex["suspicion_score"] = min(
                CONFIG["SCORE_CAP"],
                max(ex["suspicion_score"], score),
            )
            if pattern not in ex["detected_patterns"]:
                ex["detected_patterns"].append(pattern)
            # Role priority: collector > source > layer
            if _ROLE_PRIORITY.get(role, 0) > _ROLE_PRIORITY.get(ex["role"], 0):
                ex["role"] = role

    def _compute_ring_amount(self, member_set: set) -> float:
        """Sum all transaction amounts between members of this ring (vectorized)."""
        mask = (
            self.df["sender_id"].astype(str).isin(member_set)
            & self.df["receiver_id"].astype(str).isin(member_set)
        )
        return round(float(self.df.loc[mask, "amount"].sum()), 2)

    def _has_dense_window(self, timestamps):
        """Check if there are enough transactions within the smurf window."""
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

    # ──────────────────────────────────────────────────────────────
    #  PASS 1 — CYCLE DETECTION (SCC-based)
    # ──────────────────────────────────────────────────────────────
    def _detect_cycles(self):
        """Fast SCC-based cycle detection — O(V+E), no exponential blowup."""
        for scc in nx.strongly_connected_components(self.G):
            scc_size = len(scc)

            if not (CONFIG["CYCLE_MIN"] <= scc_size <= CONFIG["CYCLE_MAX"]):
                continue

            sub = self.G.subgraph(scc)

            # Must have exactly N edges for a clean cycle
            if sub.number_of_edges() != scc_size:
                continue

            # Each node must have exactly 1 in and 1 out
            valid = all(
                sub.in_degree(n) == 1 and sub.out_degree(n) == 1
                for n in scc
            )
            if not valid:
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
                self._update_account(
                    node, score,
                    f"circular_routing, length_{scc_size}",
                    rid, role,
                )

    # ──────────────────────────────────────────────────────────────
    #  PASS 2 — SMURFING FAN-IN (many → one aggregator)
    # ──────────────────────────────────────────────────────────────
    def _detect_smurfing_fan_in(self):
        for receiver, group in self.df.groupby("receiver_id"):
            unique_senders = group["sender_id"].unique()
            if len(unique_senders) < CONFIG["SMURF_MIN"]:
                continue
            if not self._has_dense_window(group["timestamp"]):
                continue

            rid = self._next_rid("FIN")
            score = round(min(97.0, 65.0 + len(unique_senders) * 2.0), 2)
            members = list(unique_senders) + [receiver]

            self._register_ring({
                "ring_id": rid,
                "member_accounts": members,
                "pattern_type": "smurfing_fan_in",
                "risk_score": score,
            })
            for smurf in unique_senders:
                self._update_account(smurf, round(score * 0.65, 2),
                                     "smurfing_fan_in, smurf", rid, "source")
            self._update_account(receiver, score,
                                 "smurfing_fan_in, aggregator", rid, "collector")

    # ──────────────────────────────────────────────────────────────
    #  PASS 3 — SMURFING FAN-OUT (one hub → many receivers)
    # ──────────────────────────────────────────────────────────────
    def _detect_smurfing_fan_out(self):
        for sender, group in self.df.groupby("sender_id"):
            unique_receivers = group["receiver_id"].unique()
            if len(unique_receivers) < CONFIG["SMURF_MIN"]:
                continue
            if not self._has_dense_window(group["timestamp"]):
                continue

            rid = self._next_rid("FOUT")
            score = round(min(97.0, 65.0 + len(unique_receivers) * 1.5), 2)
            members = [sender] + list(unique_receivers)

            self._register_ring({
                "ring_id": rid,
                "member_accounts": members,
                "pattern_type": "smurfing_fan_out",
                "risk_score": score,
            })
            self._update_account(sender, score,
                                 "smurfing_fan_out, hub", rid, "source")
            for mule in unique_receivers:
                self._update_account(mule, round(score * 0.7, 2),
                                     "smurfing_fan_out, mule", rid, "layer")

    # ──────────────────────────────────────────────────────────────
    #  PASS 4 — LAYERED SHELL NETWORKS (linear chains ≥3 hops)
    # ──────────────────────────────────────────────────────────────
    def _detect_shell_networks(self):
        visited = set()

        for node in list(self.G.nodes()):
            if node in visited:
                continue
            in_deg = self._in_deg.get(node, 0)
            out_deg = self._out_deg.get(node, 0)
            # Chain head: ≤1 incoming, exactly 1 outgoing
            if in_deg > 1 or out_deg != 1:
                continue

            chain = self._trace_shell_chain(node, visited)
            if len(chain) < CONFIG["SHELL_MIN_HOPS"]:
                continue

            rid = self._next_rid("SHELL")
            score = round(min(95.0, 65.0 + len(chain) * 5), 2)

            self._register_ring({
                "ring_id": rid,
                "member_accounts": chain,
                "pattern_type": "layered_shell",
                "risk_score": score,
            })
            for i, acc in enumerate(chain):
                if i == 0:
                    role = "source"
                elif i == len(chain) - 1:
                    role = "collector"
                else:
                    role = "layer"
                self._update_account(
                    acc, score,
                    f"layered_shell, hops_{len(chain)}", rid, role,
                )
                visited.add(acc)

    def _trace_shell_chain(self, start, visited):
        """Trace a linear chain — guards against cycles and fan-out."""
        chain = [start]
        seen_in_chain = {start}
        curr = start

        while len(chain) < 50:
            succs = list(self.G.successors(curr))
            if len(succs) != 1:
                break
            nxt = succs[0]
            # CRITICAL: stop if we'd revisit a node (prevents infinite loop)
            if nxt in seen_in_chain or nxt in visited:
                break
            next_in = self._in_deg.get(nxt, 0)
            next_out = self._out_deg.get(nxt, 0)
            if next_in != 1 or next_out > 1:
                break
            chain.append(nxt)
            seen_in_chain.add(nxt)
            curr = nxt
            if next_out == 0:
                break
        return chain

    # ──────────────────────────────────────────────────────────────
    #  PASS 5 — CONSOLIDATION RINGS
    # ──────────────────────────────────────────────────────────────
    def _detect_consolidation_rings(self):
        candidates = [n for n in self.G.nodes() if self._out_deg.get(n, 0) >= 3]
        found = 0

        for node in candidates:
            if found >= CONFIG["MAX_CONSOL"]:
                break
            succs = set(self.G.successors(node))
            if len(succs) < 3:
                continue

            target_count: dict = defaultdict(set)
            for s in succs:
                for t in self.G.successors(s):
                    if t != node:
                        target_count[t].add(s)

            for target, mules in target_count.items():
                if len(mules) >= 3 and found < CONFIG["MAX_CONSOL"]:
                    found += 1
                    rid = self._next_rid("CONSOL")
                    score = 94.0
                    members = list(mules) + [node, target]

                    self._register_ring({
                        "ring_id": rid,
                        "member_accounts": members,
                        "pattern_type": "consolidation",
                        "risk_score": score,
                    })
                    self._update_account(
                        node, score, "consolidation, hub_source", rid, "source")
                    self._update_account(
                        target, score, "consolidation, collection_sink", rid, "collector")
                    for m in mules:
                        self._update_account(
                            m, score, "consolidation, mule", rid, "layer")

    # ──────────────────────────────────────────────────────────────
    #  PASS 6 — CROSS-PATTERN OVERLAP DETECTION
    # ──────────────────────────────────────────────────────────────
    def _detect_cross_pattern_overlaps(self):
        OVERLAP_PAIRS = [
            ("smurfing_fan_in",  "cycle",         "smurfing_fan_in→cycle"),
            ("smurfing_fan_out", "cycle",          "smurfing_fan_out→cycle"),
            ("layered_shell",    "cycle",          "layered_shell→cycle"),
            ("smurfing_fan_out", "layered_shell",  "smurfing_fan_out→layered_shell"),
        ]

        seen_bridges: set = set()

        for type_a, type_b, hybrid_label in OVERLAP_PAIRS:
            rings_a = self._rings_by_type.get(type_a, [])
            rings_b = self._rings_by_type.get(type_b, [])

            if not rings_a or not rings_b:
                continue

            accounts_a: dict[str, str] = {}
            for rid in rings_a:
                for acc in self._ring_members.get(rid, set()):
                    accounts_a[acc] = rid

            accounts_b: dict[str, str] = {}
            for rid in rings_b:
                for acc in self._ring_members.get(rid, set()):
                    accounts_b[acc] = rid

            bridge_accounts = set(accounts_a.keys()) & set(accounts_b.keys())
            if not bridge_accounts:
                continue

            ring_pair_bridges: dict[tuple, list] = defaultdict(list)
            for acc in bridge_accounts:
                pair_key = (accounts_a[acc], accounts_b[acc])
                ring_pair_bridges[pair_key].append(acc)

            for (rid_a, rid_b), bridges in ring_pair_bridges.items():
                dedup_key = (rid_a, rid_b, hybrid_label)
                if dedup_key in seen_bridges:
                    continue
                seen_bridges.add(dedup_key)

                members_a = list(self._ring_members.get(rid_a, set()))
                members_b = list(self._ring_members.get(rid_b, set()))
                combined = (
                    sorted(bridges)
                    + [m for m in members_a if m not in bridges][:10]
                    + [m for m in members_b if m not in bridges][:10]
                )
                seen_m: set = set()
                members_deduped = []
                for m in combined:
                    if m not in seen_m:
                        seen_m.add(m)
                        members_deduped.append(m)

                rid_cross = self._next_rid("CROSS")
                score = 98.0

                self._register_ring({
                    "ring_id": rid_cross,
                    "member_accounts": members_deduped,
                    "pattern_type": hybrid_label,
                    "risk_score": score,
                    "bridge_nodes": sorted(bridges),
                    "overlap_with": f"{rid_a} × {rid_b}",
                })

                for acc in bridges:
                    self._update_account(
                        acc, score,
                        f"bridge: {hybrid_label}", rid_cross, "collector",
                    )

    # ──────────────────────────────────────────────────────────────
    #  OUTPUT FORMATTER
    # ──────────────────────────────────────────────────────────────
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
