// Package config holds the product constants baked into the app.
package config

const (
	AppName          = "FPS Boost"
	ServerURL        = "https://fpsboost.ir" // the site worker (server/)
	OfflineGraceDays = 7                     // keep working this long without reaching the server (last answer must have said "active")
	// Ed25519 public key (SPKI, base64) of the server's APP_SIGN_KEY: every /api/app answer carries a signature over its
	// payload (which echoes our nonce + machine id), so a fake or replayed server cannot unlock the app.
	ServerPubKey = "MCowBQYDK2VwAyEA1d/ViohKoa82uZmqlMWyFa/YoHlQxMI7G3W35wdW3iU="
	// %APPDATA% folder — the same one the Electron versions used, so backups of original values and the login carry over.
	DataDirName = "fpsboost"
	// the installer's file name, both for the GitHub release and the self-update download
	InstallerName = "FPSBoost-Setup.exe"
)

// Version is set by the build (-ldflags "-X fpsboost.ir/app/internal/config.Version=1.0.0").
var Version = "0.0.0-dev"

// PingHosts are the default ping test targets.
var PingHosts = []string{"1.1.1.1", "8.8.8.8", "google.com"}
