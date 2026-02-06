# Deploy to Netlify Guide

If you want to deploy the frontend to Netlify:

## 1. Prerequisites
- A GitHub account.
- A Netlify account.

## 2. Push to GitHub
- Create a new repository on GitHub.
- Push your code:
  ```bash
  git init
  git add .
  git commit -m "Initial commit"
  git branch -M main
  git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
  git push -u origin main
  ```

## 3. Deploy on Netlify
- Go to [Netlify](https://app.netlify.com/).
- Click "Add new site" -> "Import an existing project".
- Select GitHub.
- Pick your repository.
- Netlify will detect the settings automatically (Build command: `npm run build`, Publish directory: `dist`).
- Click **Deploy**.

---

## IMPORTANT NOTE about the Backend (WhatsApp Server)

Netlify is great for the **Frontend** (the website part), but it **CANNOT** host the long-running WhatsApp server or the Evolution API (Docker).

To make the WhatsApp bot work online 24/7, you need a different service for the backend. We recommend **Railway** or **Render**.

### Recommended: Deploy Everything on Railway
1. Go to [Railway.app](https://railway.app/).
2. Connect your GitHub repository.
3. Railway will detect the `Dockerfile` we just created.
4. Deploy it as a service.
5. You will also need to add a PostgreSQL database and Redis (for Evolution API) on Railway.

---

### If you stick with Netlify for Frontend:
- Your frontend will be online at `https://your-site.netlify.app`.
- BUT it will try to connect to `http://localhost:3001` for the backend, which **WON'T WORK** for other users (only for you if you run the local server).

**Solution:** You must deploy the Backend (using the Dockerfile) to a cloud provider like Railway/Render/DigitalOcean and update the `VITE_API_URL` in your frontend configuration.
