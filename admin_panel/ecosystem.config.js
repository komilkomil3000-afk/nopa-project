module.exports = {
  apps: [
    {
      name: 'nopa-backend',
      script: './dist/server.js',
      // One process: rate-limit / SMS-cooldown state and chat socket rooms are in memory and not shared
      // between workers. More instances would need sticky sessions and a Socket.IO adapter (e.g. Redis).
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
