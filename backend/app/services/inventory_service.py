"""Single source of truth for the low-stock rule. Never stored as a column —
always derived on read (plan.md section 5 / 7, README Q6)."""
from app.models import Part


def is_low_stock(part: Part) -> bool:
    return part.current_stock <= part.reorder_threshold
