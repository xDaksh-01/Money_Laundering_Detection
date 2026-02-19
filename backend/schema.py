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
    pattern_type: str
    risk_score: float
    total_amount: Optional[float] = 0.0      # sum of all txn amounts within the ring
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