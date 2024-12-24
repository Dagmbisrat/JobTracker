import os
import requests
from openai import OpenAI
from textwrap import dedent
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

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
You will be provided with an email sent to a person.
Your goal will be to check if the email is an automated confirmation of the receipt's application,
or if it is a rejection/acceptance of a job application.

Here is a description of the parameters:

1. **Automated confirmation of receipt job application**:
   - `type`: 1
   - `company_name`: The name of the company mentioned in the email.
   - `job_title`: The title of the job applied for.
   - `status`: "Pending Response"

2. **Rejection or acceptance of a job application(including potential follow-up communication)**:
   - `type`: 2
   - `company_name`: The name of the company the email is from (no always from the email address its from).
   - `job_title`: The title of the job applied for (make shure this exsists).
   - `status`: "Pending Response" or "Rejected" or "Interview Scheduled" or "Talk Scheduled" or "Offer Received" based on the email's content.
   - `date`: Today's date in the format DD/MM/YYYY.

3. **Neither of the above**:
   - `type`: 0
   - `company_name`: "-"
   - `job_title`: "-"
   - `status`: "-"
   - `date`: "-"
'''

class Email_Classifcation(BaseModel):
    type: int
    company_name: str
    job_title: str
    status: str
    date: str

# Function to classify the email
def classify_email(text: str):
    completion = client.beta.chat.completions.parse(
        model=MODEL,
        temperature=0.2,
        messages=[
            {"role": "system", "content": dedent(summarization_prompt)},
            {"role": "user", "content": text}
        ],
        response_format=Email_Classifcation,
    )

    return completion.choices[0].message.parsed

#function to process email
def prosses_Email(email_classification: Email_Classifcation, email: str):
    """
    Process the email to update db if nedded
    """

    if email_classification.type not in [1, 2]:
        #find a way to mark the email as unread----

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
