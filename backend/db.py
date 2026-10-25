import os

from pymongo import MongoClient

MONGO_URL = (
    os.getenv("MONGODB_URI")
    or os.getenv("MONGO_URL")
    or "mongodb://localhost:27017"
)
client = MongoClient(MONGO_URL)

db = client["workflow_engine"]
users_collection = db["users"]
workflows_collection = db["workflows"]
