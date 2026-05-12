module.exports = {
  apps: [
    {
      name: 'la-radio-bot',
      script: 'index.js',
      cwd: 'C:\\Users\\USER\\OneDrive\\Documents\\project live radio\\bot',
      watch: false,
      restart_delay: 3000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'la-radio-dashboard',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: 'C:\\Users\\USER\\OneDrive\\Documents\\project live radio\\dashboard',
      watch: false,
      restart_delay: 3000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
