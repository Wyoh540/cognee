import base64
import hashlib
import os
import re
import secrets
import time
from urllib.parse import urlencode, urlparse

import httpx
import jwt
from fastapi import HTTPException

from cognee.modules.integrations.crypto import decrypt_credentials, encrypt_credentials


DEFAULT_SCOPES = "openid profile email"


def normalize_slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9-]+", "-", value.lower()).strip("-")
    if not slug:
        raise HTTPException(400, "Provider slug must contain letters or numbers.")
    return slug


def validate_issuer(issuer: str) -> str:
    issuer = issuer.rstrip("/")
    parsed = urlparse(issuer)
    local = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    if parsed.scheme != "https" and not (parsed.scheme == "http" and local):
        raise HTTPException(400, "OIDC issuer must use HTTPS (HTTP is allowed for localhost).")
    return issuer


def encrypt_client_secret(secret: str) -> tuple[bytes, bytes, int, str]:
    return encrypt_credentials({"client_secret": secret})


def decrypt_client_secret(provider) -> str:
    return decrypt_credentials(
        provider.client_secret_ciphertext,
        provider.client_secret_nonce,
        provider.encryption_version,
        provider.key_id,
    )["client_secret"]


async def discovery(issuer: str) -> dict:
    async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
        response = await client.get(f"{issuer}/.well-known/openid-configuration")
        response.raise_for_status()
        document = response.json()
    if document.get("issuer", "").rstrip("/") != issuer.rstrip("/"):
        raise HTTPException(502, "OIDC discovery issuer mismatch.")
    for field in ("authorization_endpoint", "token_endpoint", "jwks_uri"):
        if not document.get(field):
            raise HTTPException(502, f"OIDC discovery document is missing {field}.")
    return document


def make_pkce() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    )
    return verifier, challenge


def encode_state(payload: dict) -> str:
    payload = {
        **payload,
        "nonce": secrets.token_urlsafe(24),
        "state": secrets.token_urlsafe(24),
        "exp": int(time.time()) + 600,
    }
    return jwt.encode(
        payload, os.getenv("FASTAPI_USERS_JWT_SECRET", "super_secret"), algorithm="HS256"
    )


def decode_state(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            os.getenv("FASTAPI_USERS_JWT_SECRET", "super_secret"),
            algorithms=["HS256"],
            options={"require": ["exp"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(400, "Invalid or expired OIDC state.") from exc


def authorization_url(
    document: dict, provider, redirect_uri: str, state: dict, challenge: str
) -> str:
    params = {
        "response_type": "code",
        "client_id": provider.client_id,
        "redirect_uri": redirect_uri,
        "scope": provider.scopes,
        "state": state["state"],
        "nonce": state["nonce"],
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    return f"{document['authorization_endpoint']}?{urlencode(params)}"


async def exchange_code(
    document: dict, provider, code: str, redirect_uri: str, verifier: str
) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            document["token_endpoint"],
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": provider.client_id,
                "client_secret": decrypt_client_secret(provider),
                "code_verifier": verifier,
            },
        )
        if response.is_error:
            raise HTTPException(400, "OIDC token exchange failed.")
        return response.json()


async def validate_id_token(document: dict, provider, token: str, nonce: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        jwks_response = await client.get(document["jwks_uri"])
        jwks_response.raise_for_status()
    header = jwt.get_unverified_header(token)
    supported_algorithms = set(document.get("id_token_signing_alg_values_supported", []))
    allowed_algorithms = supported_algorithms.intersection(
        {"RS256", "RS384", "RS512", "ES256", "ES384", "ES512", "PS256", "PS384", "PS512"}
    )
    if header.get("alg") not in allowed_algorithms:
        raise HTTPException(400, "OIDC ID token uses an unsupported signing algorithm.")
    key_data = next(
        (
            key
            for key in jwks_response.json().get("keys", [])
            if key.get("kid") == header.get("kid")
        ),
        None,
    )
    if not key_data:
        raise HTTPException(400, "OIDC signing key was not found.")
    claims = jwt.decode(
        token,
        jwt.PyJWK.from_dict(key_data).key,
        algorithms=list(allowed_algorithms),
        audience=provider.client_id,
        issuer=provider.issuer,
        options={"require": ["exp", "iat", "iss", "sub"]},
    )
    if claims.get("nonce") != nonce:
        raise HTTPException(400, "OIDC nonce mismatch.")
    return claims
