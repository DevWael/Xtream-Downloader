# Xtream Downloader

A sleek, modern web application for downloading movies and series from your IPTV provider via the Xtream Codes API. Built with React, Vite, and a Node.js Express backend — deploy it with Docker and manage your media library from any browser.

## ✨ Features

### Content Management
- **Movies & Series Browsing** — Automatically categorized by genre with posters, metadata, and search
- **Media Previewing** — Watch movies and episodes in a built-in overlay video player before downloading
- **Bulk Downloading** — Mark items and download individually or in bulk with a managed download queue
- **Series Support** — Browse seasons and episodes with full metadata

### Download Manager
- **Download Queue** — Sequential download processing with real-time progress tracking
- **Size Tracking** — Live display of downloaded bytes vs total file size (e.g., "45.2 MB / 1.2 GB")
- **Pause & Resume** — Pause active downloads and resume them later
- **Status Monitoring** — Real-time stats for active, completed, and failed downloads
- **HLS Support** — Handles both direct file downloads and HLS stream downloads

### UI & Design
- **15 Color Themes** — Full-app color themes that change backgrounds, surfaces, cards, buttons, and all UI elements:

  | Theme | Vibe | Theme | Vibe |
  |-------|------|-------|------|
  | 🌊 Ocean | Cool navy blue | 🧊 Arctic | Crisp frost blue |
  | 🌲 Emerald | Deep forest green | 🪨 Carbon | Warm stone minimal |
  | 💜 Purple | Rich violet | 💎 Sapphire | Deep indigo |
  | 🌹 Rose | Dark crimson | 🧛 Dracula | Pink/magenta accents |
  | 🔥 Amber | Warm dark gold | 🌌 Aurora | Green northern lights |
  | 🌀 Cyan | Deep ocean teal | 🌙 Midnight | Icy blue-black |
  | 🪨 Slate | Neutral dark gray | ⛈️ Storm | Moody steel gray |
  | ✨ Obsidian | Black with luxury gold | | |

- **Premium Dark UI** — Glassmorphism, smooth gradients, and micro-animations
- **Responsive Design** — Works on desktop, tablet, and mobile
- **Instant Theme Switching** — Theme is applied immediately and persisted in the browser

### Configuration
- **Dynamic Authentication** — Log in with your provider's Server URL, Username, and Password
- **Download Locations** — Configure multiple save paths (maps to Docker volume mounts)
- **Persistent Settings** — Configuration saved to `/config` directory

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router, TypeScript |
| Icons | Lucide React |
| Styling | Vanilla CSS with CSS custom properties (15 theme system) |
| Build | Vite |
| Backend | Node.js, Express |
| Deployment | Docker, Docker Compose |

## 🚀 Getting Started

### Docker (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/DevWael/Xtream-Downloader.git
   cd Xtream-Downloader
   ```

2. Edit `docker-compose.yml` with your IPTV credentials and media paths:
   ```yaml
   environment:
     - XTREAM_URL=http://your-iptv-provider.com:port
     - XTREAM_USERNAME=your_username
     - XTREAM_PASSWORD=your_password
   volumes:
     - ./config:/config
     - /path/to/movies:/movies
     - /path/to/series:/series
   ```

3. Start the container:
   ```bash
   docker compose up -d
   ```

4. Open `http://localhost:8945` in your browser.

5. Go to **Settings** and add your download locations (e.g., `/movies`, `/series`) — these should match the volume mount paths inside the container.

### Local Development

#### Prerequisites
- Node.js v18+
- npm

#### Setup

1. Clone and install:
   ```bash
   git clone https://github.com/DevWael/Xtream-Downloader.git
   cd Xtream-Downloader
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open `http://localhost:5173` in your browser.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                    Browser                       │
│  React App ──── Theme System (15 CSS themes)     │
│       │                                          │
│  localStorage (credentials, theme, settings)     │
└─────────┬───────────────────────────────────────┘
          │ HTTP
┌─────────▼───────────────────────────────────────┐
│              Express Server (server.js)           │
│                                                   │
│  /api/proxy/*     → Forward requests to IPTV API  │
│  /api/download    → Stream file downloads         │
│  /api/queue       → Download queue management     │
│  /api/settings    → Persistent configuration      │
│  /api/queue/:id   → Pause/resume downloads        │
│                                                   │
│  Static files ← dist/ (Vite build)                │
└─────────┬───────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────┐
│           Xtream Codes IPTV Provider              │
│                                                   │
│  /player_api.php  → Categories, metadata, EPG     │
│  /movie/...       → Direct file streams           │
│  /series/...      → Episode streams               │
└───────────────────────────────────────────────────┘
```

The Express backend acts as a proxy to bypass browser CORS restrictions. IPTV providers rarely configure `Access-Control-Allow-Origin` for browser clients, so all API and download traffic is routed through the Node.js server.

## 📁 Project Structure

```
├── src/
│   ├── components/       # Reusable UI components (Layout, MediaCard, VideoPlayer, etc.)
│   ├── pages/            # Page components (Home, Movies, Series, Downloads, Settings)
│   ├── services/         # API service layer
│   ├── hooks/            # Custom React hooks (useAuth)
│   ├── utils/            # Utility functions (toast notifications)
│   ├── index.css         # Design system & 15 color themes
│   ├── App.tsx           # Router setup
│   └── main.tsx          # Entry point (theme initialization)
├── server.js             # Express backend (proxy, downloads, queue)
├── Dockerfile            # Multi-stage Docker build
├── docker-compose.yml    # Docker Compose configuration
└── package.json
```

## ⚠️ Disclaimer

This tool is intended for personal use with legitimately acquired IPTV credentials and services.
