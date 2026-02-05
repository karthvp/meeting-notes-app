#!/bin/bash

# Egen Meeting Notes - GCP Project Setup Script
# Day 1: GCP Project Setup
#
# Prerequisites:
# - Google Cloud SDK installed (gcloud CLI)
# - Authenticated with: gcloud auth login
# - Existing GCP project with billing enabled
#
# Usage: ./setup-project.sh

set -e

# Configuration - Using existing sandbox project
PROJECT_ID="karthik-patil-sandbox"
REGION="us-central1"

echo "========================================="
echo "Egen Meeting Notes - GCP Project Setup"
echo "========================================="
echo ""
echo "Using existing project: $PROJECT_ID"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed."
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check authentication
echo "1. Checking authentication..."
ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null)
if [ -z "$ACCOUNT" ]; then
    echo "Error: Not authenticated. Run: gcloud auth login"
    exit 1
fi
echo "   Authenticated as: $ACCOUNT"

# Verify project exists
echo ""
echo "2. Verifying project exists..."
if gcloud projects describe "$PROJECT_ID" &>/dev/null; then
    echo "   Project found: $PROJECT_ID"
else
    echo "Error: Project $PROJECT_ID not found."
    exit 1
fi

# Set project as default
echo ""
echo "3. Setting default project..."
gcloud config set project "$PROJECT_ID"

# Enable required APIs
echo ""
echo "4. Enabling required APIs..."
APIS=(
    "cloudfunctions.googleapis.com"
    "firestore.googleapis.com"
    "drive.googleapis.com"
    "calendar-json.googleapis.com"
    "aiplatform.googleapis.com"
    "cloudbuild.googleapis.com"
    "secretmanager.googleapis.com"
    "run.googleapis.com"
    "cloudresourcemanager.googleapis.com"
)

for API in "${APIS[@]}"; do
    echo "   Enabling $API..."
    gcloud services enable "$API" --quiet
done
echo "   All APIs enabled."

# Create service account
echo ""
echo "5. Creating service account..."
SERVICE_ACCOUNT_NAME="egen-meeting-notes-sa"
SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

if gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" &>/dev/null; then
    echo "   Service account already exists."
else
    gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
        --display-name="Egen Meeting Notes Service Account" \
        --description="Service account for Egen Meeting Notes application"
    echo "   Service account created."
fi

# Grant roles to service account
echo ""
echo "6. Granting IAM roles to service account..."
ROLES=(
    "roles/cloudfunctions.developer"
    "roles/datastore.user"
    "roles/secretmanager.secretAccessor"
    "roles/iam.serviceAccountUser"
    "roles/logging.logWriter"
)

for ROLE in "${ROLES[@]}"; do
    echo "   Granting $ROLE..."
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
        --role="$ROLE" \
        --quiet
done

# Create and download service account key
echo ""
echo "7. Creating service account key..."
KEY_FILE="./service-account-key.json"
if [ -f "$KEY_FILE" ]; then
    echo "   Key file already exists. Skipping."
else
    gcloud iam service-accounts keys create "$KEY_FILE" \
        --iam-account="$SERVICE_ACCOUNT_EMAIL"
    echo "   Key saved to: $KEY_FILE"
    echo ""
    echo "   IMPORTANT: Store this key securely and never commit to git!"
fi

# Create Firestore database
echo ""
echo "8. Creating Firestore database..."
# Check if Firestore already exists
if gcloud firestore databases describe --database="(default)" &>/dev/null; then
    echo "   Firestore database already exists."
else
    gcloud firestore databases create --location="$REGION" --type=firestore-native
    echo "   Firestore database created in $REGION"
fi

# Set up budget alert (optional)
echo ""
echo "9. Budget alert setup (optional)..."
echo "    To set up budget alerts, go to:"
echo "    https://console.cloud.google.com/billing/budgets?project=$PROJECT_ID"

echo ""
echo "========================================="
echo "GCP Project Setup Complete!"
echo "========================================="
echo ""
echo "Project ID: $PROJECT_ID"
echo "Service Account: $SERVICE_ACCOUNT_EMAIL"
echo "Region: $REGION"
echo ""
echo "Next steps:"
echo "1. Configure OAuth consent screen (see configure-oauth.sh)"
echo "2. Set up Firestore collections (see ../firestore/)"
echo "3. Deploy Cloud Functions (see ../../functions/)"
echo ""
echo "Console URLs:"
echo "- Project: https://console.cloud.google.com/home/dashboard?project=$PROJECT_ID"
echo "- Firestore: https://console.cloud.google.com/firestore?project=$PROJECT_ID"
echo "- Functions: https://console.cloud.google.com/functions?project=$PROJECT_ID"
echo "- APIs: https://console.cloud.google.com/apis/dashboard?project=$PROJECT_ID"
