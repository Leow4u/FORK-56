FROM python:3.13-slim-bookworm

WORKDIR /app
COPY server.py /app/server.py

ENV WORK4YOU_DASHBOARD_PORT=8080
ENV PORT=8080
EXPOSE 8080

CMD ["python", "-u", "/app/server.py"]
