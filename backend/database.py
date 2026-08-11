import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
USER = os.getenv("NEO4J_USER", "neo4j")
PASSWORD = os.getenv("NEO4J_PASSWORD", "")
DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")

_driver = None


def get_driver():
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))
    return _driver


def close_driver():
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None


def run(cypher, **params):
    with get_driver().session(database=DATABASE) as session:
        result = session.run(cypher, **params)
        return [record.data() for record in result]


def run_one(cypher, **params):
    rows = run(cypher, **params)
    return rows[0] if rows else None


def check_connection():
    try:
        get_driver().verify_connectivity()
        return True
    except Exception:
        return False
