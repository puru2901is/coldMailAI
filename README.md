# Cold Email AI

AI-powered cold email generation and sending tool. Generate personalized cold emails using Google Gemini AI and send them via Gmail.

## Features

- **Contact Management**: Upload CSV or add contacts manually
- **AI Email Generation**: Generate personalized cold emails using Gemini AI
- **Email Refinement**: Refine emails with AI feedback (adjust tone, length, urgency)
- **Gmail Integration**: Send emails directly via Gmail SMTP
- **Email History**: Track all sent emails

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TailwindCSS, TypeScript |
| Backend | Python 3.11+, FastAPI |
| Database | SQLite |
| AI | Google Gemini API |
| Email | Gmail SMTP |

## Prerequisites

- Python 3.11+
- Node.js 18+
- Gmail account with 2FA enabled
- Google Gemini API key

## Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd coldMailAI
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn app.main:app --reload --port 8010
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies (using yarn or npm)
npx yarn install
# or
npm install --legacy-peer-deps

# Start the development server
npm run dev
```

### 4. Configure Credentials

1. Open http://localhost:3000 in your browser
2. Go to **Settings** page
3. Add your credentials:

#### Gmail App Password
1. Enable 2FA on your Gmail account
2. Go to https://myaccount.google.com/apppasswords
3. Generate an app password for "Mail"
4. Copy the 16-character password

### automatical mail draft for peerpush leads for runbyte.tech
```
python scripts/generate_peerpush_drafts.py --csv /Users/purushottambaghel/Downloads/peerpush_contacts_1_with_snapshots.csv
```

#### Gemini API Key
1. Go to https://makersuite.google.com/app/apikey
2. Create a new API key
3. Copy the key

## Usage

### 1. Add Contacts

- Go to **Contacts** page
- Click "Add Contact" to add manually, or
- Click "Upload CSV" to import from a CSV file

CSV Format:
```csv
email,name,company,job_title
john@example.com,John Doe,Acme Inc,CEO
```

### 2. Compose Email

1. Go to **Compose** page
2. Select a contact
3. Enter context:
   - Service/Product you're selling
   - Value proposition
   - Desired tone
4. Click "Generate Email"
5. Review and refine with AI
6. Edit manually if needed
7. Click "Send Email"

### 3. View History

- Go to **History** page to see all sent emails

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contacts` | List all contacts |
| POST | `/api/contacts` | Create contact |
| POST | `/api/contacts/upload` | Upload CSV |
| DELETE | `/api/contacts/{id}` | Delete contact |
| POST | `/api/emails/generate` | Generate email with AI |
| POST | `/api/emails/refine` | Refine email with AI |
| POST | `/api/emails/send` | Send email via Gmail |
| GET | `/api/emails` | List sent emails |
| GET | `/api/settings` | Get settings |
| PUT | `/api/settings` | Update settings |

## Project Structure

```
coldMailAI/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app
│   │   ├── database.py       # SQLite setup
│   │   ├── models.py         # Pydantic models
│   │   ├── routers/          # API routes
│   │   │   ├── contacts.py
│   │   │   ├── emails.py
│   │   │   └── settings.py
│   │   └── services/         # Business logic
│   │       ├── gemini.py
│   │       └── gmail.py
│   ├── data/                 # SQLite database
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js pages
│   │   │   ├── page.tsx      # Dashboard
│   │   │   ├── contacts/
│   │   │   ├── compose/
│   │   │   ├── history/
│   │   │   └── settings/
│   │   ├── components/       # React components
│   │   └── lib/              # API client
│   └── package.json
│
└── README.md
```

## Security Notes

- Gmail app passwords are stored in the local SQLite database
- Never commit the `data/app.db` file to version control
- Add `backend/data/` to your `.gitignore`

## License

MIT
