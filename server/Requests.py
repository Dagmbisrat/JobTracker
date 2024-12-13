from openai import OpenAI
from Config import API_KEY
import json
from textwrap import dedent
from pydantic import BaseModel
from Config import MODEL

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
   - `status`: "Pending"
   - `date`: Today's date in the format DD/MM/YYYY.

2. **Rejection or acceptance of a job application(including potential follow-up communication)**:
   - `type`: 2
   - `company_name`: The name of the company mentioned in the email.
   - `job_title`: The title of the job applied for.
   - `status`: "Accepted" or "Rejected" based on the email's content.
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
        temperature=0,
        messages=[
            {"role": "system", "content": dedent(summarization_prompt)},
            {"role": "user", "content": text}
        ],
        response_format=Email_Classifcation,
    )

    return completion.choices[0].message.parsed
