from sqlalchemy import select
from uuid import UUID

from cognee.modules.users.models import User
from cognee.infrastructure.databases.relational import get_relational_engine
from cognee.modules.users.permissions.methods.has_tenant_membership import (
    has_tenant_membership,
)


async def get_user_roles(tenant_id: UUID, user_id: UUID, user: User):
    # Ensure the requesting user is a member of this tenant
    await has_tenant_membership(user.id, tenant_id)

    db_engine = get_relational_engine()
    async with db_engine.get_async_session() as session:
        from cognee.modules.users.models import Role

        role_results = await session.execute(
            select(Role).join(Role.users).where(User.id == user_id)
        )
        roles = role_results.scalars().all()

        # Format response
        role_list = []
        for role in roles:
            role_list.append(
                {
                    "id": str(role.id),
                    "name": role.name,
                }
            )

    return role_list
