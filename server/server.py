import imaplib
import email
import time
import signal
import sys
from email.header import decode_header
from Config import EMAIL_ADDRESS, PASSWORD
from Requests import classify_email

def signal_handler(sig, frame):
    """
    Handle exit signal gracefully
    """
    print('\nExiting email monitor...')
    sys.exit(0)

def get_email_content(msg):
    """
    Extract the email content from the message
    """
    content = ""
    if msg.is_multipart():
        # Walk through the parts to find the text content
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                try:
                    content += part.get_payload(decode=True).decode()
                except:
                    pass
    else:
        # If the message is not multipart, just get the payload
        try:
            content = msg.get_payload(decode=True).decode()
        except:
            content = msg.get_payload()

    return content

def connect_to_email(email_address, password, imap_server="imap.gmail.com"):
    """
    Connect to email server and return IMAP connection object
    """
    # Create an IMAP4 class with SSL
    imap = imaplib.IMAP4_SSL(imap_server)

    # Authenticate
    imap.login(email_address, password)
    return imap

def check_for_new_emails(imap):
    """
    Check inbox for new emails and return their details
    """
    # Select the mailbox you want to check (in this case, "INBOX")
    imap.select("INBOX")

    # Search for all unread emails
    _, message_numbers = imap.search(None, "UNSEEN")

    for num in message_numbers[0].split():
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

        #create email structure
        email_ = f"\nFrom: {from_}\nSubject: {subject}\nContet: {content}"

        ans =  classify_email(email_)

        print(f"\nNew email received!")
        print(f"From: {from_}")
        print(f"Subject: {subject}")
        print("-" * 50)
        print("Content:")
        print(content)
        print("=" * 50)
        print(f"classification: {ans}")
        print("~" * 50)


def monitor_inbox(email_address, password, check_interval=60):
    """
    Continuously monitor inbox for new emails
    """
    # Set up signal handler for graceful exit
    signal.signal(signal.SIGINT, signal_handler)

    try:
        imap = connect_to_email(email_address, password)
        print(f"Connected to email server. Monitoring for new emails...")

        while True:
            check_for_new_emails(imap)
            time.sleep(check_interval)

    except Exception as e:
        print(f"An error occurred: {str(e)}")

    finally:
        if 'imap' in locals():
            imap.logout()

if __name__ == "__main__":
    # Start monitoring
    monitor_inbox(EMAIL_ADDRESS, PASSWORD)
