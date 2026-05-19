# GitHub Setup Script for Lony Invitations Platform
# PowerShell Script

Write-Host "🚀 GitHub Setup Script" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""

# Check if Git is installed
Write-Host "Checking Git installation..." -ForegroundColor Yellow
$gitVersion = git --version 2>$null
if (-not $gitVersion) {
    Write-Host "❌ Git is not installed. Please install Git first: https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Git found: $gitVersion" -ForegroundColor Green
Write-Host ""

# Check current Git status
Write-Host "Checking Git repository status..." -ForegroundColor Yellow
$gitStatus = git status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ This is not a Git repository!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Git repository found" -ForegroundColor Green
Write-Host ""

# Check for remote
Write-Host "Checking for existing GitHub remote..." -ForegroundColor Yellow
$existingRemote = git remote get-url origin 2>$null
if ($existingRemote) {
    Write-Host "⚠️  Remote 'origin' already exists: $existingRemote" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to replace it? (yes/no)"
    if ($overwrite -ne "yes") {
        Write-Host "Aborting..." -ForegroundColor Red
        exit 0
    }
    git remote remove origin
    Write-Host "✅ Removed old remote" -ForegroundColor Green
}
Write-Host ""

# Get repository URL from user
Write-Host "Please provide your GitHub repository URL" -ForegroundColor Cyan
Write-Host "Example: https://github.com/yourusername/lony-invitations-platform.git" -ForegroundColor Gray
$repoUrl = Read-Host "Repository URL"

if (-not $repoUrl) {
    Write-Host "❌ No URL provided!" -ForegroundColor Red
    exit 1
}

# Add remote
Write-Host ""
Write-Host "Adding GitHub remote..." -ForegroundColor Yellow
git remote add origin $repoUrl
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to add remote!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Remote added successfully" -ForegroundColor Green
Write-Host ""

# Ensure we're on main branch
Write-Host "Setting up main branch..." -ForegroundColor Yellow
git branch -M main
Write-Host "✅ Branch set to 'main'" -ForegroundColor Green
Write-Host ""

# Add all files
Write-Host "Staging all files..." -ForegroundColor Yellow
git add .
Write-Host "✅ Files staged" -ForegroundColor Green
Write-Host ""

# Check if there are changes to commit
$hasChanges = git diff --cached --quiet 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "ℹ️  No changes to commit. Repository is up to date." -ForegroundColor Blue
} else {
    # Commit
    Write-Host "Creating commit..." -ForegroundColor Yellow
    git commit -m "Initial commit: Lony Invitations Platform

- Premium QR Code invitation system
- WhatsApp integration for automated messaging
- Event management dashboard
- Guest check-in system
- RSVP tracking
- Supabase backend integration
- Netlify deployment configuration"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create commit!" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Commit created" -ForegroundColor Green
}
Write-Host ""

# Push to GitHub
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
Write-Host "⚠️  You may be prompted for GitHub credentials" -ForegroundColor Yellow
Write-Host ""

git push -u origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Push failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible reasons:" -ForegroundColor Yellow
    Write-Host "1. Authentication failed - Make sure you have GitHub credentials set up" -ForegroundColor Gray
    Write-Host "2. Repository doesn't exist - Create it on GitHub first" -ForegroundColor Gray
    Write-Host "3. No permission - Check repository access rights" -ForegroundColor Gray
    Write-Host ""
    Write-Host "For authentication, you may need to:" -ForegroundColor Cyan
    Write-Host "- Use a Personal Access Token instead of password" -ForegroundColor Gray
    Write-Host "- Configure GitHub CLI: https://cli.github.com/" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "✅ SUCCESS! Repository pushed to GitHub" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Visit your repository: $repoUrl" -ForegroundColor Gray
Write-Host "2. Connect to Netlify for automatic deployments" -ForegroundColor Gray
Write-Host "3. See GITHUB_SETUP.md for Netlify setup instructions" -ForegroundColor Gray
Write-Host ""
