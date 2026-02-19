from pydantic import BaseModel
from typing import List, Optional

class SuspiciousAccount(BaseModel):
    account_id: str
    suspicion_score: float
    detected_patterns: List[str]
    ring_id: str
    role: Optional[str] = "layer"   # source | layer | collector

class FraudRing(BaseModel):
    ring_id: str
    member_accounts: List[str]
    pattern_type: str               # cycle | smurfing_fan_in | smurfing_fan_out |
                                    # layered_shell | consolidation |
                                    # smurfing_fan_in→cycle | smurfing_fan_out→cycle |
                                    # layered_shell→cycle | smurfing_fan_out→layered_shell
    risk_score: float
    bridge_nodes: Optional[List[str]] = []   # accounts shared between two patterns
    overlap_with: Optional[str] = None       # "RING_X × RING_Y" for cross-pattern rings

class Summary(BaseModel):
    total_accounts_analyzed: int
    suspicious_accounts_flagged: int
    fraud_rings_detected: int
    processing_time_seconds: float

class RiftOutput(BaseModel):
    suspicious_accounts: List[SuspiciousAccount]
    fraud_rings: List[FraudRing]
    summary: Summary