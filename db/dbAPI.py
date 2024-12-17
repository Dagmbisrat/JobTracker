import os
import bcrypt
import imaplib
from enum import Enum
from typing import List
from slowapi import Limiter
from dotenv import load_dotenv
from jose import JWTError, jwt
from fastapi.middleware import Middleware
from fastapi.responses import JSONResponse
from supabase import create_client, Client
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from datetime import datetime, timedelta, UTC
from slowapi.middleware import SlowAPIMiddleware
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator, ValidationError
from fastapi import FastAPI, HTTPException, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
#from Config import SUPABASE_KEY, SUPABASE_URL, JWT_SECRET_KEY, FRONTEND_URL
load_dotenv()

# Get environment variables
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
FRONTEND_URL = os.getenv('FRONTEND_URL')

#env validation
if not all([SUPABASE_URL, SUPABASE_KEY, JWT_SECRET_KEY, FRONTEND_URL]):
    raise ValueError("Missing required environment variables. Please check your .env file.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Job Tracker API")
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
SIGNUP_LIM = 12
LOGIN_LIM = 12
VERIFY_LIM = 100
security = HTTPBearer()

#acsess token
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)  # Using now(UTC) instead of utcnow()
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        email = str(payload["sub"])  # Will raise KeyError if "sub" doesn't exist
        return email
    except (JWTError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

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

class ApplicationResponse(BaseModel):
    company_name: str
    job_title: str
    status: ApplicationStatus
    app_date: datetime

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again later."}
    )

#get All aps of user
@app.get("/applications/user/{email}", response_model=List[ApplicationResponse])
async def get_user_applications(email: str):
    try:
        response = supabase.table('applications')\
            .select("company_name,job_title,status,app_date")\
            .eq("email", email)\
            .order("app_date", desc=True)\
            .execute()

        if not response.data:
            return []

        return response.data

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

#get applications
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
    email: str
    listening: bool
    email_app_password: str

class UserCreate(BaseModel):
    email: str
    password: str
    email_app_password: str
    name: str

    @validator('password')
    def password_strength(cls, v):
        if len(v) < 8:
            raise HTTPException(status_code=422, detail="Password must be at least 8 characters long")
        return v

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    name: str
    email: str
    listening: bool

# Create a new response model for login
class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

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

def validate_email_credentials(email, password):
    """
    Validate email credentials by attempting to connect to Gmail
    Returns True if credentials are valid, False otherwise
    """
    try:
        # Try to establish connection
        imap = imaplib.IMAP4_SSL("imap.gmail.com")
        imap.login(email, password)

        # If login successful, logout and return True
        imap.logout()
        return True

    except imaplib.IMAP4.error:
        raise HTTPException(status_code=422, detail="Invalid credentials")
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid credentials")

#create a user
@app.post("/signup")
@limiter.limit(f'{SIGNUP_LIM}/hour')
async def create_user(request: Request, user: UserCreate):
    try:

        #first check if info is valid
        validate_email_credentials(user.email,user.email_app_password)

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

        # Create access token
        access_token = create_access_token(
            data={"sub": user.email}
        )

        if result.data:
            # Return success without exposing hashed passwords and with tokens
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "user": UserResponse(
                    name= user.name,
                    email= user.email,
                    listening= True
                )
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to create user")


    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        error_detail = str(e)
        error_patterns = {
            "new row for relation \"users\" violates check constraint": "Invalid name format",
            "duplicate key value violates unique constraint": "Email Taken",
        }
        for pattern, message in error_patterns.items():
            if pattern in error_detail:
                raise HTTPException(status_code=422, detail=message)

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

@app.post("/login", response_model=LoginResponse)
@limiter.limit(f'{LOGIN_LIM}/hour')
async def get_user(request: Request, user_login: UserLogin):
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
            raise HTTPException(status_code=404, detail="Invalid password or Email")

        user = response.data[0]

        # Verify password
        if not verify_password(user_login.password, user['password']):
            raise HTTPException(status_code=401, detail="Invalid password or Email")

        # Create access token
        access_token = create_access_token(
            data={"sub": user['email']}
        )

        # Return user data without password
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": UserResponse(
                name=user['Name'],
                email=user['email'],
                listening=user['Listening'],
            )
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

#----------------------Others-------------------------


@app.get("/verify-token")
@limiter.limit(f'{VERIFY_LIM}/hour')
async def verify_token(request: Request, credentials: HTTPAuthorizationCredentials = Security(security)):
    try:
        await get_current_user(credentials)
        return {"valid": True}
    except HTTPException:
        return {"valid": False}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
