def test_list_parts_low_stock_filter(client, admin_token, supplier_and_part):
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = client.get("/api/parts?low_stock=true", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0  # seeded part has stock 10, threshold 5 -> not low


def test_staff_can_create_po(client, staff_token, supplier_and_part):
    _, part = supplier_and_part
    headers = {"Authorization": f"Bearer {staff_token}"}
    resp = client.post("/api/purchase-orders", json={"part_id": part["id"], "quantity": 5}, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["status"] == "REQUESTED"


def test_staff_cannot_approve_po_403(client, staff_token, supplier_and_part):
    """Server-side RBAC: staff must never be able to approve, even their own PO."""
    _, part = supplier_and_part
    headers = {"Authorization": f"Bearer {staff_token}"}
    po = client.post("/api/purchase-orders", json={"part_id": part["id"], "quantity": 5}, headers=headers).json()

    resp = client.post(f"/api/purchase-orders/{po['id']}/approve", headers=headers)
    assert resp.status_code == 403


def test_admin_cannot_approve_own_request(client, admin_token, supplier_and_part):
    _, part = supplier_and_part
    headers = {"Authorization": f"Bearer {admin_token}"}
    po = client.post("/api/purchase-orders", json={"part_id": part["id"], "quantity": 5}, headers=headers).json()

    resp = client.post(f"/api/purchase-orders/{po['id']}/approve", headers=headers)
    assert resp.status_code == 403


def test_receive_po_increments_stock(client, admin_token, staff_token, supplier_and_part):
    _, part = supplier_and_part
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    po = client.post(
        "/api/purchase-orders", json={"part_id": part["id"], "quantity": 15}, headers=staff_headers
    ).json()
    client.post(f"/api/purchase-orders/{po['id']}/approve", headers=admin_headers)
    client.post(f"/api/purchase-orders/{po['id']}/order", headers=admin_headers)
    resp = client.post(f"/api/purchase-orders/{po['id']}/receive", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "RECEIVED"

    updated_part = client.get("/api/parts?page_size=50", headers=admin_headers).json()["items"]
    found = next(p for p in updated_part if p["id"] == part["id"])
    assert found["current_stock"] == part["current_stock"] + 15
