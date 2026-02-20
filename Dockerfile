# Use official Python image
FROM python:3.11-slim

# Install Node.js
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean

WORKDIR /app

# Copy everything
COPY . .

# Build frontend (VITE_API_URL empty = same-origin, no separate backend needed)
RUN cd frontend && npm install && VITE_API_URL="" npm run build

# Install backend dependencies
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 10000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "10000"]