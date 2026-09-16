FROM python:3.12-slim
RUN useradd -m -u 10001 runner
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && rm -rf /root/.cache
COPY server.py .
RUN chown -R runner:runner /app
USER runner
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
EXPOSE 8080
CMD ["python","server.py"]
