# API Documentation - Nopa App Backend

This document describes the RESTful API endpoints for the Nopa App. All request and response bodies are formatted as JSON. The base path for all endpoints is `/api/v1`.

---

## Table of Contents
1. [Authentication & Profile](#1-authentication--profile)
2. [Challenges & Quizzes](#2-challenges--quizzes)
3. [Submissions & Tasks](#3-submissions--tasks)
4. [Leagues & Leaderboards](#4-leagues--leaderboards)
5. [Mentor Evaluations](#5-mentor-evaluations)
6. [Notifications](#6-notifications)

---

## 1. Authentication & Profile

### POST `/auth/login`
Logs in a user and returns a signed JWT.
- **Request Body:**
  ```json
  {
    "phoneNumber": "09123456789",
    "password": "your_password"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "student_1",
      "name": "کمیل محمدی",
      "phoneNumber": "09123456789",
      "role": "student",
      "zarikBalance": 12500,
      "levelFrame": 3,
      "caravanId": "c1"
    }
  }
  ```

### GET `/users/me`
Retrieves details of the currently logged-in user. Requires JWT authorization header.
- **Authorization:** `Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "id": "student_1",
    "name": "کمیل محمدی",
    "phoneNumber": "09123456789",
    "role": "student",
    "zarikBalance": 12500,
    "levelFrame": 3,
    "caravanId": "c1",
    "avatarUrl": null,
    "hasEvaluatedMentorThisSeason": false
  }
  ```

### GET `/users/mentor/:id`
Retrieves public profile details of a mentor.
- **Authorization:** `Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "id": "mentor_1",
    "name": "استاد علوی",
    "avatarUrl": "https://images.unsplash.com/...w=200",
    "rating": 4.8,
    "caravansCount": 2,
    "membersCount": 22,
    "bio": "راهبر ارشد سرزمین نپا...",
    "certificates": [
      "گواهی عالی مربیگری تربیتی نپا",
      "گواهی تخصصی رسانه و تولید محتوا",
      "گواهی شایستگی مدیریت کاروان نپا"
    ]
  }
  ```

---

## 2. Challenges & Quizzes

### GET `/challenges`
Retrieves list of all active challenges.
- **Authorization:** `Bearer <token>`
- **Response (200 OK):**
  ```json
  [
    {
      "id": "challenge_1",
      "title": "آزمون مرحله‌ای رسانه و تفکر",
      "description": "آزمون ۳ مرحله‌ای برای...",
      "type": "quiz",
      "questions": [
        {
          "q": "منظور از تفکر SMART چیست؟",
          "options": ["مشخص، قابل اندازه گیری...", "ساده، مهم..."],
          "correct": 0
        }
      ],
      "rewardZarik": 50
    }
  ]
  ```

### POST `/challenges`
Allows mentors to create a new challenge.
- **Authorization:** `Bearer <token>` (Mentor only)
- **Request Body:**
  ```json
  {
    "title": "چالش تفکر خلاق",
    "description": "نوشتن تمرین ایستگاه دوم...",
    "type": "skill",
    "rewardZarik": 300
  }
  ```

### POST `/challenges/:id/submit-quiz`
Corrects a quiz submission on the server-side, updates wallet balance, and generates a notification.
- **Authorization:** `Bearer <token>`
- **Request Body:**
  ```json
  {
    "answers": [0, 1, 1]
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "score": 3,
    "total": 3,
    "rewardZarik": 30,
    "zarikBalance": 12530,
    "submissionId": "sub_uuid"
  }
  ```

---

## 3. Submissions & Tasks

### POST `/submissions`
Submits a student answer to a challenge.
- **Authorization:** `Bearer <token>`
- **Request Body:**
  ```json
  {
    "challengeId": "c1",
    "answerText": "پاسخ من به چالش..."
  }
  ```

### GET `/submissions/pending`
Returns a list of submissions awaiting review.
- **Authorization:** `Bearer <token>` (Mentor only)

### PATCH `/submissions/:id/review`
Approves or rejects a task submission. Automatically credits wallet rewards on approval.
- **Authorization:** `Bearer <token>` (Mentor only)
- **Request Body:**
  ```json
  {
    "status": "approved",
    "score": 100,
    "mentorFeedback": "کار عالی!"
  }
  ```

---

## 4. Leagues & Leaderboards

### GET `/leagues/caravans`
Returns caravans ranked by progress.

### GET `/leagues/wealthiest`
Returns students ranked by Zarik wallet balance.

### GET `/leagues/mentors`
Returns mentors ranked by average student ratings.

---

## 5. Mentor Evaluations

### POST `/evaluations/mentor`
Submits a rating and reviews for a mentor. Unlocks student final exams (`hasEvaluatedMentorThisSeason` set to `true`).
- **Request Body:**
  ```json
  {
    "mentorId": "mentor_1",
    "ratingValue": 5,
    "guidanceFeedback": "عالی",
    "seasonEvaluationComments": "مربی با حوصله و صبور"
  }
  ```

---

## 6. Notifications

### GET `/notifications`
Fetches a list of notifications for the user.
- **Response (200 OK):**
  ```json
  {
    "unreadCount": 1,
    "notifications": [
      {
        "id": "n1",
        "title": "تکلیف تایید شد ✅",
        "message": "پاسخ شما تایید و +200 زریک واریز شد.",
        "isRead": false
      }
    ]
  }
  ```

### PATCH `/notifications/:id/read`
Marks a notification as read.
