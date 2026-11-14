"""Endpoint tests with real SQLite transactions and dependency-injected identities."""
import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser, get_current_user
from app.database import Base, configure_sqlite, get_db
from app.main import app
from app.models import Shelter, ShelterAdmin


@pytest.fixture
def api(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'api.db'}", connect_args={"check_same_thread": False})
    event.listen(engine, "connect", configure_sqlite)
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(text('CREATE TABLE "user" (id TEXT PRIMARY KEY, role TEXT NOT NULL)'))
        conn.execute(text("INSERT INTO user VALUES ('admin', 'shelter_admin'), ('other', 'shelter_admin'), ('driver', 'driver')"))
    with Session(engine) as db:
        db.add_all([Shelter(id=i, name=f"Demo {i}", address="Fictional", total_beds=10,
                            available_beds=5, services=json.dumps(["Showers"])) for i in (1, 2)])
        db.add(ShelterAdmin(auth_user_id="admin", shelter_id=1))
        db.commit()
    def session():
        with Session(engine, expire_on_commit=False) as db:
            yield db
    app.dependency_overrides[get_db] = session
    client = TestClient(app)
    def login(role, id="admin"):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=id, role=role)
    yield client, login
    app.dependency_overrides.clear()
    client.close()
    engine.dispose()


def test_public_and_missing(api):
    client, _ = api
    assert len(client.get('/api/shelters').json()) == 2
    assert client.get('/api/shelters/1').json()['services'] == ['Showers']
    assert client.get('/api/shelters/999').status_code == 404
    assert client.get(f'/api/shelters/{2**63}').status_code == 404
    assert client.patch('/api/shelters/1', json={}).status_code == 401
    assert client.get('/api/admin/shelters').status_code == 401
    assert client.post('/api/admin/shelter-assignments', json={'auth_user_id': 'other', 'shelter_id': 1}).status_code == 401


def test_admin_visibility_and_updates(api):
    client, login = api
    login('shelter_admin')
    assert [s['id'] for s in client.get('/api/admin/shelters').json()] == [1]
    before = client.get('/api/shelters/1').json()['updated_at']
    result = client.patch('/api/shelters/1', json={'available_beds': 8, 'food_available': True, 'services': ['Laundry']})
    assert result.status_code == 200
    assert result.json()['updated_at'] != before
    assert result.json()['food_available'] is True
    assert result.json()['services'] == ['Laundry']
    assert client.get('/api/shelters/1').json()['available_beds'] == 8
    assert client.patch('/api/shelters/2', json={'available_beds': 2}).status_code == 403
    login('super_admin')
    assert len(client.get('/api/admin/shelters').json()) == 2
    assert client.patch('/api/shelters/2', json={'total_beds': 20, 'available_beds': 20}).status_code == 200
    assert client.patch('/api/shelters/999', json={}).status_code == 404
    login('driver')
    assert client.get('/api/admin/shelters').status_code == 403
    assert client.patch('/api/shelters/1', json={}).status_code == 403


@pytest.mark.parametrize('payload', [
    {'total_beds': 2**63}, {'available_beds': 2**63}, {'available_beds': -1}, {'available_beds': 11}, {'total_beds': 4},
    {'available_beds': 2.5}, {'available_beds': True}, {'available_beds': '2'},
    {'food_available': 1}, {'food_available': 'true'}, {'services': [' ']},
    {'services': 'Laundry'}, {'services': [1]}, {'name': 'Changed'},
    {'food_available': None}, {'services': None}, {'available_beds': None}, {'total_beds': None},
])
def test_invalid_update_preserves_data(api, payload):
    client, login = api
    login('super_admin')
    before = client.get('/api/shelters/1').json()
    assert client.patch('/api/shelters/1', json=payload).status_code == 422
    assert client.get('/api/shelters/1').json() == before


def test_assignment_roles_references_and_duplicates(api):
    client, login = api
    body = {'auth_user_id': 'other', 'shelter_id': 2}
    login('shelter_admin')
    assert client.post('/api/admin/shelter-assignments', json=body).status_code == 403
    login('super_admin')
    assert client.post('/api/admin/shelter-assignments', json=body).status_code == 201
    assert client.post('/api/admin/shelter-assignments', json=body).status_code == 409
    assert client.post('/api/admin/shelter-assignments', json=body | {'shelter_id': 999}).status_code == 404
    assert client.post('/api/admin/shelter-assignments', json=body | {'auth_user_id': 'missing'}).status_code == 404
    assert client.post('/api/admin/shelter-assignments', json=body | {'auth_user_id': 'driver'}).status_code == 422
    login('shelter_admin', 'other')
    assert [s['id'] for s in client.get('/api/admin/shelters').json()] == [2]
    assert client.patch('/api/shelters/2', json={'available_beds': 0}).status_code == 200
