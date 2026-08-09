from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4
import importlib

import pytest

from cognee.modules.users.permissions.methods.get_all_user_permission_datasets import (
    get_all_user_permission_datasets,
)
from cognee.modules.users.permissions.methods.get_specific_user_permission_datasets import (
    get_specific_user_permission_datasets,
)

all_permissions_module = importlib.import_module(
    "cognee.modules.users.permissions.methods.get_all_user_permission_datasets"
)
specific_permissions_module = importlib.import_module(
    "cognee.modules.users.permissions.methods.get_specific_user_permission_datasets"
)


class AwaitableAttributes:
    def __init__(self, tenants, roles):
        self.tenants = self._value(tenants)
        self.roles = self._value(roles)

    @staticmethod
    async def _value(value):
        return value


@pytest.mark.asyncio
async def test_permissions_only_use_principals_from_active_tenant(monkeypatch):
    active_tenant_id = uuid4()
    other_tenant_id = uuid4()
    user_dataset = SimpleNamespace(id=uuid4(), tenant_id=active_tenant_id)
    tenant_dataset = SimpleNamespace(id=uuid4(), tenant_id=active_tenant_id)
    active_role_dataset = SimpleNamespace(id=uuid4(), tenant_id=active_tenant_id)
    leaked_role_dataset = SimpleNamespace(id=uuid4(), tenant_id=active_tenant_id)

    active_tenant = SimpleNamespace(id=active_tenant_id)
    other_tenant = SimpleNamespace(id=other_tenant_id)
    active_role = SimpleNamespace(id=uuid4(), tenant_id=active_tenant_id)
    other_role = SimpleNamespace(id=uuid4(), tenant_id=other_tenant_id)
    user = SimpleNamespace(
        id=uuid4(),
        tenant_id=active_tenant_id,
        awaitable_attrs=AwaitableAttributes(
            [active_tenant, other_tenant], [active_role, other_role]
        ),
    )

    datasets_by_principal = {
        user.id: [user_dataset],
        active_tenant.id: [tenant_dataset],
        other_tenant.id: [],
        active_role.id: [active_role_dataset],
        other_role.id: [leaked_role_dataset],
    }
    get_datasets = AsyncMock(side_effect=lambda principal, _: datasets_by_principal[principal.id])
    monkeypatch.setattr(all_permissions_module, "get_principal_datasets", get_datasets)

    result = await get_all_user_permission_datasets(user, "read")

    assert {dataset.id for dataset in result} == {
        user_dataset.id,
        tenant_dataset.id,
        active_role_dataset.id,
    }
    assert other_tenant.id not in [call.args[0].id for call in get_datasets.await_args_list]
    assert other_role.id not in [call.args[0].id for call in get_datasets.await_args_list]


@pytest.mark.asyncio
async def test_specific_permissions_preserve_request_scoped_tenant(monkeypatch):
    active_tenant_id = uuid4()
    dataset = SimpleNamespace(id=uuid4(), tenant_id=active_tenant_id)
    user = SimpleNamespace(id=uuid4(), tenant_id=active_tenant_id)
    get_all = AsyncMock(return_value=[dataset])
    get_user = AsyncMock()
    monkeypatch.setattr(specific_permissions_module, "get_all_user_permission_datasets", get_all)
    monkeypatch.setattr(specific_permissions_module, "get_user", get_user)

    result = await get_specific_user_permission_datasets(user, "read", [dataset.id])

    assert result == [dataset]
    get_user.assert_not_awaited()
    get_all.assert_awaited_once_with(user, "read")
