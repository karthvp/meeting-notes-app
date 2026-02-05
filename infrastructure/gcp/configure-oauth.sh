#!/bin/bash

# Egen Meeting Notes - OAuth Consent Screen Configuration Guide
# Day 1: Configure OAuth for internal use
#
# Note: OAuth consent screen must be configured via the GCP Console UI.
# This script provides instructions and opens the relevant pages.

set -e

PROJECT_ID="karthik-patil-sandbox"

echo "========================================="
echo "OAuth Consent Screen Configuration"
echo "========================================="
echo ""
echo "OAuth consent screen must be configured manually in the GCP Console."
echo ""
echo "Follow these steps:"
echo ""
echo "1. OAUTH CONSENT SCREEN"
echo "   URL: https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID"
echo ""
echo "   Configure the following:"
echo "   - User Type: Internal (for @egen.com users only)"
echo "   - App name: Egen Meeting Notes"
echo "   - User support email: your-email@egen.com"
echo "   - Developer contact: your-email@egen.com"
echo ""
echo "2. SCOPES"
echo "   Add the following scopes:"
echo "   - https://www.googleapis.com/auth/drive (Google Drive access)"
echo "   - https://www.googleapis.com/auth/calendar.readonly (Calendar read access)"
echo "   - https://www.googleapis.com/auth/userinfo.email (User email)"
echo "   - https://www.googleapis.com/auth/userinfo.profile (User profile)"
echo ""
echo "3. CREATE OAUTH CLIENT ID"
echo "   URL: https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
echo ""
echo "   Create credentials for:"
echo ""
echo "   A) Web Application (for AppSheet/Dashboard)"
echo "      - Name: Egen Meeting Notes Web Client"
echo "      - Authorized JavaScript origins:"
echo "        - https://egen-meeting-notes.web.app"
echo "        - http://localhost:3000 (for development)"
echo "      - Authorized redirect URIs:"
echo "        - https://egen-meeting-notes.web.app/callback"
echo "        - http://localhost:3000/callback"
echo ""
echo "   B) Chrome Extension (for browser extension)"
echo "      - Name: Egen Meeting Notes Extension"
echo "      - Application type: Chrome Extension"
echo "      - Item ID: (add after extension is published)"
echo ""
echo "4. DOWNLOAD CREDENTIALS"
echo "   After creating OAuth clients:"
echo "   - Download the JSON for each client"
echo "   - Store securely (never commit to git)"
echo "   - Use for local development and deployment"
echo ""
echo "========================================="
echo ""

# Open the OAuth consent screen page
if command -v open &> /dev/null; then
    echo "Opening OAuth consent screen in browser..."
    open "https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID"
elif command -v xdg-open &> /dev/null; then
    xdg-open "https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID"
fi

echo ""
echo "After configuration, create a file with your OAuth client IDs:"
echo ""
echo "cat > .env.local << EOF"
echo "OAUTH_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com"
echo "OAUTH_WEB_CLIENT_SECRET=your-web-client-secret"
echo "OAUTH_EXTENSION_CLIENT_ID=your-extension-client-id.apps.googleusercontent.com"
echo "EOF"
