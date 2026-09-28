// Product configuration.
module.exports = {
  APP_NAME: 'FPS Boost',
  SERVER_URL: 'https://fpsboost.ir',   // the site worker (server/)
  OFFLINE_GRACE_DAYS: 7,      // keep working this long without reaching the server (last check must have said "active")
  PING_HOSTS: ['1.1.1.1', '8.8.8.8', 'google.com'],
  // Ed25519 public key (SPKI, base64) of the server's APP_SIGN_KEY: every /api/app answer must carry a valid signature
  // over its payload (which echoes our nonce + machine id), so a fake or replayed server cannot unlock the app.
  SERVER_PUBKEY: 'MCowBQYDK2VwAyEA1d/ViohKoa82uZmqlMWyFa/YoHlQxMI7G3W35wdW3iU=',
};
