FROM python:3.12-slim

WORKDIR /app

# requirements.txt is copied by itself first so the pip install layer gets
# cached. Copying all the code first would make pip run again on every
# small code change.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 5000

CMD ["python", "app.py"]
