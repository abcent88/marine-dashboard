# Marine Dashboard

Professional marine fleet management dashboard for vessels, voyages, crew, fuel, maintenance, catch, alerts, reports, and users.

## Technology

- Node.js 20+
- Express
- MySQL
- Socket.IO
- HTML/CSS/JavaScript
- Jest and Supertest
- ESLint
- Docker and Docker Compose

## Quick Start with Docker

Clone the repository:

    git clone https://github.com/abcent88/marine-dashboard.git
    cd marine-dashboard

Start the application:

    docker-compose up -d

Check the services:

    docker-compose ps

The Node API runs on http://127.0.0.1:3001.

## Health Check

    curl -i http://127.0.0.1:3001/health

The health endpoint should return HTTP 200 with a JSON health response.

## Authentication

Protected API endpoints require an authenticated session.

Development demo administrator:

    Email: admin@marine.io
    Password: MarineDemo2026
    Role: super_admin

These credentials are for local development/demo use only and must not be used in production.

## Authenticated API Test

    rm -f /tmp/marine-dashboard-cookies.txt
    curl -sS -c /tmp/marine-dashboard-cookies.txt -H 'Content-Type: application/json' -d '{"email":"admin@marine.io","password":"MarineDemo2026"}' http://127.0.0.1:3001/api/auth/login
    curl -sS -b /tmp/marine-dashboard-cookies.txt -i http://127.0.0.1:3001/api/vessels

The authenticated vessels request should return HTTP 200 JSON containing the seeded vessel data.

## Database

Docker initializes MySQL using:

    database/001_initial_schema.sql
    database/002_seed_demo_data.sql

The development database contains demo ports, vessels, users, voyages, crew, fuel, maintenance, catch, alerts, and reporting data.

## Testing

    cd node
    npm ci
    npm test

Run linting:

    npm run lint

## Local Node Development

Copy the environment template:

    cp .env.example .env

Install dependencies:

    cd node
    npm ci

Start the API:

    npm start

## Security

Do not commit .env or production secrets. Production deployments must use strong private credentials, a strong SESSION_SECRET, HTTPS, restricted database access, secure backups, and reviewed role permissions.

## Project Status

The project includes authentication, role-based access control, vessel management, voyages, crew, fuel, maintenance, catch, alerts, reports, automated route tests, ESLint, GitHub Actions CI, and a Docker-based development environment.
