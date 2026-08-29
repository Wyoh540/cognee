from uuid import UUID
from typing import Union

import sqlalchemy.exc
from sqlalchemy import select

from cognee.infrastructure.databases.relational import get_relational_engine
from cognee.modules.users.methods.get_user import get_user
from cognee.modules.users.models.UserTenant import UserTenant
from cognee.modules.users.models.User import User
from cognee.modules.users.permissions.methods import get_tenant
from cognee.modules.users.exceptions import UserNotFoundError, TenantNotFoundError


async def select_tenant(
    user_id: UUID, tenant_id: Union[UUID, None], *, persist: bool = True
) -> User:
    """
        Validate a tenant selection and return a request-local user view.

        HTTP callers use ``persist=False`` and send ``X-Cognee-Tenant-Id`` on
        subsequent requests so concurrent tabs do not race. The default keeps
        the SDK's legacy persisted-selection behavior.
    Args:
        user_id: UUID of the user.
        tenant_id: Id of the tenant.

    Returns:
        None

    """
    db_engine = get_relational_engine()

    # Resolve user + tenant (each opens its own session) BEFORE opening ours, so
    # this request never holds two pooled connections at once — that overlap
    # deadlocks the pool under concurrency (issue #4197 class).
    user = await get_user(user_id)
    tenant = await get_tenant(tenant_id) if tenant_id is not None else None

    async with db_engine.get_async_session() as session:
        if tenant_id is None:
            user.tenant_id = None
            if persist:
                await session.merge(user)
                await session.commit()
            return user

        if not user:
            raise UserNotFoundError
        elif not tenant:
            raise TenantNotFoundError

        # Check if User is part of Tenant
        result = await session.execute(
            select(UserTenant)
            .where(UserTenant.user_id == user.id)
            .where(UserTenant.tenant_id == tenant_id)
        )

        try:
            result = result.scalar_one()
        except sqlalchemy.exc.NoResultFound as e:
            raise TenantNotFoundError("User is not part of the tenant.") from e

        if result:
            # Mutate only this detached/in-memory instance. The authenticated
            # request dependency performs the same membership validation for
            # every request carrying the workspace header.
            user.tenant_id = tenant_id
            if persist:
                await session.merge(user)
                await session.commit()
            return user
