import os
import sys
import email
import imaplib
import logging
import requests
from dotenv import load_dotenv
from email.header import decode_header
from Requests import classify_email, prosses_Email

load_dotenv()
# Get environment variables prosses_Email
DB_API_ADDY = os.getenv('DB_API_ADDY')

if not DB_API_ADDY:
    raise ValueError("Missing required environment variables. Please check your .env file.")

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def get_email_content(msg):
    """Extract the email content from the message"""
    content = ""
    if msg.is_multipart():
        # Walk through the parts to find the text content
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                try:
                    content += part.get_payload(decode=True).decode()
                except Exception as e:
                    logger.error(f"Error decoding email part: {str(e)}")
    else:
        # If the message is not multipart, just get the payload
        try:
            content = msg.get_payload(decode=True).decode()
        except Exception as e:
            logger.error(f"Error decoding email: {str(e)}")
            content = msg.get_payload()
    return content

def connect_to_email(email_address, password, imap_server="imap.gmail.com"):
    """Connect to email server and return IMAP connection object"""
    try:
        # Create an IMAP4 class with SSL
        imap = imaplib.IMAP4_SSL(imap_server)
        # Authenticate
        imap.login(email_address, password)
        return imap
    except imaplib.IMAP4.error as e:
        logger.error(f"IMAP connection failed for {email_address}: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error connecting to email: {str(e)}")
        raise

def check_for_new_emails(imap,email_address):
    """Check inbox for new emails and process them"""
    try:
        # Select the mailbox you want to check
        imap.select("INBOX")

        # Search for all unread emails
        _, message_numbers = imap.search(None, "UNSEEN")

        for num in message_numbers[0].split():
            try:
                # Fetch the email message
                _, msg_data = imap.fetch(num, "(RFC822)")
                email_body = msg_data[0][1]
                email_message = email.message_from_bytes(email_body)

                # Get subject
                subject = decode_header(email_message["Subject"])[0][0]
                if isinstance(subject, bytes):
                    subject = subject.decode()

                # Get sender
                from_ = decode_header(email_message["From"])[0][0]
                if isinstance(from_, bytes):
                    from_ = from_.decode()

                # Get content
                content = get_email_content(email_message)

                # Create email structure and process
                email_ = f"\nFrom: {from_}\nSubject: {subject}\nContent: {content}"
                answer = classify_email(email_)
                prosses_Email(answer,email_address)

            except Exception as e:
                logger.error(f"Error processing email {num}: {str(e)}")
                continue

    except Exception as e:
        logger.error(f"Error checking for new emails: {str(e)}")
        raise

def check_inbox(email_address, password):
    """Check inbox once for new emails"""
    imap = None
    try:
        imap = connect_to_email(email_address, password)
        logger.info(f'Connected to {email_address}\'s email server. Checking for new emails...')
        check_for_new_emails(imap,email_address)
        return True
    except Exception as e:
        logger.error(f"Error checking inbox for {email_address}: {str(e)}")
        return False
    finally:
        if imap:
            try:
                imap.logout()
            except Exception as e:
                logger.error(f"Error logging out: {str(e)}")

def fetch_all_users():
    """Fetch all users from the database"""
    url = f'{DB_API_ADDY}/users'
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching users: {str(e)}")
        return None

def run_once():
    """Single run of email checking for all users"""
    logger.info("Starting email check...")
    try:
        users = fetch_all_users()
        if users:
            for user in users:
                if user['listening']:
                    try:
                        check_inbox(user['email'], user['email_app_password'])
                    except Exception as e:
                        logger.error(f"Error checking inbox for {user['email']}: {str(e)}")
                        continue
            logger.info("Done scanning all users unread emails")
        else:
            logger.error("Failed to fetch users or no users found")

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    run_once()
