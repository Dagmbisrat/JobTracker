from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client
from config import SUPABASE_KEY, SUPABASE_URL
from enum import Enum

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
app = FastAPI(title="Job Tracker API")

# Create Enum class to match database ENUM
class ApplicationStatus(str, Enum):
    PENDING_RESPONSE = "Pending Response"
    REJECTED = "Rejected"
    INTERVIEW_SCHEDULED = "Interview Scheduled"
    TALK_SCHEDULED = "Talk Scheduled"
    OFFER_RECEIVED = "Offer Received"

class Application(BaseModel):
    email: str
    company_name: str
    job_title: str
    status: ApplicationStatus = ApplicationStatus.PENDING_RESPONSE

@app.get("/applications")
async def get_application_id(email: str, company_name: str, job_title: str):
    try:
        response = supabase.table('applications')\
            .select("app_id")\
            .eq("email", email)\
            .eq("company_name", company_name)\
            .eq("job_title", job_title)\
            .single().execute()

        if 'details' in str(response) and 'The result contains 0 rows' in str(response):
            raise HTTPException(status_code=404, detail="Application not found")

        if not response.data:
            raise HTTPException(status_code=404, detail="Application not found")

        return response.data['app_id']
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

#add applicaiton row
@app.post("/applications")
async def create_application(application: Application):
    try:
        response = supabase.table('applications').insert({
            "email": application.email,
            "company_name": application.company_name,
            "job_title": application.job_title,
            "status": application.status
        }).execute()

        return response.data[0]
    except Exception as e:
        # Check if error message contains foreign key violation
        if "violates foreign key constraint" in str(e):
            raise HTTPException(
                status_code=409,  # Using 409 Conflict for FK violations
                detail="Email does not exist in users table"
            )
        raise HTTPException(status_code=400, detail=str(e))

#update application row, givin Application obj
@app.put("/applications/{app_id}")
async def update_application_status(app_id: int, status_update: ApplicationStatus):
    try:
        response = supabase.table('applications')\
            .update({
                "status": status_update.value
            })\
            .eq("app_id", app_id)\
            .execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Application not found")

        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
