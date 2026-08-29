from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, LargeBinary, SmallInteger, String, UUID

from cognee.infrastructure.databases.relational import Base


class OIDCProvider(Base):
    __tablename__ = "oidc_providers"

    id = Column(UUID, primary_key=True, default=uuid4)
    name = Column(String(100), nullable=False)
    slug = Column(String(64), nullable=False, unique=True, index=True)
    issuer = Column(String(2048), nullable=False)
    client_id = Column(String(512), nullable=False)
    client_secret_ciphertext = Column(LargeBinary, nullable=False)
    client_secret_nonce = Column(LargeBinary, nullable=False)
    encryption_version = Column(SmallInteger, nullable=False, default=1)
    key_id = Column(String(64), nullable=False, default="1")
    scopes = Column(String(1024), nullable=False, default="openid profile email")
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
