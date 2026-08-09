"""add OIDC providers and identities

Revision ID: a9c1e7d4f2b6
Revises: c3d5e7f9a1b2
"""

from alembic import op
import sqlalchemy as sa

revision = "a9c1e7d4f2b6"
down_revision = "c3d5e7f9a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = inspector.get_table_names()
    if "oidc_providers" not in tables:
        op.create_table(
            "oidc_providers",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("slug", sa.String(64), nullable=False),
            sa.Column("issuer", sa.String(2048), nullable=False),
            sa.Column("client_id", sa.String(512), nullable=False),
            sa.Column("client_secret_ciphertext", sa.LargeBinary(), nullable=False),
            sa.Column("client_secret_nonce", sa.LargeBinary(), nullable=False),
            sa.Column("encryption_version", sa.SmallInteger(), nullable=False),
            sa.Column("key_id", sa.String(64), nullable=False),
            sa.Column("scopes", sa.String(1024), nullable=False),
            sa.Column("enabled", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True)),
            sa.Column("updated_at", sa.DateTime(timezone=True)),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("slug"),
        )
        op.create_index("ix_oidc_providers_slug", "oidc_providers", ["slug"], unique=True)
    if "oidc_identities" not in tables:
        op.create_table(
            "oidc_identities",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("provider_id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("subject", sa.String(512), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True)),
            sa.ForeignKeyConstraint(["provider_id"], ["oidc_providers.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("provider_id", "subject", name="uq_oidc_identity"),
        )
        op.create_index("ix_oidc_identities_user_id", "oidc_identities", ["user_id"])


def downgrade() -> None:
    op.drop_table("oidc_identities")
    op.drop_table("oidc_providers")
