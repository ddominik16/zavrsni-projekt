FROM python:3.11-slim

WORKDIR /app

# Prvo samo requirements, da se sloj s bibliotekama ne gradi ponovno
# svaki put kad se promijeni kod.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
