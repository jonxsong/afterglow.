FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY services/api/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY services ./services
COPY ml ./ml
RUN mkdir -p /data/uploads
CMD ["sh", "-c", "alembic -c services/api/alembic.ini upgrade head && uvicorn services.api.app.main:app --host 0.0.0.0 --port 8000"]

