"""Keep the importable Postman collection aligned with FastAPI's contract."""

import json
from pathlib import Path
import re

from app.driver_schemas import AvailabilityInput, InitializeInput, PhoneInput, StatusInput
from app.main import app
from app.ride_schemas import RideCreateInput


def test_postman_driver_collection_matches_routes_and_inputs():
    path = Path(__file__).resolve().parents[2] / "local" / "ShelterConnect-driver-workflow.postman_collection.json"
    collection = json.loads(path.read_text())
    assert collection["info"]["schema"].endswith("/v2.1.0/collection.json")
    variables = {variable["key"]: variable["value"] for variable in collection["variable"]}
    assert variables["driver_token"] == ""
    assert collection["auth"]["type"] == "bearer"
    operations = app.openapi()["paths"]
    expected_schemas = {"RideCreateInput": RideCreateInput, "InitializeInput": InitializeInput, "PhoneInput": PhoneInput, "AvailabilityInput": AvailabilityInput, "StatusInput": StatusInput}
    count = 0
    for folder in collection["item"]:
        for item in folder["item"]:
            request = item["request"]
            if request["url"].startswith("{{auth_base_url}}"):
                continue  # Better Auth has its own contract, not FastAPI's OpenAPI.
            path = request["url"].replace("{{base_url}}", "").replace("{{ride_id}}", "{ride_id}")
            operation = operations[path][request["method"].lower()]
            if "body" in request:
                raw = re.sub(r"\{\{(\w+)\}\}", lambda match: variables[match[1]], request["body"]["raw"])
                body = json.loads(raw)
                reference = operation["requestBody"]["content"]["application/json"]["schema"]["$ref"]
                expected_schemas[reference.rsplit("/", 1)[-1]].model_validate(body)
            assert item["event"][0]["listen"] == "test"
            count += 1
    assert count == 11
    create = next(item for folder in collection["item"] for item in folder["item"] if item["name"] == "Create ride request")
    assert create["request"]["auth"] == {"type": "noauth"}
    assert "pickup_address" not in create["request"]["body"]["raw"]
    assert "pickup_latitude" in create["request"]["body"]["raw"]
    assert "pickup_longitude" in create["request"]["body"]["raw"]
    script = "\n".join(create["event"][0]["script"]["exec"])
    assert "pm.collectionVariables.set('ride_id', String(ride.id))" in script
    assert "pm.collectionVariables.set('ride_tracking_token', ride.tracking_token)" in script
    offline = next(item for folder in collection["item"] for item in folder["item"] if item["name"] == "Go offline")
    assert offline["request"]["method"] == "PATCH"
    assert offline["request"]["url"] == "{{base_url}}/api/drivers/me/availability"
    assert json.loads(offline["request"]["body"]["raw"]) == {"is_available": False}


def test_postman_auth_requests_use_cookie_sessions_and_capture_jwt():
    path = Path(__file__).resolve().parents[2] / "local" / "ShelterConnect-driver-workflow.postman_collection.json"
    collection = json.loads(path.read_text())
    variables = {variable["key"]: variable["value"] for variable in collection["variable"]}
    assert variables["password"] == variables["email"] == variables["driver_token"] == ""
    requests = collection["item"][0]["item"]
    assert [(item["request"]["method"], item["request"]["url"]) for item in requests] == [
        ("POST", "{{auth_base_url}}/api/auth/sign-up/email"),
        ("POST", "{{auth_base_url}}/api/auth/sign-in/email"),
        ("GET", "{{auth_base_url}}/api/auth/token"),
    ]
    for item in requests:
        assert item["request"]["auth"] == {"type": "noauth"}
        assert {"key": "Origin", "value": "{{auth_origin}}"} in item["request"]["header"]
    for item in requests[:2]:
        prerequest = next(event for event in item["event"] if event["listen"] == "prerequest")
        script = "\n".join(prerequest["script"]["exec"])
        assert "JSON.stringify" in script
        assert "pm.variables.get('email')" in script
        assert "pm.variables.get('password')" in script
    token_script = "\n".join(requests[2]["event"][0]["script"]["exec"])
    assert "pm.collectionVariables.set('driver_token', token)" in token_script
