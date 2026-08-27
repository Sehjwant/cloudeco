# 🦘 Aussie EcoLens

> A Multi-Cloud Serverless Wildlife Observation Platform

**FIT5225 Cloud Computing & Security — S1 2026 — Assignment 2**

[![Cloud Run](https://img.shields.io/badge/Backend-Cloud%20Run-4285F4?logo=googlecloud)](https://aussie-ecolens-api-834644825736.australia-southeast1.run.app/health)
[![AWS Cognito](https://img.shields.io/badge/Auth-AWS%20Cognito-FF9900?logo=amazonaws)](https://aws.amazon.com/cognito/)
[![GCP Firestore](https://img.shields.io/badge/DB-Firestore-FFCA28?logo=firebase)](https://firebase.google.com/docs/firestore)

---

## Overview

Aussie EcoLens is a multi-cloud serverless platform that allows citizen scientists, researchers, and wildlife enthusiasts to upload, auto-tag, and search wildlife media (images and videos). Upon upload, the system automatically identifies Australian species using a two-stage ML pipeline (MegaDetector + SpeciesNet) and stores the results for querying.

---

## Architecture

| Cloud | Services Used |
|-------|--------------|
| **AWS** | Cognito (User Pool, JWT auth, email verification) |
| **GCP** | Cloud Run (Flask API + static frontend), Cloud Storage, Firestore, Pub/Sub, Cloud Functions |

```
Browser → React + Vite SPA (hosted on GCP Cloud Run, static via nginx)
    │
    ├──→ AWS Cognito (sign-in / sign-up / JWT)
    │
    └──→ GCP Cloud Run (Flask REST API)
              ├──→ Cloud Storage (media + thumbnails)
              ├──→ Firestore (tags, metadata)
              ├──→ Cloud Storage (ML models)
              └──→ Pub/Sub → Cloud Function → Gmail SMTP (notifications)
```

---

## Features

- ✅ **Authentication** — AWS Cognito sign-up/sign-in/sign-out with email verification
- ✅ **File Upload** — Images and videos with SHA-256 checksum deduplication
- ✅ **ML Tagging** — Two-stage pipeline: MegaDetector v5a + SpeciesNet (46 Australian species)
- ✅ **Thumbnail Generation** — Aspect-ratio preserving thumbnails (PIL)
- ✅ **Video Processing** — 1 frame/sec extraction (OpenCV), peak species count
- ✅ **Search by Tags** — Logical AND with minimum counts
- ✅ **Search by Species** — Simple species query
- ✅ **Search by Thumbnail URL** — Resolve thumbnail → full image
- ✅ **Search by Uploaded File** — Detect tags in query file, find matches (not stored)
- ✅ **Bulk Tag Edit** — Add/remove tags across multiple files
- ✅ **Delete Files** — Remove from GCS storage and Firestore
- ✅ **Notifications** — Email alerts via GCP Pub/Sub + Cloud Function + Gmail SMTP

---

## Supported Species (46)

The SpeciesNet model detects 46 Australian native and introduced species including:

| Scientific Name | Common Name |
|----------------|-------------|
| Macropus_giganteus | Eastern Grey Kangaroo |
| Vombatus_ursinus | Common Wombat |
| Tachyglossus_aculeatus | Australian Echidna |
| Canis_dingo | Dingo |
| Trichosurus_vulpecula | Common Brushtail Possum |
| Dacelo_novaeguineae | Laughing Kookaburra |
| Gymnorhina_tibicen | Australian Magpie |
| Bos_taurus | Cattle |
| Rattus_rattus | Black Rat |
| Vulpes_vulpes | Red Fox |

See [`backend/gcp_api/labels.txt`](backend/gcp_api/labels.txt) for the complete list.

---

## Repository Structure

```
Aussie-EcoLens/
├── frontend/                  # React + Vite + TypeScript UI
│   ├── src/
│   │   ├── auth/              # Cognito auth + route guard
│   │   ├── features/          # Upload, Search, Tags, Delete, Notifications
│   │   ├── lib/               # API client, species list, hooks
│   │   └── components/        # Shared UI components
│   └── .env.example
├── backend/
│   ├── auth/                  # Cognito JWT verification utilities
│   ├── gcp_api/               # Flask REST API (Cloud Run)
│   │   ├── main.py            # All endpoints + ML pipeline
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── labels.txt
│   └── notify_function/       # GCP Cloud Function (email notifications)
│       ├── main.py
│       └── requirements.txt
├── docs/
│   ├── ARCHITECTURE.md
│   └── architecture.drawio
└── infra/
    └── create-cognito.sh      # Cognito User Pool provisioning script
```

---

## Local Development

### Prerequisites

- Node.js 18+
- Python 3.11+
- GCP credentials (`gcloud auth application-default login`)
- AWS Cognito User Pool (see `infra/create-cognito.sh`)

### Frontend

```bash
cd frontend
cp .env.example .env
# Fill in Cognito credentials and API URL
npm install
npm run dev
# Opens at http://localhost:5173
```

### Backend (Flask API)

```bash
cd backend/gcp_api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in GCP project, bucket, Cognito credentials
flask --app main run --port 8080
```

---

## Deployment

### Frontend (Cloud Run)

The React app is built locally and served as static files via nginx on Cloud Run
(`frontend/Dockerfile` + `frontend/nginx.conf`).

```bash
cd frontend
npm install
npm run build                 # produces dist/ (bakes in VITE_* env vars)
gcloud run deploy ecolens-frontend \
  --source . \
  --region australia-southeast1 \
  --project aussie-ecolens-0ng5zo \
  --allow-unauthenticated
```

**Live frontend:** `https://ecolens-frontend-834644825736.australia-southeast1.run.app`

> The build embeds `VITE_API_BASE_URL` and the Cognito IDs at build time, so
> rebuild + redeploy after changing `frontend/.env`. Login works from any origin
> (Cognito is origin-independent), and the backend's `CORS_ORIGINS=*` permits the
> hosted origin.

### Backend (Cloud Run)

```bash
cd backend/gcp_api
gcloud run deploy aussie-ecolens-api \
  --source . \
  --region australia-southeast1 \
  --project aussie-ecolens-0ng5zo \
  --allow-unauthenticated \
  --memory 4Gi \
  --timeout 300 \
  --cpu 2
```

**Live API:** `https://aussie-ecolens-api-834644825736.australia-southeast1.run.app`

### Notification Cloud Function

```bash
cd backend/notify_function
gcloud functions deploy notify-subscribers \
  --runtime python311 \
  --trigger-topic tag-notifications \
  --entry-point notify_subscribers \
  --region australia-southeast1 \
  --project aussie-ecolens-0ng5zo \
  --gen2
```

### ML Models

Upload model files to GCS (done once):

```bash
gsutil cp mdv5a.pt gs://aussie-ecolens-0ng5zo-models/
gsutil cp model.pt gs://aussie-ecolens-0ng5zo-models/
```

Models are downloaded automatically at Cloud Run startup — swap a model by uploading a new version to GCS and restarting the service.

---

## Environment Variables

### Frontend (`.env`)

```
VITE_COGNITO_USER_POOL_ID=us-east-1_C1NYDVm0c
VITE_COGNITO_CLIENT_ID=5e22hu1p0qqlsuvsn286p7f9rv
VITE_AWS_REGION=us-east-1
VITE_API_BASE_URL=https://aussie-ecolens-api-834644825736.australia-southeast1.run.app
```

### Backend (`.env`)

```
GCP_PROJECT=aussie-ecolens-0ng5zo
GCS_BUCKET=aussie-ecolens-0ng5zo-media
MODELS_BUCKET=aussie-ecolens-0ng5zo-models
FIRESTORE_COLLECTION=media
SUBSCRIPTIONS_COLLECTION=subscriptions
PUBSUB_TOPIC=tag-notifications
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_C1NYDVm0c
COGNITO_APP_CLIENT_ID=5e22hu1p0qqlsuvsn286p7f9rv
COGNITO_TOKEN_USE=id
CORS_ORIGINS=*
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/files` | Upload file (multipart) |
| `DELETE` | `/files` | Delete files by URL |
| `POST` | `/search/tags` | Search by tags + minimum counts |
| `POST` | `/search/species` | Search by species |
| `POST` | `/resolve-thumbnail` | Thumbnail URL → full image URL |
| `POST` | `/search/by-file` | Search by uploaded file (not stored) |
| `POST` | `/tags` | Bulk add/remove tags |
| `POST` | `/notifications/subscribe` | Subscribe to species notifications |

All endpoints except `/health` require `Authorization: Bearer <Cognito JWT>` header.

---

## Team

| Name | Student ID | GitHub |
|------|-----------|--------|
| Akanksha Tomar | 35679220 | akanksha4715 |
| Sehjwant Singh | 35728949 | sehj0001 |
| Vedika Shivhare | 35445483 | VedikaShivhare |
| Arohan Mishra | 35700165| amis0020 |

---

## AI Usage Acknowledgement

Generative AI tools (Claude by Anthropic) were used selectively for code generation assistance, debugging, and documentation drafting. All AI-generated code was reviewed, understood, and modified by team members in accordance with Monash University's academic integrity policy.
