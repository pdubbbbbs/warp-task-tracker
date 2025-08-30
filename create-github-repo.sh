#!/bin/bash

# GitHub Repository Creation and Push Automation Script
# Usage: ./create-github-repo.sh [GITHUB_TOKEN]

set -e

echo "🚀 Warp Task Tracker - GitHub Repository Automation"
echo "=================================================="

# Repository details
REPO_NAME="warp-task-tracker"
REPO_DESCRIPTION="A real-time task completion percentage tracker for Warp terminal sessions"
GITHUB_USERNAME="pdubbbbbs"

# Get GitHub token
if [ -n "$1" ]; then
    GITHUB_TOKEN="$1"
elif command -v pass >/dev/null 2>&1; then
    echo "📋 Getting GitHub token from pass store..."
    GITHUB_TOKEN=$(pass show github/token 2>/dev/null || pass show github 2>/dev/null || "")
    if [ -z "$GITHUB_TOKEN" ]; then
        echo "❌ No GitHub token found in pass store"
        echo "💡 Please provide token as argument: ./create-github-repo.sh YOUR_TOKEN"
        exit 1
    fi
elif [ -n "$GITHUB_TOKEN" ]; then
    echo "📋 Using GITHUB_TOKEN environment variable..."
else
    echo "❌ No GitHub token provided!"
    echo "💡 Options:"
    echo "   1. Run: ./create-github-repo.sh YOUR_TOKEN"
    echo "   2. Set environment: export GITHUB_TOKEN=your_token"
    echo "   3. Install pass and store token there"
    exit 1
fi

echo "📋 Repository: $GITHUB_USERNAME/$REPO_NAME"
echo "📝 Description: $REPO_DESCRIPTION"

# Create repository on GitHub
echo ""
echo "🔨 Creating GitHub repository..."
RESPONSE=$(curl -s -X POST \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    https://api.github.com/user/repos \
    -d "{
        \"name\": \"$REPO_NAME\",
        \"description\": \"$REPO_DESCRIPTION\",
        \"private\": false,
        \"has_issues\": true,
        \"has_projects\": true,
        \"has_wiki\": true,
        \"auto_init\": false
    }")

# Check if repository was created successfully
if echo "$RESPONSE" | grep -q '"id"'; then
    echo "✅ Repository created successfully!"
    REPO_URL=$(echo "$RESPONSE" | grep -o '"html_url": "[^"]*' | cut -d'"' -f4)
    echo "🌐 Repository URL: $REPO_URL"
elif echo "$RESPONSE" | grep -q '"name already exists"'; then
    echo "⚠️  Repository already exists, continuing with push..."
    REPO_URL="https://github.com/$GITHUB_USERNAME/$REPO_NAME"
else
    echo "❌ Failed to create repository!"
    echo "Response: $RESPONSE"
    exit 1
fi

# Update README with correct GitHub username
echo ""
echo "📝 Updating README with correct GitHub username..."
sed -i.bak "s/\[USERNAME\]/$GITHUB_USERNAME/g" README.md && rm README.md.bak

# Update package.json with correct GitHub username
echo "📝 Updating package.json with correct GitHub username..."
sed -i.bak "s/\[USERNAME\]/$GITHUB_USERNAME/g" package.json && rm package.json.bak

# Commit the changes
echo "💾 Committing updated files..."
git add README.md package.json
git commit -m "Update GitHub username in README and package.json" || echo "No changes to commit"

# Push to GitHub
echo ""
echo "⬆️  Pushing to GitHub..."
if git push -u origin main 2>/dev/null; then
    echo "✅ Successfully pushed to GitHub!"
else
    echo "🔄 First push attempt failed, trying to set upstream..."
    if git push --set-upstream origin main; then
        echo "✅ Successfully pushed to GitHub!"
    else
        echo "❌ Failed to push to GitHub!"
        echo "💡 You may need to manually create the repository first at:"
        echo "   https://github.com/new"
        exit 1
    fi
fi

# Final success message
echo ""
echo "🎉 SUCCESS! Your Warp Task Tracker is now on GitHub!"
echo "🌐 Repository: $REPO_URL"
echo "📱 Clone URL: git@github.com:$GITHUB_USERNAME/$REPO_NAME.git"
echo ""
echo "🚀 Next steps:"
echo "   1. Install dependencies: npm install"
echo "   2. Test the CLI: ./bin/warp-tracker --help"
echo "   3. Start tracking: ./bin/warp-tracker start \"My first task\""
echo ""
echo "🌟 Don't forget to star your repository!"
