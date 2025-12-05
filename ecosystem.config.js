module.exports = {
    apps: [
      {
        name: "postiz-backend",
        script: "apps/backend/dist/main.js",
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
        script: "apps/workers/dist/main.js",
        env: {
          NODE_ENV: "production",
        },
      },
      {
        name: "postiz-cron",
        script: "apps/cron/dist/main.js",
        env: {
          NODE_ENV: "production",
        },
      },
    ],
  };