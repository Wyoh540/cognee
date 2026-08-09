import os
import secrets
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from cognee.infrastructure.databases.relational import get_relational_engine
from cognee.modules.users.authentication.default.default_transport import default_transport
from cognee.modules.users.authentication.get_client_auth_backend import get_client_auth_backend
from cognee.modules.users.methods import create_user, get_authenticated_user
from cognee.modules.users.models import OIDCIdentity, OIDCProvider, User
from cognee.modules.users.oidc import (
    DEFAULT_SCOPES,
    authorization_url,
    decode_state,
    discovery,
    encode_state,
    encrypt_client_secret,
    exchange_code,
    make_pkce,
    normalize_slug,
    validate_id_token,
    validate_issuer,
)

STATE_COOKIE = "cognee_oidc_state"


class ProviderBody(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=64)
    issuer: str = Field(min_length=1, max_length=2048)
    client_id: str = Field(min_length=1, max_length=512)
    client_secret: str | None = Field(default=None, max_length=4096)
    scopes: str = Field(default=DEFAULT_SCOPES, min_length=6, max_length=1024)
    enabled: bool = True


def _provider_json(provider: OIDCProvider, public: bool = False) -> dict:
    value = {"name": provider.name, "slug": provider.slug}
    if public:
        return value
    return {
        **value,
        "id": str(provider.id),
        "issuer": provider.issuer,
        "client_id": provider.client_id,
        "client_secret_configured": bool(provider.client_secret_ciphertext),
        "scopes": provider.scopes,
        "enabled": provider.enabled,
        "created_at": provider.created_at.isoformat() if provider.created_at else None,
        "updated_at": provider.updated_at.isoformat() if provider.updated_at else None,
    }


def _require_superuser(user: User) -> None:
    if not user.is_superuser:
        raise HTTPException(403, "Superuser privileges required.")


def get_oidc_router() -> APIRouter:
    router = APIRouter()

    @router.get("/providers")
    async def public_providers():
        engine = get_relational_engine()
        async with engine.get_async_session() as session:
            providers = (await session.execute(select(OIDCProvider).where(OIDCProvider.enabled.is_(True)).order_by(OIDCProvider.name))).scalars().all()
            return [_provider_json(provider, public=True) for provider in providers]

    @router.get("/{slug}/login")
    async def oidc_login(slug: str, request: Request):
        engine = get_relational_engine()
        async with engine.get_async_session() as session:
            provider = (await session.execute(select(OIDCProvider).where(OIDCProvider.slug == slug, OIDCProvider.enabled.is_(True)))).scalar_one_or_none()
            if not provider:
                raise HTTPException(404, "OIDC provider not found.")
            document = await discovery(provider.issuer)
            verifier, challenge = make_pkce()
            redirect_uri = str(request.url_for("oidc_callback", slug=provider.slug))
            state_token = encode_state({"provider_id": str(provider.id), "verifier": verifier})
            state = decode_state(state_token)
            response = RedirectResponse(authorization_url(document, provider, redirect_uri, state, challenge))
            response.set_cookie(STATE_COOKIE, state_token, max_age=600, httponly=True, secure=request.url.scheme == "https", samesite="lax", path="/api/v1/auth/oidc")
            return response

    @router.get("/{slug}/callback", name="oidc_callback")
    async def oidc_callback(slug: str, request: Request, code: str, state: str):
        state_token = request.cookies.get(STATE_COOKIE)
        if not state_token:
            raise HTTPException(400, "Missing OIDC state cookie.")
        state_data = decode_state(state_token)
        if not secrets.compare_digest(state, state_data["state"]):
            raise HTTPException(400, "OIDC state mismatch.")

        engine = get_relational_engine()
        async with engine.get_async_session() as session:
            provider = (await session.execute(select(OIDCProvider).where(OIDCProvider.id == UUID(state_data["provider_id"]), OIDCProvider.slug == slug, OIDCProvider.enabled.is_(True)))).scalar_one_or_none()
            if not provider:
                raise HTTPException(404, "OIDC provider not found.")
            document = await discovery(provider.issuer)
            redirect_uri = str(request.url_for("oidc_callback", slug=provider.slug))
            tokens = await exchange_code(document, provider, code, redirect_uri, state_data["verifier"])
            if not tokens.get("id_token"):
                raise HTTPException(400, "OIDC provider did not return an ID token.")
            claims = await validate_id_token(document, provider, tokens["id_token"], state_data["nonce"])

            identity = (await session.execute(select(OIDCIdentity).where(OIDCIdentity.provider_id == provider.id, OIDCIdentity.subject == claims["sub"]))).scalar_one_or_none()
            user = await session.get(User, identity.user_id) if identity else None
            if not user:
                email = claims.get("email")
                if not email or claims.get("email_verified") is not True:
                    raise HTTPException(400, "OIDC provider must supply a verified email address.")
                user = (await session.execute(select(User).where(User.email == email.lower()))).scalar_one_or_none()
                if not user:
                    user = await create_user(email=email.lower(), password=secrets.token_urlsafe(48), is_verified=True)
                session.add(OIDCIdentity(provider_id=provider.id, user_id=user.id, subject=claims["sub"]))
                try:
                    await session.commit()
                except IntegrityError as exc:
                    raise HTTPException(409, "OIDC identity is already linked.") from exc
            if not user.is_active:
                raise HTTPException(403, "User account is inactive.")

            token = await get_client_auth_backend().get_strategy().write_token(user)
            response = RedirectResponse(os.getenv("OIDC_FRONTEND_REDIRECT_URL", "http://localhost:3000/"))
            response.set_cookie(key=default_transport.cookie_name, value=token, max_age=default_transport.cookie_max_age, path=default_transport.cookie_path, domain=default_transport.cookie_domain, secure=default_transport.cookie_secure, httponly=default_transport.cookie_httponly, samesite=default_transport.cookie_samesite)
            response.delete_cookie(STATE_COOKIE, path="/api/v1/auth/oidc")
            return response

    return router


def get_oidc_admin_router() -> APIRouter:
    router = APIRouter()

    @router.get("/oidc/providers")
    async def list_providers(user: User = Depends(get_authenticated_user)):
        _require_superuser(user)
        engine = get_relational_engine()
        async with engine.get_async_session() as session:
            providers = (await session.execute(select(OIDCProvider).order_by(OIDCProvider.name))).scalars().all()
            return [_provider_json(provider) for provider in providers]

    @router.post("/oidc/providers", status_code=201)
    async def create_provider(body: ProviderBody, user: User = Depends(get_authenticated_user)):
        _require_superuser(user)
        if not body.client_secret:
            raise HTTPException(400, "client_secret is required.")
        issuer = validate_issuer(body.issuer)
        await discovery(issuer)
        encrypted = encrypt_client_secret(body.client_secret)
        provider = OIDCProvider(name=body.name, slug=normalize_slug(body.slug), issuer=issuer, client_id=body.client_id, client_secret_ciphertext=encrypted[0], client_secret_nonce=encrypted[1], encryption_version=encrypted[2], key_id=encrypted[3], scopes=body.scopes, enabled=body.enabled)
        engine = get_relational_engine()
        async with engine.get_async_session() as session:
            session.add(provider)
            try:
                await session.commit()
                await session.refresh(provider)
            except IntegrityError as exc:
                raise HTTPException(409, "Provider slug already exists.") from exc
            return _provider_json(provider)

    @router.put("/oidc/providers/{provider_id}")
    async def update_provider(provider_id: UUID, body: ProviderBody, user: User = Depends(get_authenticated_user)):
        _require_superuser(user)
        issuer = validate_issuer(body.issuer)
        await discovery(issuer)
        engine = get_relational_engine()
        async with engine.get_async_session() as session:
            provider = await session.get(OIDCProvider, provider_id)
            if not provider:
                raise HTTPException(404, "OIDC provider not found.")
            provider.name, provider.slug, provider.issuer = body.name, normalize_slug(body.slug), issuer
            provider.client_id, provider.scopes, provider.enabled = body.client_id, body.scopes, body.enabled
            provider.updated_at = datetime.now(timezone.utc)
            if body.client_secret:
                encrypted = encrypt_client_secret(body.client_secret)
                provider.client_secret_ciphertext, provider.client_secret_nonce, provider.encryption_version, provider.key_id = encrypted
            try:
                await session.commit()
                await session.refresh(provider)
            except IntegrityError as exc:
                raise HTTPException(409, "Provider slug already exists.") from exc
            return _provider_json(provider)

    return router
