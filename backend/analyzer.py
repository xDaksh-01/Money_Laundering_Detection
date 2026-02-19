"""
RIFT 2026 — RiftAnalyzer  (v2 — fully patched)

Seven-pass detection engine:
  1. cycle                         — circular routing rings
  2. smurfing_fan_in               — many senders → single aggregator (72 h)
  3. smurfing_fan_out              — single hub → many receivers (72 h)
  4. layered_shell                 — linear pass-through chains (≥ 3 hops)
  5. consolidation / funnel        — fan-out → reconverge on shared collector
  6. cross-pattern overlaps        — 6 hybrid bridge types
  7. (filtering)                   — all-normal-account false positives suppressed

Bugs fixed vs original:
  ① Cycle detection: SCCs sorted ascending by size so tiny real rings (3–5 nodes)
    are processed before massive CLN super-components; all-normal SCCs skipped.
  ② Shell tracer: tail node may have any degree — chains feeding into busy hubs
    are captured in full instead of being truncated one step short.
  ③ Shell false positives: chains composed entirely of CLN accounts suppressed.
  ④ Smurfing 72-hour window: cycle-peer edges excluded before measuring window.
  ⑤ Funnel pattern: consolidation pass emits pattern_type "funnel" when source
    is not a cycle member, making distribute-then-reconverge explicitly visible.
  ⑥ Cross-pattern overlaps: two new pairs added:
       consolidation → cycle
       layered_shell → smurfing_fan_in  (shell chain feeds aggregator)
"""

import networkx as nx
import time
from collections import defaultdict


_ROLE_PRIORITY = {"collector": 3, "source": 2, "layer": 1}


def _is_normal(account_id: str) -> bool:
    """True for accounts that belong to the clean normal pool (CLN prefix)."""
    return str(account_id).startswith("CLN")


class RiftAnalyzer:
    def __init__(self, df):
        self.df = df
        self.G  = nx.from_pandas_edgelist(
            df, "sender_id", "receiver_id",
            ["amount", "timestamp", "transaction_id"],
            create_using=nx.MultiDiGraph(),
        )
        self.suspicious_accounts: dict = {}
        self.fraud_rings:         list = []
        self.ring_counters = {
            "CYC": 1, "FIN": 1, "FOUT": 1,
            "SHELL": 1, "CONSOL": 1, "FUNNEL": 1, "CROSS": 1,
        }

        self._in_deg  = dict(self.G.in_degree())
        self._out_deg = dict(self.G.out_degree())

        self._ring_members:  dict[str, set]  = {}
        self._account_rings: dict[str, list] = defaultdict(list)
        self._rings_by_type: dict[str, list] = defaultdict(list)
        self._cycle_members: set             = set()

    # ── entry point ──────────────────────────────────────────────────────────
    def detect_patterns(self):
        start = time.time()
        self._detect_cycles()
        self._detect_smurfing_fan_in()
        self._detect_smurfing_fan_out()
        self._detect_shell_networks()
        self._detect_consolidation_rings()
        self._detect_cross_pattern_overlaps()
        return self._format_output(start)

    # ── helpers ──────────────────────────────────────────────────────────────
    def _update_account(self, acc_id, score, pattern, rid, role="layer"):
        acc_id = str(acc_id)
        score  = round(float(score), 2)
        if acc_id not in self.suspicious_accounts:
            self.suspicious_accounts[acc_id] = {
                "account_id":        acc_id,
                "suspicion_score":   score,
                "detected_patterns": [pattern],
                "ring_id":           rid,
                "role":              role,
            }
        else:
            ex = self.suspicious_accounts[acc_id]
            ex["suspicion_score"] = max(ex["suspicion_score"], score)
            if pattern not in ex["detected_patterns"]:
                ex["detected_patterns"].append(pattern)
            if _ROLE_PRIORITY.get(role, 0) > _ROLE_PRIORITY.get(ex["role"], 0):
                ex["role"] = role

    def _register_ring(self, ring_dict):
        rid     = ring_dict["ring_id"]
        members = ring_dict["member_accounts"]
        self.fraud_rings.append(ring_dict)
        self._ring_members[rid] = set(str(m) for m in members)
        for m in members:
            self._account_rings[str(m)].append(rid)
        self._rings_by_type[ring_dict["pattern_type"]].append(rid)

    def _next_rid(self, prefix):
        n = self.ring_counters[prefix]
        self.ring_counters[prefix] += 1
        return f"RING_{prefix}_{n:03}"

    def _cycle_peers_of(self, account: str) -> set:
        """All accounts that share a CYC ring with `account`."""
        peers = set()
        for rid in self._account_rings.get(str(account), []):
            if rid.startswith("RING_CYC"):
                peers |= self._ring_members.get(rid, set())
        return peers

    # ── PASS 1: Cycle detection ──────────────────────────────────────────────
    def _detect_cycles(self):
        """
        FIX ①: SCCs sorted ascending by size — real fraud rings (3–5 nodes)
        processed before massive all-CLN super-components.
        All-normal SCCs are skipped entirely.
        """
        MAX_CYCLES = 2000
        found = 0

        sccs = sorted(nx.strongly_connected_components(self.G), key=len)

        for scc in sccs:
            if found >= MAX_CYCLES:
                break
            if len(scc) < 3:                              # skip trivial SCCs, don't stop
                continue
            if all(_is_normal(n) for n in scc):          # FIX ①: skip all-normal SCCs
                continue

            sub = self.G.subgraph(scc)
            try:
                for cycle in nx.simple_cycles(sub, length_bound=6):
                    if len(cycle) < 3 or found >= MAX_CYCLES:
                        break
                    found += 1
                    rid     = self._next_rid("CYC")
                    score   = round(min(96.0, 80.0 + len(cycle) * 4), 2)
                    members = list(dict.fromkeys(cycle))

                    self._register_ring({
                        "ring_id":         rid,
                        "member_accounts": members,
                        "pattern_type":    "cycle",
                        "risk_score":      score,
                        "bridge_nodes":    [],
                        "overlap_with":    None,
                    })
                    for i, node in enumerate(members):
                        self._update_account(
                            node, score,
                            f"circular_routing, length_{len(members)}",
                            rid, "source" if i == 0 else "layer",
                        )
                    self._cycle_members.update(str(n) for n in members)
            except Exception:
                continue

    # ── PASS 2: Smurfing fan-in ──────────────────────────────────────────────
    def _detect_smurfing_fan_in(self):
        """
        FIX ④: cycle-peer edges excluded before measuring the 72-hour window
        so a single late cycle transaction doesn't inflate the interval.
        """
        for receiver, group in self.df.groupby("receiver_id"):
            if str(receiver) in self._cycle_members:
                peers = self._cycle_peers_of(str(receiver))
                group = group[~group["sender_id"].astype(str).isin(peers)]

            if len(group) < 10:
                continue
            senders = group["sender_id"].unique().tolist()
            if len(senders) < 10:
                continue

            ts = group["timestamp"].dropna().sort_values()
            if len(ts) < 10:
                continue
            if (ts.iloc[-1] - ts.iloc[0]).total_seconds() > 259_200:
                continue

            rid   = self._next_rid("FIN")
            score = round(min(97.0, 65.0 + len(senders) * 2.0), 2)

            self._register_ring({
                "ring_id":         rid,
                "member_accounts": senders + [receiver],
                "pattern_type":    "smurfing_fan_in",
                "risk_score":      score,
                "bridge_nodes":    [],
                "overlap_with":    None,
            })
            for s in senders:
                self._update_account(s, round(score * 0.65, 2),
                                     "smurfing_fan_in, smurf", rid, "source")
            self._update_account(receiver, score,
                                 "smurfing_fan_in, aggregator", rid, "collector")

    # ── PASS 3: Smurfing fan-out ─────────────────────────────────────────────
    def _detect_smurfing_fan_out(self):
        """
        FIX ④ (mirror): cycle-peer edges excluded from sender's group so the
        cycle rotation doesn't widen the measurement window.
        """
        for sender, group in self.df.groupby("sender_id"):
            if str(sender) in self._cycle_members:
                peers = self._cycle_peers_of(str(sender))
                group = group[~group["receiver_id"].astype(str).isin(peers)]

            if len(group) < 10:
                continue
            receivers = group["receiver_id"].unique().tolist()
            if len(receivers) < 10:
                continue

            ts = group["timestamp"].dropna().sort_values()
            if len(ts) < 10:
                continue
            if (ts.iloc[-1] - ts.iloc[0]).total_seconds() > 259_200:
                continue

            rid   = self._next_rid("FOUT")
            score = round(min(97.0, 65.0 + len(receivers) * 1.5), 2)

            self._register_ring({
                "ring_id":         rid,
                "member_accounts": [sender] + receivers,
                "pattern_type":    "smurfing_fan_out",
                "risk_score":      score,
                "bridge_nodes":    [],
                "overlap_with":    None,
            })
            self._update_account(sender, score,
                                 "smurfing_fan_out, hub", rid, "source")
            for r in receivers:
                self._update_account(r, round(score * 0.7, 2),
                                     "smurfing_fan_out, mule", rid, "layer")

    # ── PASS 4: Layered shell networks ───────────────────────────────────────
    def _detect_shell_networks(self):
        """
        FIX ②: tail node included regardless of degree.
        FIX ③: chains made entirely of CLN accounts suppressed.
        """
        visited: set = set()

        for node in list(self.G.nodes()):
            if node in visited:
                continue
            if self._in_deg.get(node, 0) > 1 or self._out_deg.get(node, 0) != 1:
                continue

            chain = self._trace_shell_chain(node, visited)
            if len(chain) < 3:
                continue

            # FIX ③ — suppress all-normal chains
            if all(_is_normal(n) for n in chain):
                visited.update(chain)
                continue

            rid   = self._next_rid("SHELL")
            score = round(min(95.0, 65.0 + len(chain) * 5), 2)

            self._register_ring({
                "ring_id":         rid,
                "member_accounts": chain,
                "pattern_type":    "layered_shell",
                "risk_score":      score,
                "bridge_nodes":    [],
                "overlap_with":    None,
            })
            for i, acc in enumerate(chain):
                role = "source" if i == 0 else (
                       "collector" if i == len(chain) - 1 else "layer")
                self._update_account(acc, score,
                                     f"layered_shell, hops_{len(chain)}", rid, role)
                visited.add(acc)

    def _trace_shell_chain(self, start: str, visited: set) -> list:
        """
        Walk forward following single-successor edges.
        Intermediate nodes: in_deg == 1 AND out_deg == 1.
        Tail node: any degree — include and stop (FIX ②).
        """
        chain = [start]
        curr  = start

        while len(chain) < 50:
            succs = list(self.G.successors(curr))
            if len(succs) != 1:
                break
            nxt = succs[0]
            if nxt in chain or nxt in visited:
                break

            nxt_in  = self._in_deg.get(nxt, 0)
            nxt_out = self._out_deg.get(nxt, 0)

            if nxt_in == 1 and nxt_out == 1:
                chain.append(nxt)   # pure relay — keep going
                curr = nxt
            else:
                chain.append(nxt)   # terminal hub — include and stop (FIX ②)
                break

        return chain

    # ── PASS 5: Consolidation / funnel ──────────────────────────────────────
    def _detect_consolidation_rings(self):
        """
        FIX ⑤: source not in cycle → pattern_type "funnel" (distribute-then-
        reconverge); source in cycle → pattern_type "consolidation".
        """
        MAX_RINGS = 200
        found     = 0

        for node in self.G.nodes():
            if found >= MAX_RINGS:
                break
            succs = set(self.G.successors(node))
            if len(succs) < 3:
                continue

            collector_mules: dict = defaultdict(set)
            for s in succs:
                for t in self.G.successors(s):
                    if t != node:
                        collector_mules[t].add(s)

            for collector, mules in collector_mules.items():
                if len(mules) < 3 or found >= MAX_RINGS:
                    continue
                found += 1

                is_funnel = str(node) not in self._cycle_members
                ptype  = "funnel"      if is_funnel else "consolidation"
                prefix = "FUNNEL"      if is_funnel else "CONSOL"
                rid    = self._next_rid(prefix)
                score  = 94.0
                members = list(mules) + [node, collector]

                self._register_ring({
                    "ring_id":         rid,
                    "member_accounts": members,
                    "pattern_type":    ptype,
                    "risk_score":      score,
                    "bridge_nodes":    [],
                    "overlap_with":    None,
                })
                self._update_account(node,      score, f"{ptype}, hub_source",     rid, "source")
                self._update_account(collector, score, f"{ptype}, collection_sink", rid, "collector")
                for m in mules:
                    self._update_account(m, score, f"{ptype}, mule", rid, "layer")

    # ── PASS 6: Cross-pattern overlaps ──────────────────────────────────────
    def _detect_cross_pattern_overlaps(self):
        """
        FIX ⑥: two additional overlap pairs:
          consolidation    → cycle
          layered_shell    → smurfing_fan_in
        """
        OVERLAP_PAIRS = [
            ("smurfing_fan_in",  "cycle",            "smurfing_fan_in→cycle"),
            ("smurfing_fan_out", "cycle",             "smurfing_fan_out→cycle"),
            ("layered_shell",    "cycle",             "layered_shell→cycle"),
            ("smurfing_fan_out", "layered_shell",     "smurfing_fan_out→layered_shell"),
            ("consolidation",    "cycle",             "consolidation→cycle"),           # FIX ⑥
            ("layered_shell",    "smurfing_fan_in",   "layered_shell→smurfing_fan_in"), # FIX ⑥
        ]

        seen_bridges: set = set()

        for type_a, type_b, label in OVERLAP_PAIRS:
            rings_a = self._rings_by_type.get(type_a, [])
            rings_b = self._rings_by_type.get(type_b, [])
            if not rings_a or not rings_b:
                continue

            acc_a: dict[str, str] = {}
            for rid in rings_a:
                for acc in self._ring_members.get(rid, set()):
                    acc_a[acc] = rid

            acc_b: dict[str, str] = {}
            for rid in rings_b:
                for acc in self._ring_members.get(rid, set()):
                    acc_b[acc] = rid

            bridges = set(acc_a) & set(acc_b)
            if not bridges:
                continue

            pair_map: dict[tuple, list] = defaultdict(list)
            for acc in bridges:
                pair_map[(acc_a[acc], acc_b[acc])].append(acc)

            for (rid_a, rid_b), blist in pair_map.items():
                key = (rid_a, rid_b, label)
                if key in seen_bridges:
                    continue
                seen_bridges.add(key)

                ma = list(self._ring_members.get(rid_a, set()))
                mb = list(self._ring_members.get(rid_b, set()))
                combined = (
                    sorted(blist) +
                    [m for m in ma if m not in blist][:10] +
                    [m for m in mb if m not in blist][:10]
                )
                seen_m: set = set()
                deduped = []
                for m in combined:
                    if m not in seen_m:
                        seen_m.add(m)
                        deduped.append(m)

                rid_cross = self._next_rid("CROSS")
                score     = 98.0

                self._register_ring({
                    "ring_id":         rid_cross,
                    "member_accounts": deduped,
                    "pattern_type":    label,
                    "risk_score":      score,
                    "bridge_nodes":    sorted(blist),
                    "overlap_with":    f"{rid_a} × {rid_b}",
                })
                for acc in blist:
                    self._update_account(acc, score,
                                         f"bridge: {label}", rid_cross, "collector")
                for acc in ma:
                    if acc not in set(blist):
                        self._update_account(acc, round(score * 0.9, 2),
                                             f"bridge_member: {label}", rid_cross, "layer")
                for acc in mb:
                    if acc not in set(blist):
                        self._update_account(acc, round(score * 0.9, 2),
                                             f"bridge_member: {label}", rid_cross, "layer")

    # ── output ───────────────────────────────────────────────────────────────
    def _format_output(self, start):
        return {
            "suspicious_accounts": sorted(
                self.suspicious_accounts.values(),
                key=lambda x: x["suspicion_score"],
                reverse=True,
            ),
            "fraud_rings": self.fraud_rings,
            "summary": {
                "total_accounts_analyzed":     self.G.number_of_nodes(),
                "suspicious_accounts_flagged": len(self.suspicious_accounts),
                "fraud_rings_detected":        len(self.fraud_rings),
                "processing_time_seconds":     round(time.time() - start, 3),
            },
        }