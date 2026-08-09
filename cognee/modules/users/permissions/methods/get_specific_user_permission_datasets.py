from uuid import UUID
from typing import Optional, Union
from cognee.modules.data.models.Dataset import Dataset
from cognee.modules.users.models import User
from cognee.modules.users.permissions.methods.get_all_user_permission_datasets import (
    get_all_user_permission_datasets,
)
from cognee.modules.users.exceptions import PermissionDeniedError
from cognee.modules.users.methods import get_user


async def get_specific_user_permission_datasets(
    user: Union[User, UUID], permission_type: str, dataset_ids: Optional[list[UUID]] = None
) -> list[Dataset]:
    """
        Return a list of datasets user has given permission for. If a list of datasets is provided,
        verify for which datasets user has appropriate permission for and return list of datasets he has permission for.
    Args:
        user: Request-scoped user, or a user ID for backwards compatibility.
        permission_type: Type of the permission.
        dataset_ids: Ids of the provided datasets

    Returns:
        list[Dataset]: List of datasets user has permission for
    """
    # Keep the request-scoped User instance when supplied: its tenant_id may
    # have been selected through X-Cognee-Tenant-Id for this request. Re-fetching
    # by ID would silently revert to the persisted/default tenant.
    if isinstance(user, UUID):
        user = await get_user(user)
    # Find all datasets user has permission for
    user_permission_access_datasets = await get_all_user_permission_datasets(user, permission_type)

    # if specific datasets are provided filter out non provided datasets
    if dataset_ids:
        search_datasets = [
            dataset for dataset in user_permission_access_datasets if dataset.id in dataset_ids
        ]
        # If there are requested datasets that user does not have access to raise error
        if len(search_datasets) != len(dataset_ids):
            raise PermissionDeniedError(
                f"Request owner does not have necessary permission: [{permission_type}] for all datasets requested."
            )
    else:
        search_datasets = user_permission_access_datasets

    if len(search_datasets) == 0:
        raise PermissionDeniedError(
            f"Request owner does not have permission: [{permission_type}] for any dataset."
        )

    return search_datasets
