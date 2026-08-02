from typing import Union
from uuid import UUID

from sqlalchemy import select

from cognee.infrastructure.databases.relational import get_relational_engine
from cognee.modules.data.models.Dataset import Dataset
from cognee.modules.data.exceptions import DatasetTypeError


async def get_dataset_ids(datasets: Union[list[str], list[UUID]], user):
    """
    Function returns dataset IDs necessary based on provided input.
    It transforms raw strings into real dataset_ids.

    For UUID inputs, they pass through directly.
    For string (name) inputs, ALL matching datasets across the tenant are
    resolved to UUIDs — not just the caller's own datasets — so that the
    downstream permission check (get_specific_user_permission_datasets via
    get_authorized_existing_datasets) can correctly reject a caller who
    lacks write permission instead of silently creating a duplicate dataset.

    Args:
        datasets: list of dataset names (str) or UUIDs
        user: the authenticated user

    Returns:
        list[UUID]: resolved dataset UUIDs (may be empty if no dataset
        exists under those names)
    """
    if all(isinstance(dataset, UUID) for dataset in datasets):
        # Return list of dataset UUIDs — downstream permission check handles enforcement
        dataset_ids = datasets
    else:
        # Convert list of dataset names to dataset UUID
        if all(isinstance(dataset, str) for dataset in datasets):
            # Query ALL datasets across the tenant by name (not just user-owned),
            # so that the downstream ACL-based permission check in
            # get_specific_user_permission_datasets can properly reject an
            # unauthorized caller instead of returning empty and triggering a
            # silent dataset creation in load_or_create_datasets.
            db_engine = get_relational_engine()
            async with db_engine.get_async_session() as session:
                result = await session.scalars(
                    select(Dataset)
                    .filter(Dataset.tenant_id == user.tenant_id)
                    .filter(Dataset.name.in_(datasets))
                )
                datasets_found = result.all()
                dataset_ids = [dataset.id for dataset in datasets_found]
        else:
            raise DatasetTypeError(
                f"One or more of the provided dataset types is not handled: f{datasets}"
            )

    return dataset_ids
