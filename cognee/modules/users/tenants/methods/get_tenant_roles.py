from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID

from cognee.infrastructure.databases.relational import get_relational_engine
from cognee.modules.users.permissions.methods.has_tenant_membership import (
    has_tenant_membership,
)


async def get_tenant_roles(tenant_id: UUID, user):
    # Ensure the requesting user is a member of this tenant
    await has_tenant_membership(user.id, tenant_id)

    db_engine = get_relational_engine()
    async with db_engine.get_async_session() as session:
        from cognee.modules.users.models import Role

        roles_result = await session.execute(
            select(Role).options(selectinload(Role.users)).where(Role.tenant_id == tenant_id)
        )
        roles = roles_result.scalars().all()

        # Format response
        role_list = []
        for role in roles:
            role_list.append(
                {
                    "id": str(role.id),
                    "name": role.name,
                    "description": getattr(role, "description", None),
                    "user_count": len(role.users) if role.users else 0,
                }
            )

    return role_list
