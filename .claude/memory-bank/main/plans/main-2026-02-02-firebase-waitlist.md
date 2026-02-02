# PLAN: Firebase Database for Waitlist

**Branch:** main
**Date:** 2026-02-02
**Feature:** Replace JSON file storage with Firebase Firestore for waitlist emails
**Status:** DRAFT - Awaiting Approval

---

## 1. Overview

Replace the current JSON file-based storage (`data/waitlist.json`) with Firebase Firestore for production-ready, scalable waitlist email collection.

### Current Implementation
- `frontend/lib/waitlist.ts` - Reads/writes to local JSON file
- `frontend/data/waitlist.json` - Local file storage
- Works only in development, data lost on redeploy

### Target Implementation
- Firebase Firestore collection for persistent storage
- Works in production (Vercel, etc.)
- Real-time capabilities for future features
- Admin SDK for server-side operations

---

## 2. Technical Specifications

### 2.1 Firebase Products Used
- **Firebase Firestore** - NoSQL document database for storing waitlist entries
- **Firebase Admin SDK** - Server-side authentication for Next.js API routes

### 2.2 Firestore Data Model
```
Collection: waitlist
Document ID: auto-generated
Fields:
  - email: string (lowercase, trimmed)
  - timestamp: Firestore.Timestamp
  - source: string (optional, for tracking signup source)
```

### 2.3 File Changes
```
frontend/
├── lib/
│   ├── firebase-admin.ts    # NEW: Firebase Admin SDK initialization
│   └── waitlist.ts          # MODIFY: Replace fs with Firestore
├── .env.local               # ADD: Firebase credentials (gitignored)
├── .env.example             # NEW: Template for environment variables
└── package.json             # MODIFY: Add firebase-admin dependency
```

---

## 3. Implementation Steps

### Step 1: Install Firebase Admin SDK
```bash
cd frontend && npm install firebase-admin
```

### Step 2: Create Environment Variables Template
File: `frontend/.env.example`
```
# Firebase Admin SDK Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Step 3: Create Firebase Admin Initialization
File: `frontend/lib/firebase-admin.ts`
```typescript
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const firebaseAdminConfig = {
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
};

// Initialize Firebase Admin only if not already initialized
const app = getApps().length === 0
  ? initializeApp(firebaseAdminConfig)
  : getApps()[0];

export const db = getFirestore(app);
```

### Step 4: Update Waitlist Module
File: `frontend/lib/waitlist.ts`
```typescript
import { db } from "./firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

const COLLECTION_NAME = "waitlist";

export interface WaitlistEntry {
  email: string;
  timestamp: Timestamp;
  source?: string;
}

export async function addToWaitlist(
  email: string,
  source?: string
): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();

  const docRef = await db.collection(COLLECTION_NAME).add({
    email: normalizedEmail,
    timestamp: Timestamp.now(),
    source: source || "landing-page",
  });

  return docRef.id;
}

export async function isEmailRegistered(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();

  const snapshot = await db
    .collection(COLLECTION_NAME)
    .where("email", "==", normalizedEmail)
    .limit(1)
    .get();

  return !snapshot.empty;
}

export async function getWaitlistCount(): Promise<number> {
  const snapshot = await db.collection(COLLECTION_NAME).count().get();
  return snapshot.data().count;
}
```

### Step 5: Update API Route (Minor)
File: `frontend/app/api/waitlist/route.ts`

No changes required - the API route already uses the exported functions from `@/lib/waitlist`. The interface remains the same.

### Step 6: Create Firestore Security Rules
This is configured in Firebase Console, but document for reference:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /waitlist/{document=**} {
      // Only server (Admin SDK) can read/write
      allow read, write: if false;
    }
  }
}
```

### Step 7: Remove JSON File Storage
- Delete `frontend/data/waitlist.json`
- Remove `data/waitlist.json` from `.gitignore` (optional, keeps it clean)

### Step 8: Update .gitignore
File: `frontend/.gitignore`
- Remove: `data/waitlist.json`
- Ensure `.env.local` is already ignored (default in Next.js)

---

## 4. Firebase Project Setup (Manual Steps)

These steps are performed in Firebase Console (not code):

1. **Create Firebase Project**
   - Go to https://console.firebase.google.com
   - Create new project: "clawork" or similar
   - Disable Google Analytics (optional for hackathon)

2. **Enable Firestore Database**
   - Go to Firestore Database in sidebar
   - Click "Create database"
   - Select "Start in production mode"
   - Choose region (us-central1 recommended)

3. **Create Service Account**
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Download JSON file (keep secure, never commit)

4. **Extract Credentials**
   From downloaded JSON, extract:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`

5. **Create .env.local**
   - Create `frontend/.env.local` with extracted values
   - Ensure private key has `\n` escaped newlines

---

## 5. File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `frontend/lib/firebase-admin.ts` | CREATE | Firebase Admin SDK initialization |
| `frontend/lib/waitlist.ts` | REPLACE | Firestore-based implementation |
| `frontend/.env.example` | CREATE | Template for environment variables |
| `frontend/.env.local` | CREATE | Actual credentials (gitignored, manual) |
| `frontend/package.json` | MODIFY | Add firebase-admin dependency |
| `frontend/.gitignore` | MODIFY | Remove data/waitlist.json entry |
| `frontend/data/` | DELETE | Remove entire data directory |

---

## 6. Dependencies

```json
{
  "dependencies": {
    "firebase-admin": "^12.0.0"
  }
}
```

---

## 7. Testing Checklist

- [ ] Firebase Admin SDK initializes without errors
- [ ] Email submission creates document in Firestore
- [ ] Duplicate email check works correctly
- [ ] Error handling works when Firebase is unavailable
- [ ] Environment variables are properly loaded
- [ ] Production deployment works (Vercel)

---

## 8. Vercel Deployment Notes

When deploying to Vercel:
1. Add environment variables in Vercel Dashboard
2. For `FIREBASE_PRIVATE_KEY`, paste the entire key including `-----BEGIN/END-----`
3. Vercel automatically handles the newline escaping

---

## 9. Security Considerations

- Service account key is never committed to git
- Firestore rules block all client-side access
- Only server-side API routes can access Firestore
- Email validation happens before database write

---

## 10. Future Enhancements (Out of Scope)

- Real-time listener for waitlist count display
- Admin dashboard to view/export waitlist
- Email verification flow with Firebase Auth
- Rate limiting at Firestore level

---

**END OF PLAN**

Awaiting approval to proceed to EXECUTE mode.
