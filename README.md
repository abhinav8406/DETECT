# Fest Detective — Round 2

Implementation aligned to the supplied Round 2 specification.

## Stack
- Frontend: React + Vite + Bootstrap
- Backend: Node.js + Express + MongoDB/Mongoose
- Real-time admin monitoring: Socket.IO
- Authentication: JWT
- Passwords: bcrypt
- CSV export: json2csv

## Architecture
`frontend/` only renders backend state. It does not decide qualification, clue progression, scores, timer validity, or correct answers.

`backend/` is authoritative for:
- Round 1 qualification verification
- Round 2 access control
- case/clue/question/hint progression
- answer validation
- hint penalties
- server-side timer validation
- score calculation
- completion state
- admin operations
- live monitoring

## Start
1. Copy `backend/.env.example` to `backend/.env`.
2. Start MongoDB.
3. In `backend/`: `npm install && npm run dev`
4. In `frontend/`: `npm install && npm run dev`

The seeded demo data can be inserted with:
`cd backend && npm run seed`

Demo participant:
- email: qualified@example.com
- password: password123

Demo non-qualified participant:
- email: locked@example.com
- password: password123

Demo admin:
- email: admin@example.com
- password: admin123
