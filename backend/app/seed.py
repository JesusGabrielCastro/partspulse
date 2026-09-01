"""Seed the database with demo data: 1 admin, 1 staff, suppliers in
multiple currencies, and parts (several already below reorder threshold).

Run with: .venv/Scripts/python.exe -m app.seed
"""
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import Part, PurchaseOrder, PurchaseOrderStatus, Supplier, User, UserRole


def run() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            print("Database already seeded, skipping.")
            return

        admin = User(email="admin@partspulse.io", password_hash=hash_password("Admin123!"), role=UserRole.admin)
        staff = User(email="staff@partspulse.io", password_hash=hash_password("Staff123!"), role=UserRole.staff)
        db.add_all([admin, staff])
        db.flush()

        suppliers = [
            Supplier(name="Acme Bearings Inc", currency_code="USD", contact_email="sales@acme.com"),
            Supplier(name="Continental Motors GmbH", currency_code="EUR", contact_email="info@continental.eu"),
            Supplier(name="British Fasteners Ltd", currency_code="GBP", contact_email="hello@britishfasteners.co.uk"),
            Supplier(name="Bharat Industrial Supplies", currency_code="INR", contact_email="contact@bharatind.in"),
            Supplier(name="Nordic Precision AB", currency_code="EUR", contact_email="order@nordicprecision.se"),
        ]
        db.add_all(suppliers)
        db.flush()

        parts_data = [
            ("Ball Bearing 6202-ZZ", "BRG-6202", 5, 20, 3.50, suppliers[0].id),
            ("Ball Bearing 6305-2RS", "BRG-6305", 40, 15, 5.20, suppliers[0].id),
            ("Timing Belt 120T", "BLT-120T", 8, 10, 22.00, suppliers[1].id),
            ("Alternator Bracket", "BRK-ALT-01", 3, 5, 14.75, suppliers[1].id),
            ("Hex Bolt M8x40", "BLT-M8-40", 500, 100, 0.12, suppliers[2].id),
            ("Hex Nut M8", "NUT-M8", 450, 200, 0.05, suppliers[2].id),
            ("Washer Set M8", "WSH-M8", 15, 150, 0.08, suppliers[2].id),
            ("Hydraulic Hose 1/2in", "HYD-HOSE-12", 6, 8, 18.90, suppliers[3].id),
            ("Pressure Sensor PS-200", "SEN-PS200", 2, 6, 45.00, suppliers[3].id),
            ("Solenoid Valve SV-12", "VLV-SV12", 12, 10, 33.40, suppliers[3].id),
            ("Precision Shaft 10mm", "SFT-10MM", 4, 12, 27.60, suppliers[4].id),
            ("Coupling Flange CF-50", "CPL-CF50", 9, 10, 19.25, suppliers[4].id),
            ("Gasket Set GS-100", "GSK-100", 60, 30, 4.10, suppliers[0].id),
            ("Motor Mount MM-3", "MNT-MM3", 7, 10, 31.80, suppliers[1].id),
            ("Filter Element FE-22", "FLT-FE22", 25, 20, 8.75, suppliers[2].id),
            ("O-Ring Kit ORK-8", "ORG-ORK8", 100, 50, 1.35, suppliers[3].id),
            ("Bushing Bronze BB-14", "BSH-BB14", 3, 15, 6.90, suppliers[4].id),
            ("Drive Chain DC-40", "CHN-DC40", 11, 8, 42.00, suppliers[0].id),
            ("Sprocket Wheel SW-18", "SPR-SW18", 5, 10, 16.50, suppliers[1].id),
            ("Control Relay CR-24V", "REL-CR24", 30, 25, 9.99, suppliers[2].id),
            ("Fuse 10A Blade", "FUS-10A", 200, 100, 0.30, suppliers[3].id),
            ("Terminal Block TB-6", "TRM-TB6", 40, 30, 2.20, suppliers[4].id),
            ("Diaphragm Pump DP-5", "PMP-DP5", 2, 5, 89.00, suppliers[0].id),
            ("Actuator Arm AA-30", "ACT-AA30", 6, 10, 55.00, suppliers[1].id),
            ("Cable Gland CG-16", "CBL-CG16", 80, 50, 1.10, suppliers[2].id),
        ]
        parts = [
            Part(
                name=n, sku=sku, current_stock=stock, reorder_threshold=thr,
                unit_price=price, supplier_id=sup_id,
            )
            for n, sku, stock, thr, price, sup_id in parts_data
        ]
        db.add_all(parts)
        db.flush()

        # A couple of sample purchase orders for demo purposes
        po1 = PurchaseOrder(
            part_id=parts[0].id, requested_by=staff.id, quantity=50,
            status=PurchaseOrderStatus.REQUESTED,
            unit_price_at_request=parts[0].unit_price, currency_code=suppliers[0].currency_code,
        )
        po2 = PurchaseOrder(
            part_id=parts[2].id, requested_by=staff.id, approved_by=admin.id, quantity=20,
            status=PurchaseOrderStatus.APPROVED,
            unit_price_at_request=parts[2].unit_price, currency_code=suppliers[1].currency_code,
        )
        db.add_all([po1, po2])

        db.commit()
        print("Seeded: 2 users, 5 suppliers, 25 parts, 2 purchase orders.")
        print("Login: admin@partspulse.io / Admin123!  |  staff@partspulse.io / Staff123!")
    finally:
        db.close()


if __name__ == "__main__":
    run()
