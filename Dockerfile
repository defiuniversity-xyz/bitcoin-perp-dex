# Use official Python runtime as a parent image
FROM python:3.9-slim

# Install system deps: Node.js (for brahma-service mock) + secp256k1 build deps
RUN apt-get update && apt-get install -y \
    nodejs npm \
    pkg-config libsecp256k1-dev \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy backend requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install gunicorn

# Copy local brahma-service dependencies and install
COPY brahma-service/package.json brahma-service/
RUN cd brahma-service && npm install

# Copy the rest of the application code
COPY . .

# Expose port 8080 (Cloud Run default)
ENV PORT=8080
EXPOSE 8080

# Command to run the application using Gunicorn
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app
