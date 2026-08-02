from uuid import UUID
from typing import Optional
from cognee.infrastructure.databases.relational import get_relational_engine
from ..exceptions import UnauthorizedDataAccessError
from ..models import Data


async def get_data(
    user_id: UUID,
    data_id: UUID,
    skip_owner_check: bool = False,
) -> Optional[Data]:
    """Retrieve data by ID.

    When ``skip_owner_check`` is ``True``, the caller has already verified that
    the user has access to the dataset containing this data (e.g. via
    ``get_authorized_existing_datasets`` with ``"read"``), so the owner check is
    skipped.

    Args:
        user_id (UUID): user ID
        data_id (UUID): ID of the data to retrieve
        skip_owner_check (bool): If True, skip the owner_id permission check

    Returns:
        Optional[Data]: The requested data object if found, None otherwise
    """
    db_engine = get_relational_engine()

    async with db_engine.get_async_session() as session:
        data = await session.get(Data, data_id)

        if not skip_owner_check and data and data.owner_id != user_id:
            raise UnauthorizedDataAccessError(
                message=f"User {user_id} is not authorized to access data {data_id}"
            )

        return data
