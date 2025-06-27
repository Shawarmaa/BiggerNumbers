# BiggerNumbers

A minimal spending tracker that shows your finances in just three numbers: daily, weekly, and monthly spending.

## What it does

- Connects to your bank account via Plaid
- Shows three simple numbers: how much you spent today, this week, and this month
- Clean, minimal black and white interface

## Tech Stack

- **Frontend**: React Native (Expo) with TypeScript
- **Backend**: FastAPI (Python)
- **Bank Integration**: Plaid SDK
- **Storage**: AsyncStorage for local data

## Setup

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn plaid-python python-dotenv

# Create .env file with your Plaid credentials
echo "PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret
PLAID_ENV=sandbox" > .env

# Run server
python main.py
```

### Frontend

```bash
cd frontend

# Install dependencies
bun install

# Update API_BASE_URL in App.tsx to your computer's IP
# Change from localhost to your actual IP (e.g., 192.168.1.225:8001)

# Run app
bun run ios
```

## Getting Plaid Credentials

1. Sign up at [plaid.com/uk](https://plaid.com/uk)
2. Get your Client ID and Secret from the dashboard
3. Add them to `backend/.env`

## Demo Mode

If Plaid Link gets stuck (common with UK banks), the app shows a "Continue with Demo" button that loads sample spending data to demonstrate the interface.

## Project Structure

```
BiggerNumbers/
├── backend/          # FastAPI server
│   ├── main.py       # API endpoints
│   ├── .env          # Plaid credentials
│   └── venv/         # Python virtual environment
├── frontend/         # React Native app
│   ├── App.tsx       # Main app component
│   └── package.json  # Dependencies
└── README.md
```

## Notes

- Uses sandbox mode by default (safe for testing)
- Backend runs on port 8001
- Frontend connects via local IP address
- UK banks require OAuth setup for production use