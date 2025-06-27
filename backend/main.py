from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import plaid
from plaid.api import plaid_api
from plaid.model.transactions_get_request import TransactionsGetRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.country_code import CountryCode
from plaid.model.products import Products
from plaid.configuration import Configuration
from plaid.api_client import ApiClient
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="BiggerNumbers API", description="Simple spending tracker")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Plaid configuration
configuration = Configuration(
    host=getattr(plaid.Environment, os.getenv('PLAID_ENV', 'sandbox')),
    api_key={
        'clientId': os.getenv('PLAID_CLIENT_ID'),
        'secret': os.getenv('PLAID_SECRET'),
    }
)
api_client = ApiClient(configuration)
client = plaid_api.PlaidApi(api_client)

# Pydantic models
class PublicTokenRequest(BaseModel):
    public_token: str

class SpendingResponse(BaseModel):
    daily: float
    weekly: float
    monthly: float

@app.get("/")
async def root():
    return {"message": "BiggerNumbers API is running! 🚀"}

@app.post("/create_link_token")
async def create_link_token():
    """Create a link token for Plaid Link initialization"""
    try:
        request = LinkTokenCreateRequest(
            products=[Products('transactions')],
            client_name="BiggerNumbers",
            country_codes=[CountryCode('GB')],
            language='en',
            user=LinkTokenCreateRequestUser(client_user_id='user-id')
        )
        
        response = client.link_token_create(request)
        return {"link_token": response['link_token']}
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error creating link token: {str(e)}")

@app.post("/exchange_public_token")
async def exchange_public_token(token_request: PublicTokenRequest):
    """Exchange public token for access token"""
    try:
        request = ItemPublicTokenExchangeRequest(
            public_token=token_request.public_token
        )
        
        response = client.item_public_token_exchange(request)
        return {"access_token": response['access_token']}
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error exchanging token: {str(e)}")

@app.get("/spending/{access_token}")
async def get_spending(access_token: str) -> SpendingResponse:
    """Get your three numbers: daily, weekly, monthly spending"""
    try:
        # Get last 30 days of transactions
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=30)
        
        request = TransactionsGetRequest(
            access_token=access_token,
            start_date=start_date,
            end_date=end_date
        )
        
        response = client.transactions_get(request)
        transactions = response['transactions']
        
        # Filter spending (positive amounts = money out)
        spending_transactions = [
            t for t in transactions 
            if t['amount'] > 0
        ]
        
        # Calculate the three numbers
        today = datetime.now().date()
        yesterday = today - timedelta(days=1)
        week_ago = today - timedelta(days=7)
        
        daily = sum(
            t['amount'] for t in spending_transactions 
            if t['date'] >= yesterday
        )
        
        weekly = sum(
            t['amount'] for t in spending_transactions 
            if t['date'] >= week_ago
        )
        
        monthly = sum(t['amount'] for t in spending_transactions)
        
        return SpendingResponse(
            daily=round(daily, 2),
            weekly=round(weekly, 2),
            monthly=round(monthly, 2)
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error fetching spending: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)