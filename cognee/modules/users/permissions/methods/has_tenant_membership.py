from uuid import UUID
from sqlalchemy import select

from cognee.infrastructure.databases.relational import get_relational_engine
from cognee.modules.users.exceptions import PermissionDeniedError
from cognee.modules.users.models.UserTenant import UserTenant


async def has_tenant_membership(user_id: UUID, tenant_id: UUID):
    """Check that a user is a member of the given tenant.

    Any member can see other members and roles in the tenant — unlike
    ``has_user_management_permission`` which requires owner/admin privileges.

    Raises:
        PermissionDeniedError: If the user is not a member of this tenant.
    """
    db_engine = get_relational_engine()
    async with db_engine.get_async_session() as session:
        result = await session.execute(
            select(UserTenant).where(
                UserTenant.user_id == user_id,
                UserTenant.tenant_id == tenant_id,
            )
        )
        if result.scalars().first() is None:
            raise PermissionDeniedError(message="User is not a member of this tenant")
