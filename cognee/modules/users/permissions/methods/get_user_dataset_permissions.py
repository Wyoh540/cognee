from collections import defaultdict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from cognee.infrastructure.databases.relational import get_relational_engine

from ...models.User import User
from ...models.ACL import ACL


async def get_user_dataset_permissions(user: User) -> dict[UUID, set[str]]:
    """
    Return a mapping of dataset_id → set of permission names for the current user.

    Combines ACL entries from the user, every tenant the user belongs to, and
    every role assigned to the user.  Only datasets that belong to the user's
    active tenant are included (the same filter applied by
    get_all_user_permission_datasets).

    Args:
        user: Authenticated user whose permissions should be resolved.

    Returns:
        dict mapping dataset UUIDs to sets of permission name strings
        (e.g. {"read", "write", "delete", "share"}).
    """
    # Collect all principal IDs whose ACLs matter for this user:
    #   - the user itself
    #   - every tenant the user is a member of
    #   - every role assigned to the user
    principal_ids = [user.id]

    tenants = await user.awaitable_attrs.tenants
    for tenant in tenants:
        principal_ids.append(tenant.id)

    roles = await user.awaitable_attrs.roles
    for role in roles:
        principal_ids.append(role.id)

    if not principal_ids:
        return {}

    db_engine = get_relational_engine()

    async with db_engine.get_async_session() as session:
        result = await session.execute(
            select(ACL)
            .join(ACL.permission)
            .options(joinedload(ACL.dataset), joinedload(ACL.permission))
            .where(ACL.principal_id.in_(principal_ids))
        )
        acls = result.unique().scalars().all()

    permissions_map: dict[UUID, set[str]] = defaultdict(set)

    for acl in acls:
        # Only include datasets that belong to the user's currently-selected
        # tenant — matches the filtering in get_all_user_permission_datasets.
        if acl.dataset is not None and acl.dataset.tenant_id == user.tenant_id:
            permissions_map[acl.dataset.id].add(acl.permission.name)

    return permissions_map
