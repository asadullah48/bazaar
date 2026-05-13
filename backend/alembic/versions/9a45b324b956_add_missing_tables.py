"""add_missing_tables

Revision ID: 9a45b324b956
Revises: 9d358bc45b6e
Create Date: 2026-05-04 10:35:02.772927

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = '9a45b324b956'
down_revision: Union[str, Sequence[str], None] = '9d358bc45b6e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # All tables in this migration were already created by 9d358bc45b6e_initial_schema.
    # Kept as a no-op to preserve the revision chain for subsequent migrations.
    pass


def downgrade() -> None:
    pass
