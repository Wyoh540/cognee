import time

import pytest
from fastapi import HTTPException

from cognee.modules.users.oidc import decode_state, encode_state, make_pkce, normalize_slug, validate_issuer


def test_slug_and_local_keycloak_issuer_are_normalized():
    assert normalize_slug("Company Keycloak") == "company-keycloak"
    assert validate_issuer("http://localhost:8080/realms/cognee/") == "http://localhost:8080/realms/cognee"


def test_insecure_remote_issuer_is_rejected():
    with pytest.raises(HTTPException, match="HTTPS"):
        validate_issuer("http://identity.example.com/realms/cognee")


def test_signed_state_round_trip(monkeypatch):
    monkeypatch.setenv("FASTAPI_USERS_JWT_SECRET", "test-secret-at-least-32-bytes-long")
    token = encode_state({"provider_id": "provider", "verifier": "verifier"})
    state = decode_state(token)
    assert state["provider_id"] == "provider"
    assert state["verifier"] == "verifier"
    assert state["exp"] > time.time()
    assert state["state"] and state["nonce"]


def test_pkce_values_are_url_safe_and_distinct():
    verifier, challenge = make_pkce()
    assert verifier != challenge
    assert "=" not in challenge
