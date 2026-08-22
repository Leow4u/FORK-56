FROM python:3.13-slim-bookworm

# Legacy stub only — superseded by repo-root Dockerfile via fly.toml.
# Kept for local smoke tests; production golden image uses full Work4You build.

WORKDIR /app
COPY server.py /app/server.py

ENV WORK4YOU_DASHBOARD_PORT=8080
ENV PORT=8080
EXPOSE 8080

CMD ["python", "-u", "/app/server.py"]
