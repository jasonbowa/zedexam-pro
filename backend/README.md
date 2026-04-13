# ZedExam Pro Backend (Launch Cleanup Plus)

This package is a hardened backend for ZedExam Pro, prepared to work with the upgraded frontend.

## What was improved
- standardized environment loading and startup validation
- added auth attachment middleware and admin-protected write routes
- added `GET /api/auth/me` for restoring sessions cleanly
- protected admin-only endpoints such as bulk upload, subject/topic/question creation, and mock exam management
- improved dashboard output with recent attempts
- improved filtering support on subjects, topics, questions, and results endpoints
- preserved compatibility with the current frontend token format (`admin-token-*`, `student-token-*`)
- added cleaner shutdown handling for Prisma/server restarts
- added support for multiple frontend origins in `FRONTEND_URL` using comma-separated values
- blocked invalid result payloads such as negative scores or score values above total
- blocked mock exams from being created with questions from the wrong topic
- blocked question updates that would save incomplete answer options

## Important reality check
This is still an MVP backend, not enterprise-grade security. Passwords are still plain text in this package so it remains compatible with your current frontend and simple local launch flow.

## Setup
1. Copy `.env.example` to `.env`
2. Set your PostgreSQL `DATABASE_URL`
3. Run:

```bash
npm install
npx prisma generate
npx prisma db push
npm run seed:all
npm start
```

## Frontend URL note
You can now allow more than one frontend origin by using a comma-separated value in `.env`, for example:

```env
FRONTEND_URL=http://localhost:5173,http://127.0.0.1:5173
```

## Demo credentials
### Student
- Phone: `0970000000`
- Password: `123456`

### Admin
- Email: `admin@zedexam.com`
- Password: `admin123`

## Main routes
- `GET /health`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `GET /api/dashboard`
- `GET /api/subjects`
- `GET /api/topics`
- `GET /api/quizzes/:topicId`
- `POST /api/results`
- `GET /api/mock-exams`
- `GET /api/admin`

## Recommended next step
Use this backend with your upgraded frontend, test the full student flow once, then focus on adding real question content.
