"""Purchase order state machine. Transitions are validated here, never trusted
from the client — the client only invokes an endpoint, never sends a status
string (see plan.md section 7 / README Q7)."""
from app.models import PurchaseOrderStatus

ALLOWED_TRANSITIONS: dict[PurchaseOrderStatus, set[PurchaseOrderStatus]] = {
    PurchaseOrderStatus.REQUESTED: {PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.REJECTED},
    PurchaseOrderStatus.APPROVED: {PurchaseOrderStatus.ORDERED},
    PurchaseOrderStatus.REJECTED: set(),
    PurchaseOrderStatus.ORDERED: {PurchaseOrderStatus.RECEIVED},
    PurchaseOrderStatus.RECEIVED: set(),
}


class IllegalTransitionError(Exception):
    def __init__(self, current: PurchaseOrderStatus, target: PurchaseOrderStatus):
        self.current = current
        self.target = target
        super().__init__(f"Cannot transition from {current} to {target}")


def validate_transition(current: PurchaseOrderStatus, target: PurchaseOrderStatus) -> None:
    if target not in ALLOWED_TRANSITIONS.get(current, set()):
        raise IllegalTransitionError(current, target)
