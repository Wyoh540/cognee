from collections import defaultdict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from cognee.infrastructure.databases.relational import get_relational_engine

from ...models.ACL import ACL


async def get_dataset_principals_permissions(dataset_id: UUID) -> dict[UUID, set[str]]:
    """
    Return a mapping of principal_id → set of permission names for a given dataset.

    Queries all ACL entries where dataset_id matches and groups permission names
    by principal. Principals include users, roles, and tenants (the workspace).

    Args:
        dataset_id: The dataset UUID to query permissions for.

    Returns:
        dict mapping principal UUIDs to sets of permission name strings
        (e.g. {"read", "write", "delete", "share"}).
    """
    db_engine = get_relational_engine()

    async with db_engine.get_async_session() as session:
        result = await session.execute(
            select(ACL)
            .join(ACL.permission)
            .options(joinedload(ACL.permission))
            .where(ACL.dataset_id == dataset_id)
        )
        acls = result.unique().scalars().all()

    permissions_map: dict[UUID, set[str]] = defaultdict(set)

    for acl in acls:
        permissions_map[acl.principal_id].add(acl.permission.name)

    return dict(permissions_map)
