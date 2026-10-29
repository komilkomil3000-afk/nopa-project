module.exports = {
  apps: [
    {
      name: 'nopa-backend',
      script: './dist/server.js',
      // One process: rate-limit / SMS-cooldown state is in memory and not shared between workers
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
