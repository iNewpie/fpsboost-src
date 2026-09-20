// Product configuration — change these when the name and domain are decided.
module.exports = {
  APP_NAME: 'FPS Boost',
  SERVER_URL: 'https://fpsboost.ir',   // the site worker (server/)
  OFFLINE_GRACE_DAYS: 7,      // keep working this long without reaching the server (last check must have said "active")
  PING_HOSTS: ['1.1.1.1', '8.8.8.8', 'google.com'],
};
