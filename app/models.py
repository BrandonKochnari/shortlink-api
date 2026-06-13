from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class URL(Base):
    __tablename__ = "urls"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    guest_token = Column(String, index=True, nullable=True)

    original_url = Column(String, nullable=False)
    short_code = Column(String, unique=True, index=True, nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=True)

    is_active = Column(Boolean, default=True)

    clicks = relationship(
        "Click",
        back_populates="url",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Click(Base):
    __tablename__ = "clicks"

    id = Column(Integer, primary_key=True, index=True)

    url_id = Column(
        Integer,
        ForeignKey("urls.id", ondelete="CASCADE"),
        nullable=False
    )

    clicked_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    url = relationship("URL", back_populates="clicks")
