# 📬 JobTracker — AI-Powered Job Application Tracker

> **Stop manually logging every application. Let your inbox do the work.**

JobTracker automatically monitors your Gmail inbox, uses AI to detect job-related emails, and keeps your application pipeline up to date — all in real time. Log in, connect your inbox, and watch your applications appear.

---

## ✨ What It Does

When you apply for a job, you get confirmation emails. When you hear back, you get more emails. JobTracker reads those emails so you don't have to keep a spreadsheet.

Here's the full loop:

```
You apply for a job
      ↓
Confirmation email lands in your inbox
      ↓
JobTracker detects it via IMAP
      ↓
AI classifies it (new application? rejection? interview?)
      ↓
Your dashboard updates automatically
```

---

## 🖼️ Features at a Glance

- **Auto-detection** — Scans your Gmail for job-related emails every minute
- **AI Classification** — Uses GPT-4o-mini to understand email context and extract company name, job title, and application status
- **Smart Status Tracking** — Knows the difference between a confirmation, a rejection, an interview invite, and an offer
- **Clean Dashboard** — Filter and sort your applications by status, company, position, or date
- **Dark / Light Mode** — Persists your preference across sessions
- **JWT Auth** — Secure login with bcrypt-hashed passwords and short-lived tokens
- **Rate Limited API** — Protected endpoints to prevent abuse

---

## 🗂️ Project Structure

```
JobTracker/
├── ui/          # React frontend (Vite + Tailwind + shadcn)
├── db/          # Database API (FastAPI + Supabase)
└── server/      # Email monitor + AI classifier (Python + OpenAI)
```

Each service is independent and communicates over HTTP.

---

## 🧩 How Each Piece Works

### `ui/` — The Dashboard

Built with **React 18**, **Vite**, and **Tailwind CSS**.

- **Login / Signup** — Users register with their email, a site password, and a Gmail App Password
- **Dashboard** — Displays all tracked applications in a sortable, filterable table
- **Status Indicator** — Shows whether inbox monitoring is active for your account
- **Dark mode** — Toggles between themes, saved to `localStorage`

Routes:
| Path | Component |
|------|-----------|
| `/` | Login / Signup |
| `/dashboard` | Application dashboard |

---

### `db/` — The Database API

Built with **FastAPI** and backed by **Supabase** (Postgres).

Handles all data — users, passwords, and applications. Rate-limited with `slowapi`.

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/signup` | Create account (validates Gmail credentials on signup) |
| `POST` | `/login` | Login and receive a JWT |
| `GET` | `/verify-token` | Validate a JWT |
| `GET` | `/users` | Get all users (used by the email monitor) |
| `GET` | `/applications/user/{email}` | Get all applications for a user |
| `GET` | `/applications` | Look up an application by email + company + title |
| `POST` | `/applications` | Create a new application entry |
| `PUT` | `/applications/{app_id}` | Update an application's status |

#### Application Statuses

```
Pending Response  →  Interview Scheduled  →  Offer Received
                  →  Talk Scheduled
                  →  Rejected
```

---

### `server/` — The Email Monitor + AI Brain

Two Python scripts that work together:

#### `EmailMonitor.py`
- Runs as a **continuous loop** (checks every 60 seconds)
- Fetches all users from the DB API
- For each user with `listening: true`, connects to Gmail via **IMAP SSL**
- Reads **unread** emails received on/after the `EMAIL_SINCE` cutoff (defaults to the current date; set it to the deploy date in production so the historical backlog is skipped) and passes them to the classifier

#### `Requests.py`
- Sends email content to the OpenAI API (model set by the `MODEL` env var, e.g. `gpt-4.1-mini`)
- Uses **structured output** (Pydantic) so the response is always a clean JSON object
- Decides what to do:
  - `type 1` → New application detected → `POST /applications`
  - `type 2` → Status update (rejection, interview, etc.) → `PUT /applications/{id}`
  - `type 0` → Not job-related → skip

---

## 🚀 Services

| Service | Technology | How it runs |
|---------|-----------|-------------|
| **Database API** (`db/`) | FastAPI + Uvicorn | HTTP server on port `8000` |
| **Email Monitor** (`server/`) | Python | Long-running loop (`EmailMonitor.py`) or single-run (`server.py`) |
| **Frontend** (`ui/`) | React + Vite | Dev server via `vite` / deployed to Vercel |

The DB API must be running before the email monitor or frontend can function — everything talks to it over HTTP.

---

## 🔐 Security Notes

- Passwords are hashed with **bcrypt** before storage — never stored in plain text
- Gmail App Passwords are stored to enable IMAP access — keep your DB secure
- JWTs expire after **30 minutes**
- API endpoints are **rate limited** (12 req/hour on auth routes)
- CORS is restricted to the configured frontend URL only

---

## 🧠 AI Classification Logic

The AI is given an email (sender, subject, body) and returns a structured object:

```json
{
  "type": 1,
  "company_name": "Acme Corp",
  "job_title": "Software Engineer",
  "status": "Pending Response",
  "date": "-"
}
```

| Type | Meaning | Action |
|------|---------|--------|
| `0` | Not job-related | Ignored |
| `1` | Application confirmation | New row created |
| `2` | Status update | Existing row updated |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui |
| Database API | FastAPI, Supabase (Postgres), bcrypt, JWT |
| Email Monitor | Python, imaplib, OpenAI API |
| AI Model | GPT-4o-mini (structured output) |
| Hosting DB | Supabase |

---

*Built as a personal project to stop losing track of job applications.*
