from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID
from cognee.modules.users.models import User, Role, UserTenant
from cognee.infrastructure.databases.relational import get_relational_engine
from cognee.modules.users.permissions.methods.has_tenant_membership import (
    has_tenant_membership,
)


async def get_users_in_tenant(tenant_id: UUID, user: User):
    # Ensure the requesting user is a member of this tenant
    await has_tenant_membership(user.id, tenant_id)

    db_engine = get_relational_engine()
    async with db_engine.get_async_session() as session:
        query = (
            select(User)
            .join(UserTenant, User.id == UserTenant.user_id)
            .where(UserTenant.tenant_id == tenant_id)
            .options(selectinload(User.roles.and_(Role.tenant_id == tenant_id)))
        )

        result = await session.execute(query)
        users = result.scalars().all()

        # Format response
        user_data = []
        for u in users:
            user_data.append(
                {
                    "id": str(u.id),
                    "email": u.email,
                    "roles": [{"id": str(role.id), "name": role.name} for role in u.roles],
                }
            )

    return user_data
