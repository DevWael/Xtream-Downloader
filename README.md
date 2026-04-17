# Xtream IPTV Downloader

A sleek, modern web application for downloading movies and series from your IPTV provider via the Xtream Codes API. Built with React, Vite, and a custom proxy backend, this application provides a seamless, secure way to browse your IPTV library and save content locally for offline viewing.

## Features

- **Dynamic Authentication:** Log in securely using your provider's Server URL, Username, and Password. Credentials are saved locally to your browser (`localStorage`).
- **Movies & Series Browsing:** Automatically categorizes content, providing posters, metadata, and quick access.
- **Bulk Downloading:** Mark items and download them individually or in bulk.
- **CORS-Free Proxying:** All data and download traffic is seamlessly proxied through the local Vite server, completely bypassing browser CORS restrictions and Mixed Content issues.
- **Premium Frosted-Glass UI:** Modern, responsive design featuring glassmorphism and subtle animations.

## Tech Stack

- **Frontend:** React, React Router, Lucide React (icons)
- **Styling:** Vanilla CSS with custom design system variables
- **Build Tool / Proxy:** Vite

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/DevWael/Xtream-Downloader.git
   cd Xtream-Downloader
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173` in your browser.

## Architecture & Security

This app uses a custom Vite middleware proxy (`/api/proxy` and `/api/download`) to communicate with the IPTV provider. 
This is essential because IPTV providers rarely configure `Access-Control-Allow-Origin` for browser-based clients. By proxying requests through the Node.js backend, the app ensures smooth operation and reliable downloads without requiring CORS plugins or compromised browser security settings.

*Disclaimer: This tool is intended for personal use with legitimately acquired IPTV credentials and services.*
