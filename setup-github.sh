#!/bin/bash
# GitHub Setup Script for Lony Invitations Platform
# Bash Script (for Git Bash on Windows)

echo "🚀 GitHub Setup Script"
echo "======================"
echo ""

# Check if Git is installed
echo "Checking Git installation..."
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install Git first: https://git-scm.com/download/win"
    exit 1
fi
echo "✅ Git found: $(git --version)"
echo ""

# Check current Git status
echo "Checking Git repository status..."
if ! git status &> /dev/null; then
    echo "❌ This is not a Git repository!"
    exit 1
fi
echo "✅ Git repository found"
echo ""

# Check for remote
echo "Checking for existing GitHub remote..."
if git remote get-url origin &> /dev/null; then
    existing_remote=$(git remote get-url origin)
    echo "⚠️  Remote 'origin' already exists: $existing_remote"
    read -p "Do you want to replace it? (yes/no): " overwrite
    if [ "$overwrite" != "yes" ]; then
        echo "Aborting..."
        exit 0
    fi
    git remote remove origin
    echo "✅ Removed old remote"
fi
echo ""

# Get repository URL from user
echo "Please provide your GitHub repository URL"
echo "Example: https://github.com/yourusername/lony-invitations-platform.git"
read -p "Repository URL: " repo_url

if [ -z "$repo_url" ]; then
    echo "❌ No URL provided!"
    exit 1
fi

# Add remote
echo ""
echo "Adding GitHub remote..."
if ! git remote add origin "$repo_url"; then
    echo "❌ Failed to add remote!"
    exit 1
fi
echo "✅ Remote added successfully"
echo ""

# Ensure we're on main branch
echo "Setting up main branch..."
git branch -M main
echo "✅ Branch set to 'main'"
echo ""

# Add all files
echo "Staging all files..."
git add .
echo "✅ Files staged"
echo ""

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "ℹ️  No changes to commit. Repository is up to date."
else
    # Commit
    echo "Creating commit..."
    if ! git commit -m "Initial commit: Lony Invitations Platform

- Premium QR Code invitation system
- WhatsApp integration for automated messaging
- Event management dashboard
- Guest check-in system
- RSVP tracking
- Supabase backend integration
- Netlify deployment configuration"; then
        echo "❌ Failed to create commit!"
        exit 1
    fi
    echo "✅ Commit created"
fi
echo ""

# Push to GitHub
echo "Pushing to GitHub..."
echo "⚠️  You may be prompted for GitHub credentials"
echo ""

if ! git push -u origin main; then
    echo ""
    echo "❌ Push failed!"
    echo ""
    echo "Possible reasons:"
    echo "1. Authentication failed - Make sure you have GitHub credentials set up"
    echo "2. Repository doesn't exist - Create it on GitHub first"
    echo "3. No permission - Check repository access rights"
    echo ""
    echo "For authentication, you may need to:"
    echo "- Use a Personal Access Token instead of password"
    echo "- Configure GitHub CLI: https://cli.github.com/"
    exit 1
fi

echo ""
echo "================================"
echo "✅ SUCCESS! Repository pushed to GitHub"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Visit your repository: $repo_url"
echo "2. Connect to Netlify for automatic deployments"
echo "3. See GITHUB_SETUP.md for Netlify setup instructions"
echo ""
