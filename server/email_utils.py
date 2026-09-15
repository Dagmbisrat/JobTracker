import logging
from html import unescape
from html.parser import HTMLParser
from io import BytesIO

from pypdf import PdfReader

logger = logging.getLogger(__name__)

# Guardrails so a large/irrelevant attachment (handbook, benefits doc) can't
# blow up the text sent to the LLM.
MAX_CHARS_PER_PDF = 5000
MAX_PDF_ATTACHMENTS = 3


class _HTMLTextExtractor(HTMLParser):
    """Minimal stdlib HTML-to-text: strips tags/scripts/styles, unescapes entities."""

    def __init__(self):
        super().__init__()
        self._skip = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip = True

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self._skip = False

    def handle_data(self, data):
        if not self._skip:
            self.parts.append(data)

    def get_text(self):
        return unescape(" ".join(self.parts)).strip()


def html_to_text(html: str) -> str:
    parser = _HTMLTextExtractor()
    parser.feed(html)
    return parser.get_text()


def _is_pdf_part(part) -> bool:
    if part.get_content_type() == "application/pdf":
        return True
    filename = part.get_filename()
    return bool(filename) and filename.lower().endswith(".pdf")


def pdf_to_text(pdf_bytes: bytes) -> str:
    """Extract embedded text from a PDF's bytes, capped and best-effort.

    Only reads text that's already embedded in the PDF — a scanned/image-only
    PDF (no text layer) will yield nothing here. True OCR would need extra
    system binaries (poppler/tesseract) and is out of scope for this project.
    """
    reader = PdfReader(BytesIO(pdf_bytes))
    pages_text = []
    for page in reader.pages:
        pages_text.append(page.extract_text() or "")
    return "\n".join(pages_text).strip()[:MAX_CHARS_PER_PDF]


def get_email_content(msg) -> str:
    """Extract text content from an email.message.Message.

    Prefers text/plain; falls back to text/html (tags stripped) only when no
    non-empty text/plain part is present, so ATS/HTML-only emails still reach
    the classifier instead of yielding an empty body. Also extracts embedded
    text from any PDF attachments and appends it, labeled by filename, since
    some ATS emails only state the job title inside an attached PDF rather
    than the body/subject.
    """
    plain_parts = []
    html_parts = []
    pdf_sections = []

    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            if _is_pdf_part(part):
                if len(pdf_sections) >= MAX_PDF_ATTACHMENTS:
                    continue
                try:
                    pdf_bytes = part.get_payload(decode=True)
                    text = pdf_to_text(pdf_bytes)
                    if text:
                        name = part.get_filename() or "attachment.pdf"
                        pdf_sections.append(f"[Attachment: {name}]\n{text}")
                except Exception as e:
                    logger.warning(f"Could not extract text from PDF attachment: {str(e)}")
            elif ctype == "text/plain":
                try:
                    plain_parts.append(part.get_payload(decode=True).decode())
                except Exception as e:
                    logger.error(f"Error decoding text/plain part: {str(e)}")
            elif ctype == "text/html":
                try:
                    html_parts.append(part.get_payload(decode=True).decode())
                except Exception as e:
                    logger.error(f"Error decoding text/html part: {str(e)}")
    else:
        try:
            return msg.get_payload(decode=True).decode()
        except Exception as e:
            logger.error(f"Error decoding email: {str(e)}")
            return msg.get_payload()

    plain_text = "".join(plain_parts).strip()
    body_text = plain_text or (html_to_text("".join(html_parts)) if html_parts else "")

    sections = [s for s in [body_text, *pdf_sections] if s]
    return "\n\n".join(sections)
