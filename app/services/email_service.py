import logging
import os

logger = logging.getLogger(__name__)


class EmailService:
    def __init__(self) -> None:
        self.provider = os.getenv("EMAIL_PROVIDER")
        self.api_key = os.getenv("EMAIL_API_KEY")
        self.from_email = os.getenv("EMAIL_FROM_EMAIL")

    @property
    def is_configured(self) -> bool:
        return bool(self.provider and self.api_key and self.from_email)

    def send_verification_email(self, recipient_email: str, verification_link: str) -> None:
        if not self.is_configured:
            message = (
                f"EMAIL VERIFICATION LINK for {recipient_email}:\n"
                f"{verification_link}"
            )
            print(message, flush=True)
            logger.info(
                "EMAIL VERIFICATION LINK for %s:\n%s",
                recipient_email,
                verification_link,
            )
            return

        logger.info(
            "Email provider %s configured; verification email sending is not implemented yet. "
            "Verification link for %s: %s",
            self.provider,
            recipient_email,
            verification_link,
        )


email_service = EmailService()
