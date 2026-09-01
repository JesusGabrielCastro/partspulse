from app.models import Part
from app.services.inventory_service import is_low_stock


def _make_part(current_stock: int, reorder_threshold: int) -> Part:
    return Part(
        name="X", sku="X-1", current_stock=current_stock, reorder_threshold=reorder_threshold,
        unit_price=1, supplier_id=1,
    )


def test_is_low_stock_above_threshold():
    assert is_low_stock(_make_part(current_stock=10, reorder_threshold=5)) is False


def test_is_low_stock_equal_threshold():
    # The boundary case: equal counts as low stock (<=), not just strictly below.
    assert is_low_stock(_make_part(current_stock=5, reorder_threshold=5)) is True


def test_is_low_stock_below_threshold():
    assert is_low_stock(_make_part(current_stock=2, reorder_threshold=5)) is True
