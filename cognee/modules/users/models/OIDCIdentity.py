from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint, UUID

from cognee.infrastructure.databases.relational import Base


class OIDCIdentity(Base):
    __tablename__ = "oidc_identities"
    __table_args__ = (UniqueConstraint("provider_id", "subject", name="uq_oidc_identity"),)

    id = Column(UUID, primary_key=True, default=uuid4)
    provider_id = Column(UUID, ForeignKey("oidc_providers.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subject = Column(String(512), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

