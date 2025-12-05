module.exports = {
    apps: [
      {
        name: "postiz-backend",
        script: "dist/apps/backend/main.js",
        env: {
          NODE_ENV: "production",
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
        script: "dist/apps/workers/main.js",
        env: {
          NODE_ENV: "production",
        },
      },
      {
        name: "postiz-cron",
        script: "dist/apps/cron/main.js",
        env: {
          NODE_ENV: "production",
        },
      },
    ],
  };