FROM python:3.11-slim

# Install system dependencies for OpenCV and ML libraries
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Step 1: Install ultralytics-yolov5 WITH its deps (needed for 'utils' module)
RUN pip install --no-cache-dir ultralytics-yolov5==0.1.1

# Step 2: Override protobuf to version compatible with GCP libraries
RUN pip install --no-cache-dir "protobuf>=4.25.8,<5.0.0" --force-reinstall

# Step 3: Install megadetector without deps (reuses yolov5 already installed)
RUN pip install --no-cache-dir megadetector==10.0.21 --no-deps

# Step 4: Install everything else
RUN pip install --no-cache-dir -r requirements.txt

# Step 5: Fix protobuf again after requirements (some packages may downgrade it)
RUN pip install --no-cache-dir "protobuf>=4.25.8,<5.0.0" --force-reinstall

# Create models directory
RUN mkdir -p /app/models

# Copy application code
COPY main.py .

# Set environment variables
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 300 main:app
