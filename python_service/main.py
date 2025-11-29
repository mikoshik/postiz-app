from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock data
makes = [
    {"id": "124", "name": "BMW"},
    {"id": "125", "name": "Mercedes-Benz"},
    {"id": "126", "name": "Toyota"},
    {"id": "127", "name": "Ford"},
    {"id": "128", "name": "Volkswagen"},
    {"id": "129", "name": "Honda"},
]

models = {
    "124": [
        {"id": "555", "name": "X5"},
        {"id": "556", "name": "5 Series"},
        {"id": "557", "name": "3 Series"},
    ],
    "125": [
        {"id": "558", "name": "E-Class"},
        {"id": "600", "name": "G-Class"},
    ],
}

@app.get("/api/999/makes")
async def get_makes():
    return JSONResponse(content=makes)

@app.get("/api/999/models")
async def get_models(make_id: str):
    return JSONResponse(content=models.get(make_id, []))