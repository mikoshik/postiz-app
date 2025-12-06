module.exports = {
    apps: [
      {
        name: "postiz-backend",
        script: "apps/backend/dist/apps/backend/src/main.js",
        env: {
          NODE_ENV: "production",
          DEBUG: "app:*",
          LOG_LEVEL: "info",
        },
      },
      {
        name: "postiz-frontend",
        script: "node_modules/next/dist/bin/next",
        args: "start apps/frontend -p 4200",
        env: {
          NODE_ENV: "production",
          HOSTNAME: "0.0.0.0",
        },
      },
      {
        name: "postiz-workers",
        script: "apps/workers/dist/apps/workers/src/main.js",
        env: {
          NODE_ENV: "production",
        },
      },
      {
        name: "postiz-cron",
        script: "apps/cron/dist/apps/cron/src/main.js",
        env: {
          NODE_ENV: "production",
        },
      },
    ],
  };