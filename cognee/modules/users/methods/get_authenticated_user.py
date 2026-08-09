import os
from typing import Optional
from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from ..models import User
from ..get_fastapi_users import get_fastapi_users
from .get_default_user import get_default_user
from .get_user import get_user
from cognee.shared.logging_utils import get_logger


logger = get_logger("get_authenticated_user")


def _resolve_auth_posture() -> tuple[bool, bool, str]:
    """Resolve authentication + access-control posture from env vars.

    Returns ``(require_authentication, enable_backend_access_control, reason)``.

    Semantics:
      * ``ENABLE_BACKEND_ACCESS_CONTROL`` is the canonical posture switch
        (multi-tenant on/off, default on).
      * ``REQUIRE_AUTHENTICATION`` controls whether endpoints demand a user.
        If unset, it inherits from ``ENABLE_BACKEND_ACCESS_CONTROL`` — turning
        off backend access control disables the auth requirement, matching
        single-user / internal-deployment expectations.
      * Invariant: multi-tenant mode requires authentication. Setting
        ``REQUIRE_AUTHENTICATION=false`` together with
        ``ENABLE_BACKEND_ACCESS_CONTROL=true`` is a misconfiguration; we log
        a warning and force auth on to keep per-user data isolated.
    """

    def _read_bool(name: str) -> tuple[Optional[bool], bool]:
        raw = os.environ.get(name)
        if raw is None or raw == "":
            return None, False
        return raw.lower() == "true", True

    access_value, access_explicit = _read_bool("ENABLE_BACKEND_ACCESS_CONTROL")
    require_value, require_explicit = _read_bool("REQUIRE_AUTHENTICATION")

    enable_access_control = True if access_value is None else access_value

    if require_explicit:
        assert require_value is not None  # require_explicit implies a parsed value
        require_authentication = require_value
        if enable_access_control and not require_authentication:
            logger.warning(
                "REQUIRE_AUTHENTICATION=false is incompatible with "
                "ENABLE_BACKEND_ACCESS_CONTROL=true: multi-tenant mode requires "
                "authentication. Forcing REQUIRE_AUTHENTICATION=true. "
                "To disable auth for a single-user deployment, also set "
                "ENABLE_BACKEND_ACCESS_CONTROL=false."
            )
            require_authentication = True
            reason = "forced on by multi-tenant mode (REQUIRE_AUTHENTICATION=false was ignored)"
        else:
            reason = "explicit REQUIRE_AUTHENTICATION"
    else:
        require_authentication = enable_access_control
        reason = (
            "inherited from ENABLE_BACKEND_ACCESS_CONTROL"
            if access_explicit
            else "default (no env vars set)"
        )

    return require_authentication, enable_access_control, reason


REQUIRE_AUTHENTICATION, ENABLE_BACKEND_ACCESS_CONTROL, _AUTH_REASON = _resolve_auth_posture()

logger.info(
    "auth posture: authentication=%s, multi_tenant=%s (%s)",
    "required" if REQUIRE_AUTHENTICATION else "disabled",
    "enabled" if ENABLE_BACKEND_ACCESS_CONTROL else "disabled",
    _AUTH_REASON,
)

fastapi_users = get_fastapi_users()

_auth_dependency = fastapi_users.current_user(active=True, optional=not REQUIRE_AUTHENTICATION)


async def get_tenant_header(
    tenant_header: Optional[str] = Header(default=None, alias="X-Cognee-Tenant-Id"),
) -> Optional[str]:
    """Return the request's explicit tenant selector, when present."""
    return tenant_header


async def get_authenticated_user(
    tenant: Optional[str] = Depends(get_tenant_header),
    user: Optional[User] = Depends(_auth_dependency),
) -> User:
    """
    Get authenticated user with environment-controlled behavior:
    - If REQUIRE_AUTHENTICATION=true: Enforces authentication (raises 401 if not authenticated)
    - If REQUIRE_AUTHENTICATION=false: Falls back to default user if not authenticated

    Always returns a User object for consistent typing.
    """
    if user is None:
        # When authentication is optional and user is None, use default user
        try:
            user = await get_default_user()
        except Exception as e:
            # Convert any get_default_user failure into a proper HTTP 500 error
            logger.error(f"Failed to create default user: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to create default user: {str(e)}"
            ) from e
    else:
        # FastAPI Users returns a session-bound instance without eager-loaded
        # relationships. Re-fetch so callers (including background tasks that
        # outlive the request) can access user.tenants / user.roles without
        # DetachedInstanceError.
        user = await get_user(user.id)

    # The active workspace is request-scoped. Persisting it on User.tenant_id
    # makes two browser tabs/devices race with each other, so an explicit
    # workspace header only overrides this in-memory instance for this request.
    # User.tenant_id remains a backwards-compatible default when the header is
    # absent.
    # Direct SDK/tests call this dependency as a regular function, in which
    # case FastAPI has not replaced the Header descriptor with a value.
    if tenant is not None and not isinstance(tenant, str):
        tenant = None

    if tenant:
        from uuid import UUID

        from cognee.infrastructure.databases.relational import get_relational_engine
        from cognee.modules.users.models.UserTenant import UserTenant

        try:
            active_tenant_id = UUID(tenant)
        except ValueError as error:
            raise HTTPException(
                status_code=400, detail="Invalid X-Cognee-Tenant-Id header."
            ) from error

        db_engine = get_relational_engine()
        async with db_engine.get_async_session() as session:
            membership = await session.scalar(
                select(UserTenant).where(
                    UserTenant.user_id == user.id,
                    UserTenant.tenant_id == active_tenant_id,
                )
            )

        if membership is None:
            # Avoid revealing whether an arbitrary workspace id exists.
            raise HTTPException(status_code=403, detail="User is not a member of this workspace.")

        user.tenant_id = active_tenant_id

    return user
