// Product configuration — change these when the name and domain are decided.
module.exports = {
  APP_NAME: 'Optimizer',
  SERVER_URL: 'https://optimizer-site.YOUR-SUBDOMAIN.workers.dev',   // the site worker (server/), later https://your-domain
  OFFLINE_GRACE_DAYS: 7,      // keep working this long without reaching the server (last check must have said "active")
  PING_HOSTS: ['1.1.1.1', '8.8.8.8', 'google.com'],
};
