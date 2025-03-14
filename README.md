# Facebook Ad Success Explorer

A web platform for discovering and analyzing successful Facebook ads based on performance metrics.

## Setting Up With GitHub Codespaces

### 1. Create Codespace from Repository

1. Go to the repository on GitHub
2. Click on the "Code" button
3. Select the "Codespaces" tab
4. Click "Create codespace on main"

GitHub will create and launch a new Codespace with all the necessary development environment setup.

### 2. Configure Environment Variables

Create a `.env` file in the server directory with the following variables:

```
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://admin:password@mongodb:27017/ad_explorer?authSource=admin
REDIS_URL=redis://default:password@redis:6379
FB_API_VERSION=v18.0
FB_ACCESS_TOKEN=your_facebook_access_token
```

Replace `your_facebook_access_token` with a valid Facebook API token with permissions to access the Ad Library API.

### 3. Install Dependencies

Run the following command to install all dependencies for both the client and server:

```bash
npm run install-all
```

### 4. Start the Application

For development with hot reloading:

```bash
npm run dev
```

For regular start:

```bash
npm start
```

## Running with Docker

1. Make sure Docker and Docker Compose are installed on your system
2. Update the FB_ACCESS_TOKEN in docker-compose.yml
3. Run the following command:

```bash
docker-compose up
```

## Project Structure

- `/client` - React frontend application
- `/server` - Node.js backend server
  - `/adapters` - External API adapters
  - `/controllers` - Request handlers
  - `/models` - MongoDB data models
  - `/routes` - API route definitions
  - `/services` - Business logic
  - `/utils` - Helper utilities

## Features

- Search Facebook ads using keywords and filters
- Analyze ad performance with success scoring algorithm
- View detailed metrics on individual ads
- Discover patterns in successful ads
- Visualize ad performance data with charts and graphs
