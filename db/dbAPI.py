from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, validator, EmailStr
from supabase import create_client, Client
from config import SUPABASE_KEY, SUPABASE_URL
from enum import Enum
from typing import List
import bcrypt

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

##-------------Users table endpoints-------------------

class User(BaseModel):
    name: str
    email: EmailStr
    listening: bool
    email_app_password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    email_app_password: str
    name: str

    @validator('password')
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    name: str
    email: EmailStr
    listening: bool
    email_app_password: str

#Hash Pass
def hash_password(password: str) -> str:
    # Generate a salt and hash the password
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')  # Convert bytes to string for storage

# To verify a Pass
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )

#create a user
@app.post("/signup")
async def create_user(user: UserCreate):
    try:
        # Hash the password before storing
        hashed_password = hash_password(user.password)

        # Create user data with hashed passwords
        user_data = {
            "email": user.email,
            "password": hashed_password,
            "email_app_password": user.email_app_password,
            "Name": user.name,
            "Listening": True
        }

        # Insert the user into the database
        result = supabase.table('users').insert(user_data).execute()

        if result.data:
            # Return success without exposing hashed passwords
            return {
                "message": "User created successfully",
                "user": {
                    "email": result.data[0]["email"],
                    "name": result.data[0]["Name"],
                    "listening": result.data[0]["Listening"]
                }
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to create user")

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

#get all users
@app.get("/users", response_model=List[User])
async def get_all_users():
    try:
        # Fetch all users from the database
        response = supabase.table('users').select(
            'Name',
            'email',
            'Listening',
            'email_app_password'
        ).execute()

        if response.data:
            # Transform the data to match the User model
            users = [
                User(
                    name=user['Name'],
                    email=user['email'],
                    listening=user['Listening'],
                    email_app_password=user['email_app_password']
                )
                for user in response.data
            ]
            return users
        else:
            return []

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

#get user givin email and pass
@app.post("/login", response_model=UserResponse)
async def get_user(user_login: UserLogin):
    try:
        # Fetch user from database by email
        response = supabase.table('users').select(
            'Name',
            'email',
            'password',
            'Listening',
            'email_app_password'
        ).eq('email', user_login.email).execute()

        # Check if user exists
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")

        user = response.data[0]

        # Verify password
        if not verify_password(user_login.password, user['password']):
            raise HTTPException(status_code=401, detail="Invalid password")

        # Return user data without password
        return UserResponse(
            name=user['Name'],
            email=user['email'],
            listening=user['Listening'],
            email_app_password=user['email_app_password']
        )

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
