#!/bin/bash
# Setup Google Drive Push Notifications for Meeting Notes folder
#
# Usage: ./setup-drive-webhook.sh <FOLDER_ID>
#
# Prerequisites:
# - gcloud CLI authenticated with appropriate scopes
# - Drive API enabled in the project

set -e

FOLDER_ID=$1
PROJECT_ID="karthik-patil-sandbox"
WEBHOOK_URL="https://us-central1-${PROJECT_ID}.cloudfunctions.net/processNewNote"
CHANNEL_ID="meeting-notes-$(date +%s)"

if [ -z "$FOLDER_ID" ]; then
  echo "Usage: ./setup-drive-webhook.sh <FOLDER_ID>"
  echo ""
  echo "To find your folder ID:"
  echo "1. Open Google Drive"
  echo "2. Navigate to your 'Meeting Notes' folder"
  echo "3. The URL will be: https://drive.google.com/drive/folders/FOLDER_ID"
  echo "4. Copy the FOLDER_ID part"
  exit 1
fi

echo "Setting up Drive webhook..."
echo "  Folder ID: $FOLDER_ID"
echo "  Webhook URL: $WEBHOOK_URL"
echo "  Channel ID: $CHANNEL_ID"
echo ""

# Get access token using gcloud
ACCESS_TOKEN=$(gcloud auth print-access-token)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "Error: Could not get access token. Please run: gcloud auth login"
  exit 1
fi

# Calculate expiration (7 days from now, max allowed)
EXPIRATION=$(($(date +%s) * 1000 + 7 * 24 * 60 * 60 * 1000))

# Register the webhook
echo "Registering webhook with Drive API..."

RESPONSE=$(curl -s -X POST \
  "https://www.googleapis.com/drive/v3/files/${FOLDER_ID}/watch" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"${CHANNEL_ID}\",
    \"type\": \"web_hook\",
    \"address\": \"${WEBHOOK_URL}\",
    \"expiration\": \"${EXPIRATION}\"
  }")

echo ""
echo "Response from Drive API:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

# Check if successful
if echo "$RESPONSE" | grep -q "resourceId"; then
  echo ""
  echo "✅ Webhook registered successfully!"
  echo ""
  echo "Important: Webhooks expire after 7 days. You'll need to re-run this script to renew."
  echo ""
  echo "To stop the webhook, use:"
  echo "  curl -X POST https://www.googleapis.com/drive/v3/channels/stop \\"
  echo "    -H \"Authorization: Bearer \$(gcloud auth print-access-token)\" \\"
  echo "    -H \"Content-Type: application/json\" \\"
  echo "    -d '{\"id\": \"${CHANNEL_ID}\", \"resourceId\": \"<resourceId from above>\"}'"
else
  echo ""
  echo "❌ Failed to register webhook. Check the error above."
  echo ""
  echo "Common issues:"
  echo "  - Folder ID is incorrect"
  echo "  - Missing Drive API scope (run: gcloud auth login --scopes=https://www.googleapis.com/auth/drive)"
  echo "  - Drive API not enabled in project"
fi
