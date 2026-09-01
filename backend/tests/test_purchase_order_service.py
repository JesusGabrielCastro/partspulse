import pytest

from app.models import PurchaseOrderStatus
from app.services.purchase_order_service import IllegalTransitionError, validate_transition


def test_legal_transition_requested_to_approved():
    validate_transition(PurchaseOrderStatus.REQUESTED, PurchaseOrderStatus.APPROVED)  # no raise


def test_illegal_transition_approve_rejected():
    with pytest.raises(IllegalTransitionError):
        validate_transition(PurchaseOrderStatus.REJECTED, PurchaseOrderStatus.APPROVED)


def test_illegal_transition_skip_to_received():
    with pytest.raises(IllegalTransitionError):
        validate_transition(PurchaseOrderStatus.REQUESTED, PurchaseOrderStatus.RECEIVED)
