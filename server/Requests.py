import os
import re
import logging
import requests
from openai import OpenAI
from textwrap import dedent
from difflib import SequenceMatcher
from dotenv import load_dotenv
from pydantic import BaseModel, field_validator

load_dotenv()

logger = logging.getLogger(__name__)

# Get environment variables
API_KEY = os.getenv('API_KEY')
DB_API_ADDY = os.getenv('DB_API_ADDY')
MODEL = os.getenv('MODEL')

if not all([API_KEY, DB_API_ADDY,MODEL]):
    raise ValueError("Missing required environment variables. Please check your .env file.")

# init some params
client = OpenAI(api_key=API_KEY)

# Prompt
summarization_prompt = '''
You will be given the raw contents of an email (From, Subject, and Content) sent to a job
seeker. Determine whether it relates to a job application, and if so, classify it and extract
its details.

For every case where you must extract `company_name` and `job_title`, follow this priority
order:
1. Look for an explicit statement in the email body (e.g. "your application for the Software
   Engineer role at Acme Corp").
2. If not stated plainly in the body, check the Subject line — job title and company name are
   very often only present there (e.g. "Application received: Backend Engineer, Acme Corp").
3. If not in the Subject, check the sender's name/domain in the From address for the company
   name (e.g. "careers@acme.com" -> "Acme").
4. Only if the job title truly cannot be determined from body, subject, or sender after checking
   all of the above, set `job_title` to the literal string "Unknown". Never return an empty
   string, and never guess a title that isn't supported by the email.
5. Only if the company name truly cannot be determined, set `company_name` to "Unknown" as well.

Classify the email into exactly one of these three cases:

1. **Automated confirmation of receipt of a job application** (e.g. "we received your
   application", "thanks for applying"):
   - `type`: 1
   - `company_name`: extracted per the priority order above.
   - `job_title`: extracted per the priority order above.
   - `status`: "Pending Response"

2. **A rejection, acceptance, interview/talk scheduling, or offer — including any follow-up
   communication about a job application already in progress, or a recruiter reaching out
   about a different role after seeing your resume (use that suggested role as `job_title`)**:
   - `type`: 2
   - `company_name`: extracted per the priority order above.
   - `job_title`: extracted per the priority order above.
   - `status`: one of "Pending Response", "Rejected", "Interview Scheduled", "Talk Scheduled",
     "Offer Received", based on the email's content.
   - `date`: today's date in the format DD/MM/YYYY.

3. **Not related to a job application** (newsletters, marketing, generic job alerts or
   job-board recommendations, unrelated personal/business email, etc.):
   - `type`: 0
   - `company_name`: "-"
   - `job_title`: "-"
   - `status`: "-"
   - `date`: "-"

Important: "Unknown" (case 1 and 2, when extraction genuinely fails) and "-" (case 3, not
job-related at all) mean different things — never mix them up, and never emit an empty string
for `company_name` or `job_title`.
'''

class Email_Classifcation(BaseModel):
    type: int
    company_name: str
    job_title: str
    status: str
    date: str

    @field_validator("company_name", "job_title", mode="after")
    @classmethod
    def _blank_to_unknown(cls, v: str) -> str:
        """Backstop for a model response that still comes back blank despite the
        prompt's instructions — normalize whitespace/empty strings to "Unknown"
        rather than let them flow silently into the db."""
        v = v.strip()
        return v if v else "Unknown"

# Function to classify the email
def classify_email(text: str, _retry: bool = True):
    completion = client.beta.chat.completions.parse(
        model=MODEL,
        temperature=0.2,
        messages=[
            {"role": "system", "content": dedent(summarization_prompt)},
            {"role": "user", "content": text}
        ],
        response_format=Email_Classifcation,
    )

    result = completion.choices[0].message.parsed

    is_job_related = result.type in (1, 2)
    is_incomplete = result.company_name == "Unknown" or result.job_title == "Unknown"

    if is_job_related and is_incomplete:
        if _retry:
            logger.warning(f"Blank/Unknown field on first pass, retrying once. Raw result: {result}")
            return classify_email(text, _retry=False)
        logger.warning(f"Still Unknown after retry, proceeding anyway. Raw result: {result}")

    return result

# Words dropped from company names so "Moog Inc." matches "Moog"
_COMPANY_SUFFIXES = {"inc", "llc", "ltd", "plc", "co", "corp", "corporation",
                     "company", "group", "technologies", "technology"}
# Minimum title similarity (0-1) to treat two titles as the same role
TITLE_MATCH_THRESHOLD = 0.75
# Returned when several saved applications fit a status update equally well
AMBIGUOUS = object()

def _normalize(text: str) -> str:
    """Lowercase and strip punctuation so near-identical names compare equal."""
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text.lower()).split())

def _same_company(a: str, b: str) -> bool:
    a, b = (" ".join(w for w in _normalize(n).split() if w not in _COMPANY_SUFFIXES)
            for n in (a, b))
    return bool(a and b) and (f" {a} " in f" {b} " or f" {b} " in f" {a} ")

def _title_score(a: str, b: str) -> float:
    a, b = _normalize(a), _normalize(b)
    if not a or not b:
        return 0.0
    if f" {a} " in f" {b} " or f" {b} " in f" {a} ":
        return 1.0
    return SequenceMatcher(None, a, b).ratio()

def _match_application(apps: list, company_name: str, job_title: str):
    """
    Pick the saved application a status-update email refers to. Returns its
    app_id, None if the role isn't tracked yet, or AMBIGUOUS
    """
    same_company = [a for a in apps if _same_company(a["company_name"], company_name)]
    if not same_company:
        return None

    if job_title == "Unknown":
        open_apps = [a for a in same_company if a["status"] != "Rejected"]
        pool = open_apps or same_company
        return pool[0]["app_id"] if len(pool) == 1 else AMBIGUOUS

    exact = [a for a in same_company if _normalize(a["job_title"]) == _normalize(job_title)]
    if len(exact) == 1:
        return exact[0]["app_id"]

    scores = [(_title_score(a["job_title"], job_title), a) for a in same_company]
    best_score = max(score for score, _ in scores)
    if best_score < TITLE_MATCH_THRESHOLD:
        return None  # same company, different role
    best = [a for score, a in scores if score == best_score]
    return best[0]["app_id"] if len(best) == 1 else AMBIGUOUS

def _create_application(application_data: dict):
    response = requests.post(url=f'{DB_API_ADDY}/applications', json=application_data)
    response.raise_for_status()
    print(f"Email Update successfull: {response.json()}")
    return response.json()

def _update_application(application_data: dict):
    response = requests.get(url=f'{DB_API_ADDY}/applications/user/{application_data["email"]}')
    response.raise_for_status()
    app_id = _match_application(response.json(), application_data["company_name"],
                                application_data["job_title"])

    if app_id is AMBIGUOUS:
        print(f"Status update skipped: several applications at "
              f"{application_data['company_name']} match '{application_data['job_title']}'")
        return None

    if app_id is None:
        # Role isn't tracked yet (no confirmation email, or a recruiter reached
        # out about a different role), so start tracking it at this status
        print(f"No saved application for {application_data['company_name']} - "
              f"{application_data['job_title']}, creating one")
        return _create_application(application_data)

    print(f'Application id Found: {app_id}')
    update_response = requests.put(
        url=f'{DB_API_ADDY}/applications/{app_id}',
        params={'status_update': application_data["status"]}
    )
    update_response.raise_for_status()
    print(f"Status updated successfully: {update_response.json()}")
    return update_response.json()

#function to process email
def prosses_Email(email_classification: Email_Classifcation, email: str):
    """
    Process the email to update db if nedded
    """

    if email_classification.type not in [1, 2]:
        print("Email not job specific")
        return None

    #create the data to update the db for user(:email)
    application_data = {
        "email": email,
        "company_name": email_classification.company_name,
        "job_title": email_classification.job_title,
        "status": email_classification.status
    }

    try:
        if email_classification.type == 1:
            return _create_application(application_data)
        return _update_application(application_data)

    except requests.exceptions.ConnectionError:
        print("Failed to connect to the API. Check if it's running and the URL is correct.")
        return None
    except requests.exceptions.HTTPError as e:
        print(f"API returned an error: {e.response.status_code} - {e.response.text}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"An error occurred while making the request: {str(e)}")
        return None
    except ValueError as e:
        print(f"Failed to parse API response as JSON: {str(e)}")
        return None
