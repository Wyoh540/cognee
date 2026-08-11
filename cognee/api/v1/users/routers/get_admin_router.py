from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi_users.exceptions import UserAlreadyExists
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from cognee import __version__ as cognee_version
from cognee.modules.users.models import User
from cognee.modules.users.models import DatasetDatabase
from cognee.modules.data.models import Dataset
from cognee.api.v1.datasets.routers.get_datasets_router import (
    DatasetDatabaseConfigUpdateDTO,
    _dataset_database_config_response,
)
from cognee.modules.users.models.Tenant import Tenant
from cognee.modules.users.models.UserTenant import UserTenant
from cognee.modules.users.methods import create_user, get_authenticated_user
from cognee.infrastructure.databases.relational import get_relational_engine
from cognee.shared.utils import send_telemetry


class PatchUserBody(BaseModel):
    is_superuser: Optional[bool] = None
    is_active: Optional[bool] = None


class CreateUserBody(BaseModel):
    email: EmailStr
    password: str
    is_superuser: bool = False
    is_active: bool = True


def get_admin_router() -> APIRouter:
    """Return a FastAPI router with admin-only endpoints for platform management.

    Every endpoint checks user.is_superuser at entry. Non-superuser callers
    receive 403. Do NOT add non-admin endpoints to this router.
    """
    admin_router = APIRouter()

    @admin_router.get("/tenants")
    async def list_all_tenants(user: User = Depends(get_authenticated_user)):
        """List all tenants with owner email and member count. Superuser only."""
        if not user.is_superuser:
            return JSONResponse(
                status_code=403,
                content={"detail": "Superuser privileges required."},
            )

        db_engine = get_relational_engine()
        async with db_engine.get_async_session() as session:
            # Subquery: count members per tenant
            cnt_subq = (
                select(UserTenant.tenant_id, func.count().label("cnt"))
                .group_by(UserTenant.tenant_id)
                .subquery()
            )

            query = (
                select(
                    Tenant,
                    User.email.label("owner_email"),
                    func.coalesce(cnt_subq.c.cnt, 0).label("member_count"),
                )
                .outerjoin(User, Tenant.owner_id == User.id)
                .outerjoin(cnt_subq, Tenant.id == cnt_subq.c.tenant_id)
            )

            result = await session.execute(query)
            rows = result.all()

            return [
                {
                    "id": str(row.Tenant.id),
                    "name": row.Tenant.name,
                    "owner_email": row.owner_email or "unknown",
                    "member_count": row.member_count,
                    "created_at": row.Tenant.created_at.isoformat()
                    if row.Tenant.created_at
                    else None,
                }
                for row in rows
            ]

    @admin_router.get("/tenants/{tenant_id}")
    async def get_tenant_detail(tenant_id: UUID, user: User = Depends(get_authenticated_user)):
        """Get single tenant detail with member list. Superuser only."""
        if not user.is_superuser:
            return JSONResponse(
                status_code=403,
                content={"detail": "Superuser privileges required."},
            )

        db_engine = get_relational_engine()
        async with db_engine.get_async_session() as session:
            # Get tenant
            tenant_q = select(Tenant).where(Tenant.id == tenant_id)
            tenant_result = await session.execute(tenant_q)
            tenant = tenant_result.scalar_one_or_none()
            if not tenant:
                return JSONResponse(status_code=404, content={"detail": "Tenant not found."})

            # Get owner email
            owner_q = select(User).where(User.id == tenant.owner_id)
            owner_result = await session.execute(owner_q)
            owner = owner_result.scalar_one_or_none()

            # Get members
            members_q = (
                select(User)
                .join(UserTenant, User.id == UserTenant.user_id)
                .where(UserTenant.tenant_id == tenant_id)
            )
            members_result = await session.execute(members_q)
            members = members_result.scalars().all()

            datasets_result = await session.execute(
                select(Dataset, DatasetDatabase)
                .outerjoin(DatasetDatabase, DatasetDatabase.dataset_id == Dataset.id)
                .where(Dataset.tenant_id == tenant_id)
                .order_by(Dataset.created_at.desc())
            )
            tenant_datasets = [
                {
                    "id": str(dataset.id),
                    "name": dataset.name,
                    "database_config": (
                        _dataset_database_config_response(database) if database else None
                    ),
                }
                for dataset, database in datasets_result.all()
            ]

            return {
                "id": str(tenant.id),
                "name": tenant.name,
                "owner_email": owner.email if owner else "unknown",
                "created_at": tenant.created_at.isoformat() if tenant.created_at else None,
                "members": [{"id": str(m.id), "email": m.email} for m in members],
                "member_count": len(members),
                "datasets": tenant_datasets,
            }

    @admin_router.put("/tenants/{tenant_id}/datasets/{dataset_id}/database-config")
    async def update_tenant_dataset_database_config(
        tenant_id: UUID,
        dataset_id: UUID,
        body: DatasetDatabaseConfigUpdateDTO,
        user: User = Depends(get_authenticated_user),
    ):
        """Update a workspace dataset's database settings. Superuser only."""
        if not user.is_superuser:
            return JSONResponse(
                status_code=403,
                content={"detail": "Superuser privileges required."},
            )

        db_engine = get_relational_engine()
        async with db_engine.get_async_session() as session:
            dataset = await session.scalar(
                select(Dataset).where(Dataset.id == dataset_id, Dataset.tenant_id == tenant_id)
            )
            if not dataset:
                return JSONResponse(status_code=404, content={"detail": "Dataset not found."})

            record = await session.scalar(
                select(DatasetDatabase).where(DatasetDatabase.dataset_id == dataset_id)
            )
            if not record:
                return JSONResponse(
                    status_code=404,
                    content={"detail": "Dataset database config not found."},
                )

            updates = body.model_dump(exclude_unset=True)
            if "graph_database_name" in updates:
                record.graph_database_name = updates.pop("graph_database_name")
            if "vector_database_name" in updates:
                record.vector_database_name = updates.pop("vector_database_name")

            graph_info = dict(record.graph_database_connection_info or {})
            vector_info = dict(record.vector_database_connection_info or {})
            for key, value in updates.items():
                if value is None or (key.endswith("_password") and value == ""):
                    continue
                if key.startswith("graph_"):
                    graph_info[key] = value
                elif key.startswith("vector_"):
                    vector_info[key] = value
            record.graph_database_connection_info = graph_info
            record.vector_database_connection_info = vector_info
            await session.commit()
            await session.refresh(record)

        return _dataset_database_config_response(record)

    @admin_router.delete("/tenants/{tenant_id}")
    async def delete_tenant(tenant_id: UUID, user: User = Depends(get_authenticated_user)):
        """Delete a tenant. Superuser only."""
        if not user.is_superuser:
            return JSONResponse(
                status_code=403,
                content={"detail": "Superuser privileges required."},
            )

        db_engine = get_relational_engine()
        async with db_engine.get_async_session() as session:
            tenant_q = select(Tenant).where(Tenant.id == tenant_id)
            tenant_result = await session.execute(tenant_q)
            tenant = tenant_result.scalar_one_or_none()
            if not tenant:
                return JSONResponse(
                    status_code=404,
                    content={"detail": "Tenant not found."},
                )

            await session.delete(tenant)
            await session.commit()

        send_telemetry(
            "Admin API: Tenant Deleted",
            user.id,
            additional_properties={
                "tenant_id": str(tenant_id),
                "tenant_name": tenant.name,
                "cognee_version": cognee_version,
            },
        )

        return JSONResponse(status_code=200, content={"message": "Tenant deleted."})

    @admin_router.get("/users")
    async def list_all_users(user: User = Depends(get_authenticated_user)):
        """List all users in the system. Superuser only."""
        if not user.is_superuser:
            return JSONResponse(
                status_code=403,
                content={"detail": "Superuser privileges required."},
            )

        db_engine = get_relational_engine()
        async with db_engine.get_async_session() as session:
            query = select(User).options(selectinload(User.tenants))
            result = await session.execute(query)
            users = result.unique().scalars().all()

            return [
                {
                    "id": str(u.id),
                    "email": u.email,
                    "is_superuser": u.is_superuser,
                    "is_active": u.is_active,
                    "is_verified": u.is_verified,
                    "tenant_ids": [str(t.id) for t in u.tenants],
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                }
                for u in users
            ]

    @admin_router.post("/users", status_code=201)
    async def create_admin_user(
        body: CreateUserBody,
        user: User = Depends(get_authenticated_user),
    ):
        """Create a user account. Superuser only."""
        if not user.is_superuser:
            return JSONResponse(
                status_code=403,
                content={"detail": "Superuser privileges required."},
            )

        try:
            created_user = await create_user(
                email=body.email,
                password=body.password,
                is_superuser=body.is_superuser,
                is_active=body.is_active,
                is_verified=True,
            )
        except UserAlreadyExists:
            return JSONResponse(
                status_code=409,
                content={"detail": "A user with this email already exists."},
            )

        send_telemetry(
            "Admin API: User Created",
            user.id,
            additional_properties={
                "target_user_id": str(created_user.id),
                "is_superuser": created_user.is_superuser,
                "cognee_version": cognee_version,
            },
        )

        return {
            "id": str(created_user.id),
            "email": created_user.email,
            "is_superuser": created_user.is_superuser,
            "is_active": created_user.is_active,
            "is_verified": created_user.is_verified,
            "tenant_ids": [],
            "created_at": created_user.created_at.isoformat() if created_user.created_at else None,
        }

    @admin_router.patch("/users/{user_id}")
    async def patch_user(
        user_id: UUID,
        body: PatchUserBody,
        user: User = Depends(get_authenticated_user),
    ):
        """Update user superuser or active status. Superuser only."""
        if not user.is_superuser:
            return JSONResponse(
                status_code=403,
                content={"detail": "Superuser privileges required."},
            )

        if body.is_superuser is None and body.is_active is None:
            return JSONResponse(
                status_code=400,
                content={"detail": "At least one field is required."},
            )

        db_engine = get_relational_engine()
        async with db_engine.get_async_session() as session:
            user_q = select(User).where(User.id == user_id)
            user_result = await session.execute(user_q)
            target = user_result.scalar_one_or_none()
            if not target:
                return JSONResponse(
                    status_code=404,
                    content={"detail": "User not found."},
                )

            if body.is_superuser is not None:
                target.is_superuser = body.is_superuser
            if body.is_active is not None:
                target.is_active = body.is_active

            await session.commit()

        send_telemetry(
            "Admin API: User Patched",
            user.id,
            additional_properties={
                "target_user_id": str(user_id),
                "changes": body.model_dump(exclude_none=True),
                "cognee_version": cognee_version,
            },
        )

        return JSONResponse(status_code=200, content={"message": "User updated."})

    return admin_router
