import os
import logging
import requests
from openai import OpenAI
from textwrap import dedent
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
   communication about a job application already in progress**:
   - `type`: 2
   - `company_name`: extracted per the priority order above.
   - `job_title`: extracted per the priority order above.
   - `status`: one of "Pending Response", "Rejected", "Interview Scheduled", "Talk Scheduled",
     "Offer Received", based on the email's content.
   - `date`: today's date in the format DD/MM/YYYY.

3. **Not related to a job application** (newsletters, marketing, unrelated personal/business
   email, etc.):
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

    if email_classification.type == 1:
        try:
            response = requests.request(
                method='POST',
                url=f'{DB_API_ADDY}/applications',
                json=application_data
            )
            response.raise_for_status()
            print(f"Email Update successfull: {response.json()}")
            return response.json()

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

    if email_classification.type == 2:
        try:
            response = requests.get(
                url=f'{DB_API_ADDY}/applications',
                params={
                    "email": email,
                    "company_name": email_classification.company_name,
                    "job_title": email_classification.job_title
                }
            )
            app_id = response.json()  # This gets the app_id from the response
            print(f'Application id Found: {app_id}')

            # Then update the status
            update_response = requests.put(
                url=f'{DB_API_ADDY}/applications/{app_id}',
                params={'status_update': email_classification.status}
            )
            update_response.raise_for_status()
            print(f"Status updated successfully: {update_response.json()}")
            return update_response.json()


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

        response = requests.put(
            url=f'{DB_API_ADDY}/applications/{app_id}',
            params={'status_update': email_classification.status}
        )
