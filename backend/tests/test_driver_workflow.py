"""HTTP workflow tests using real temporary SQLite databases, including races."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from threading import Barrier

import hashlib

import pytest
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser, get_current_user
from app.database import Base, configure_sqlite, get_db
from app.main import app
from app.models import Car, Driver, RideRequest, Shelter

VEHICLE = {"make": "Toyota", "model": "Camry", "color": "Blue", "license_plate": "001-ABC"}


@pytest.fixture
def api(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'drivers.db'}",
                           connect_args={"check_same_thread": False, "timeout": 30})
    event.listen(engine, "connect", configure_sqlite)
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(Shelter(id=1, name="Demo shelter", address="Demo destination", total_beds=10, available_beds=5))
        db.add_all([
            Driver(id=1, auth_user_id="driver-1", phone_number="001-555-0100", is_verified=True, is_available=True),
            Driver(id=2, auth_user_id="driver-2", phone_number="001-555-0200", is_verified=True, is_available=True),
            Driver(id=3, auth_user_id="unverified", phone_number="001-555-0300", is_verified=False),
            Driver(id=4, auth_user_id="offline", phone_number="001-555-0400", is_verified=True),
        ])
        db.flush()
        db.add_all([
            RideRequest(id=1, first_name="Private", last_name="Rider", pickup_address="123 Private St, Unit 5",
                        pickup_latitude=33.5207, pickup_longitude=-86.8025, shelter_id=1, tracking_token_hash="secret-hash-1"),
            RideRequest(id=2, first_name="Other", last_name="Rider", pickup_address="456 Secret Ave",
                        shelter_id=1, tracking_token_hash="secret-hash-2"),
            RideRequest(id=3, first_name="Past", last_name="Rider", pickup_address="Old address", shelter_id=1,
                        status="CANCELLED", tracking_token_hash="secret-hash-3"),
        ])
        db.commit()

    def database():
        with Session(engine) as db:
            yield db

    def identity(request: Request):
        # Only a test override; no mock identity mode in the running application.
        user_id = request.headers.get("X-Test-User")
        if not user_id:
            raise HTTPException(401)
        return CurrentUser(id=user_id, role=request.headers.get("X-Test-Role", "driver"))

    overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_current_user] = identity
    # No lifespan: do not initialize or modify the project's real database.
    client = TestClient(app)
    yield client, engine
    client.close()
    app.dependency_overrides.clear()
    app.dependency_overrides.update(overrides)
    engine.dispose()


def headers(user="driver-1", role="driver"):
    return {"X-Test-User": user, "X-Test-Role": role}


def test_initialization_idempotent_and_identity_owned(api):
    client, engine = api
    url = "/api/drivers/me/initialize"
    response = client.post(url, headers=headers("new-user"), json={"phone_number": " 001-555-0000 ", "vehicle": VEHICLE})
    assert response.status_code == 200
    profile = response.json()
    assert profile["auth_user_id"] == "new-user"
    assert profile["phone_number"] == "001-555-0000"
    assert profile["is_verified"] is True
    assert profile["is_available"] is False
    assert {key: profile["vehicle"][key] for key in VEHICLE} == VEHICLE
    repeated = client.post(url, headers=headers("new-user"), json={"phone_number": "different", "vehicle": VEHICLE | {"color": "Red"}})
    assert repeated.json() == profile
    assert client.get("/api/drivers/me", headers=headers("new-user")).json() == profile
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Driver).where(Driver.auth_user_id == "new-user")) == 1


@pytest.mark.parametrize("payload", [
    {}, {"phone_number": None}, {"phone_number": " "}, {"phone_number": 2055550100},
    {"phone_number": "123", "auth_user_id": "victim"},
    {"phone_number": "123", "is_verified": True},
    {"phone_number": "123", "is_available": True},
    {"phone_number": "123", "sms_opted_in": True},
])
def test_phone_validation_and_protected_fields(api, payload):
    client, _ = api
    for method, url in [("post", "/api/drivers/me/initialize"), ("patch", "/api/drivers/me")]:
        body = payload | {"vehicle": VEHICLE} if method == "post" else payload
        assert getattr(client, method)(url, headers=headers(), json=body).status_code == 422


@pytest.mark.parametrize("method,url,body", [
    ("post", "/api/drivers/me/initialize", {"phone_number": "001", "vehicle": VEHICLE}),
    ("get", "/api/drivers/me", None),
    ("patch", "/api/drivers/me", {"phone_number": "001"}),
    ("patch", "/api/drivers/me/availability", {"is_available": True}),
    ("get", "/api/drivers/me/active-ride", None),
    ("get", "/api/drivers/requests", None),
    ("post", "/api/rides/1/accept", None),
    ("patch", "/api/rides/1/status", {"status": "COMPLETED"}),
])
def test_all_routes_require_driver_role(api, method, url, body):
    client, _ = api
    kwargs = {"json": body} if body is not None else {}
    assert client.request(method, url, **kwargs).status_code == 401
    for role in ("shelter_admin", "super_admin"):
        assert client.request(method, url, headers=headers(role=role), **kwargs).status_code == 403


@pytest.mark.parametrize("vehicle", [None, {}, "Toyota", {"make": "Toyota"}] + [
    VEHICLE | {field: value}
    for field in VEHICLE for value in (None, "", "  ", 123)
] + [VEHICLE | {"driver_id": 2}])
def test_registration_rejects_invalid_vehicle_without_creating_profile(api, vehicle):
    client, engine = api
    response = client.post("/api/drivers/me/initialize", headers=headers("new-user"),
                           json={"phone_number": "001", "vehicle": vehicle})
    assert response.status_code == 422
    with Session(engine) as db:
        assert db.scalar(select(Driver).where(Driver.auth_user_id == "new-user")) is None
        assert db.scalar(select(func.count()).select_from(Car)) == 0


def test_registration_requires_vehicle(api):
    client, _ = api
    assert client.post("/api/drivers/me/initialize", headers=headers("new-user"),
                       json={"phone_number": "001"}).status_code == 422


def test_existing_driver_can_register_missing_vehicle_without_changing_profile(api):
    client, engine = api
    response = client.post("/api/drivers/me/initialize", headers=headers("unverified"),
                           json={"phone_number": "different", "vehicle": VEHICLE})
    assert response.status_code == 200
    assert response.json()["is_verified"] is False
    assert response.json()["phone_number"] == "001-555-0300"
    assert response.json()["vehicle"]["license_plate"] == "001-ABC"
    with Session(engine) as db:
        assert db.get(Driver, 3).vehicle.driver_id == 3
        assert db.scalar(select(func.count()).select_from(Car)) == 1


def test_phone_and_availability_persist(api):
    client, engine = api
    response = client.patch("/api/drivers/me", headers=headers(), json={"phone_number": "+1 (555) 001-0000"})
    assert response.status_code == 200
    assert client.get("/api/drivers/me", headers=headers()).json()["phone_number"] == "+1 (555) 001-0000"
    for available in (False, True):
        assert client.patch("/api/drivers/me/availability", headers=headers(), json={"is_available": available}).status_code == 200
        with Session(engine) as db:
            assert db.get(Driver, 1).is_available is available
    assert client.patch("/api/drivers/me/availability", headers=headers("unverified"), json={"is_available": True}).status_code == 403
    assert client.patch("/api/drivers/me/availability", headers=headers("unverified"), json={"is_available": False}).status_code == 200
    for invalid in ({}, {"is_available": None}, {"is_available": "true"}, {"is_available": 1}, {"is_available": True, "is_verified": True}):
        assert client.patch("/api/drivers/me/availability", headers=headers(), json=invalid).status_code == 422


@pytest.mark.parametrize("method,url,body", [
    ("get", "/api/drivers/me", None),
    ("patch", "/api/drivers/me", {"phone_number": "001"}),
    ("patch", "/api/drivers/me/availability", {"is_available": True}),
    ("get", "/api/drivers/requests", None),
    ("post", "/api/rides/1/accept", None),
    ("patch", "/api/rides/1/status", {"status": "IN_PROGRESS"}),
])
def test_missing_profile(api, method, url, body):
    client, _ = api
    kwargs = {"json": body} if body is not None else {}
    assert client.request(method, url, headers=headers("not-initialized"), **kwargs).status_code == 404


@pytest.mark.parametrize("user", ["unverified", "offline"])
def test_pending_and_accept_require_eligibility(api, user):
    client, _ = api
    assert client.get("/api/drivers/requests", headers=headers(user)).status_code == 403
    assert client.post("/api/rides/1/accept", headers=headers(user)).status_code == 403


def test_pending_privacy_and_assignment_details(api):
    client, _ = api
    response = client.get("/api/drivers/requests", headers=headers())
    assert response.status_code == 200
    assert [ride["id"] for ride in response.json()] == [1, 2]
    for ride in response.json():
        assert set(ride) == {"id", "pickup_area", "shelter_id", "shelter_name", "status", "created_at"}
    for private in ("123 Private", "456 Secret", "33.5207", "-86.8025", "secret-hash", "Private", "Rider"):
        assert private not in response.text
    assert client.get("/api/drivers/me/active-ride", headers=headers()).json() is None
    accepted = client.post("/api/rides/1/accept", headers=headers(), json={"driver_id": 2})
    assert accepted.status_code == 200
    ride = accepted.json()
    assert ride["driver_id"] == 1  # Body cannot choose another driver's identity.
    assert ride["first_name"] == "Private"
    assert ride["pickup_latitude"] == 33.5207
    assert ride["status"] == "ACCEPTED"
    assert datetime.fromisoformat(ride["accepted_at"]).utcoffset().total_seconds() == 0
    assert "tracking_token_hash" not in ride
    assert client.get("/api/drivers/me/active-ride", headers=headers()).json() == ride
    assert client.get("/api/drivers/me/active-ride", headers=headers("driver-2")).json() is None
    assert client.get("/api/drivers/requests", headers=headers()).json() == []
    assert [item["id"] for item in client.get("/api/drivers/requests", headers=headers("driver-2")).json()] == [2]
    assert client.post("/api/rides/1/accept", headers=headers("driver-2")).status_code == 409
    assert client.post("/api/rides/2/accept", headers=headers()).status_code == 409


def test_status_transitions_ownership_timestamps_and_offline_completion(api):
    client, engine = api
    assert client.post("/api/rides/999/accept", headers=headers()).status_code == 404
    assert client.post("/api/rides/3/accept", headers=headers()).status_code == 409
    assert client.patch("/api/rides/999/status", headers=headers(), json={"status": "IN_PROGRESS"}).status_code == 404
    assert client.patch("/api/rides/1/status", headers=headers(), json={"status": "IN_PROGRESS"}).status_code == 403
    accepted = client.post("/api/rides/1/accept", headers=headers()).json()
    assert client.patch("/api/rides/1/status", headers=headers("driver-2"), json={"status": "IN_PROGRESS"}).status_code == 403
    for status in ("PENDING", "ACCEPTED", "COMPLETED", "UNKNOWN"):
        assert client.patch("/api/rides/1/status", headers=headers(), json={"status": status}).status_code == 409
    assert client.patch("/api/drivers/me/availability", headers=headers(), json={"is_available": False}).status_code == 200
    progress = client.patch("/api/rides/1/status", headers=headers(), json={"status": "IN_PROGRESS"})
    assert progress.status_code == 200
    assert progress.json()["completed_at"] is None
    assert client.patch("/api/rides/1/status", headers=headers(), json={"status": "CANCELLED"}).status_code == 409
    completed = client.patch("/api/rides/1/status", headers=headers(), json={"status": "COMPLETED"})
    assert completed.status_code == 200
    assert completed.json()["accepted_at"] == accepted["accepted_at"]
    assert datetime.fromisoformat(completed.json()["completed_at"]).utcoffset().total_seconds() == 0
    assert client.patch("/api/rides/1/status", headers=headers(), json={"status": "COMPLETED"}).status_code == 409
    assert client.get("/api/drivers/me/active-ride", headers=headers()).json() is None
    with Session(engine) as db:
        assert db.get(RideRequest, 1).status == "COMPLETED"


def test_cancel_releases_driver_and_is_terminal(api):
    client, _ = api
    assert client.post("/api/rides/1/accept", headers=headers()).status_code == 200
    cancelled = client.patch("/api/rides/1/status", headers=headers(), json={"status": "CANCELLED"})
    assert cancelled.status_code == 200
    assert cancelled.json()["completed_at"] is None
    assert client.patch("/api/rides/1/status", headers=headers(), json={"status": "IN_PROGRESS"}).status_code == 409
    assert client.post("/api/rides/2/accept", headers=headers()).status_code == 200


def test_anonymous_creation_and_driver_workflow(api):
    client, engine = api
    payload = {"first_name": " Jane ", "last_name": " Smith ",
               "pickup_address": " Downtown Birmingham ", "shelter_id": 1}
    response = client.post("/api/rides", json=payload)  # No authentication required.
    assert response.status_code == 201
    assert response.headers["cache-control"] == "no-store"
    created = response.json()
    assert set(created) == {"id", "status", "tracking_token"}
    assert created["status"] == "PENDING"
    assert len(created["tracking_token"]) >= 43
    with Session(engine) as db:
        ride = db.get(RideRequest, created["id"])
        assert ride.first_name == "Jane"
        assert ride.last_name == "Smith"
        assert ride.pickup_address == "Downtown Birmingham"
        assert ride.driver_id is None
        assert ride.accepted_at is None
        assert ride.completed_at is None
        assert ride.tracking_token_hash == hashlib.sha256(created["tracking_token"].encode()).hexdigest()
        assert ride.tracking_token_hash != created["tracking_token"]
        assert db.get(Shelter, 1).available_beds == 5  # Not a reservation.
    pending = client.get("/api/drivers/requests", headers=headers())
    assert created["id"] in [ride["id"] for ride in pending.json()]
    assert created["tracking_token"] not in pending.text
    accepted = client.post(f"/api/rides/{created['id']}/accept", headers=headers())
    assert accepted.status_code == 200
    assert "tracking_token" not in accepted.json()
    assert "tracking_token_hash" not in accepted.json()
    assert client.patch(f"/api/rides/{created['id']}/status", headers=headers(), json={"status": "IN_PROGRESS"}).status_code == 200
    assert client.patch(f"/api/rides/{created['id']}/status", headers=headers(), json={"status": "COMPLETED"}).status_code == 200


@pytest.mark.parametrize("pickup", [
    {"pickup_latitude": 0, "pickup_longitude": 0},
    {"pickup_latitude": -90.0, "pickup_longitude": 180.0},
    {"pickup_latitude": 33.5207, "pickup_longitude": -86.8025, "pickup_address": " "},
    {"pickup_address": "Demo address"},
    {"pickup_address": "Demo address", "pickup_latitude": None, "pickup_longitude": None},
])
def test_creation_accepts_address_or_complete_coordinates(api, pickup):
    client, _ = api
    payload = {"first_name": "Demo", "last_name": "Rider", "shelter_id": 1} | pickup
    first = client.post("/api/rides", json=payload)
    second = client.post("/api/rides", json=payload)
    assert first.status_code == second.status_code == 201
    assert first.json()["tracking_token"] != second.json()["tracking_token"]
    assert first.json()["id"] != second.json()["id"]


@pytest.mark.parametrize("overrides", [
    {"first_name": None}, {"first_name": " "}, {"last_name": ""}, {"last_name": 123},
    {"pickup_address": None}, {"pickup_address": " "}, {"pickup_address": 123},
    {"pickup_latitude": 33.5}, {"pickup_longitude": -86.8},
    {"pickup_latitude": 91, "pickup_longitude": 0},
    {"pickup_latitude": 0, "pickup_longitude": -181},
    {"pickup_latitude": True, "pickup_longitude": 0},
    {"pickup_latitude": "33.5", "pickup_longitude": 0},
    {"shelter_id": 0}, {"shelter_id": None}, {"shelter_id": "1"}, {"shelter_id": True},
    {"driver_id": 1}, {"status": "ACCEPTED"}, {"tracking_token_hash": "chosen"},
])
def test_invalid_ride_input_is_rejected_without_writes(api, overrides):
    client, engine = api
    payload = {"first_name": "Demo", "last_name": "Rider", "pickup_address": "Demo pickup", "shelter_id": 1}
    with Session(engine) as db:
        before = db.scalar(select(func.count()).select_from(RideRequest))
    assert client.post("/api/rides", json=payload | overrides).status_code == 422
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(RideRequest)) == before


def test_creation_requires_fields_and_existing_shelter_with_beds(api):
    client, engine = api
    assert client.post("/api/rides", json={}).status_code == 422
    payload = {"first_name": "Demo", "last_name": "Rider", "pickup_address": "Demo pickup", "shelter_id": 999}
    assert client.post("/api/rides", json=payload).status_code == 404
    with Session(engine) as db:
        db.get(Shelter, 1).available_beds = 0
        db.commit()
    assert client.post("/api/rides", json=payload | {"shelter_id": 1}).status_code == 409
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(RideRequest)) == 3


def parallel_calls(calls):
    barrier = Barrier(len(calls))

    def invoke(call):
        barrier.wait(timeout=10)
        return call()

    with ThreadPoolExecutor(max_workers=len(calls)) as executor:
        return list(executor.map(invoke, calls))


@pytest.mark.parametrize("same_driver", [False, True])
def test_acceptance_races(api, same_driver):
    client, engine = api
    requests = [("driver-1", 1), ("driver-1" if same_driver else "driver-2", 2 if same_driver else 1)]
    responses = parallel_calls([
        lambda user=user, ride_id=ride_id: client.post(f"/api/rides/{ride_id}/accept", headers=headers(user))
        for user, ride_id in requests
    ])
    assert sorted(response.status_code for response in responses) == [200, 409]
    with Session(engine) as db:
        active = list(db.scalars(select(RideRequest).where(RideRequest.status == "ACCEPTED")))
        assert len(active) == 1
        assert active[0].driver_id is not None
        assert active[0].accepted_at is not None


def test_demo_verification_is_local_only(api, monkeypatch, capsys):
    from scripts import verify_demo_driver

    _, engine = api
    monkeypatch.setattr(verify_demo_driver, "SessionLocal", lambda: Session(engine))
    monkeypatch.setattr("sys.argv", ["verify_demo_driver.py", "unverified", "--demo"])
    verify_demo_driver.main()
    assert "Demo driver verified" in capsys.readouterr().out
    with Session(engine) as db:
        assert db.get(Driver, 3).is_verified is True
        assert db.get(Driver, 3).is_available is False
    monkeypatch.setattr("sys.argv", ["verify_demo_driver.py", "unverified"])
    with pytest.raises(SystemExit) as error:
        verify_demo_driver.main()
    assert error.value.code == 2
    assert not any("verify" in route for route in app.openapi()["paths"])


def test_concurrent_status_updates_only_allow_one_terminal_outcome(api):
    client, engine = api
    assert client.post("/api/rides/1/accept", headers=headers()).status_code == 200
    responses = parallel_calls([
        lambda status=status: client.patch("/api/rides/1/status", headers=headers(), json={"status": status})
        for status in ("IN_PROGRESS", "CANCELLED")
    ])
    assert sorted(response.status_code for response in responses) == [200, 409]
    with Session(engine) as db:
        assert db.get(RideRequest, 1).status in ("IN_PROGRESS", "CANCELLED")


def test_concurrent_initialization_is_idempotent(api):
    client, engine = api
    responses = parallel_calls([
        lambda: client.post("/api/drivers/me/initialize", headers=headers("new-user"), json={"phone_number": "001", "vehicle": VEHICLE})
        for _ in range(2)
    ])
    assert [response.status_code for response in responses] == [200, 200]
    assert responses[0].json() == responses[1].json()
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Driver).where(Driver.auth_user_id == "new-user")) == 1
        assert db.scalar(select(func.count()).select_from(Car)) == 1
