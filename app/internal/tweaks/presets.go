package tweaks

import . "fpsboost.ir/app/internal/engine"

// Preset is a game: a bundle of tweak ids plus in-game tips. "Optimize" applies every tweak of the bundle that is not
// applied yet; the card is "optimized" when all of them are. Exe names let the background Guard recognise the game.
type Preset struct {
	ID     string   `json:"id"`
	Name   string   `json:"name"`
	Icon   string   `json:"icon"`
	Tweaks []string `json:"tweaks"`
	Tips   []Text   `json:"tips"`
	Exes   []string `json:"-"`
}

var base = []string{"game_dvr_off", "game_bar_off", "game_mode_on", "mm_games_priority", "power_plan_high", "sticky_keys_off"}
var net = []string{"nagle_off", "network_throttling_off", "tcp_tuning"}

func join(parts ...[]string) []string {
	var out []string
	for _, p := range parts {
		out = append(out, p...)
	}
	return out
}

var Presets = []Preset{
	{ID: "val", Name: "Valorant", Icon: "val.webp", Tweaks: join(base, []string{"fse_off", "mouse_accel_off", "background_apps_off"}, net),
		Tips: []Text{T("In-game: Multithreaded Rendering ON, Material/Texture Quality Low, VSync OFF, Limit FPS Always OFF.", "داخل بازی: Multithreaded Rendering روشن، Material/Texture روی Low، VSync خاموش، Limit FPS خاموش."),
			T("Raw Input Buffer ON (Settings → General) for the lowest mouse latency.", "Raw Input Buffer روشن (Settings → General) برای کمترین تأخیر ماوس.")},
		Exes: []string{"VALORANT-Win64-Shipping.exe"}},
	{ID: "val_freeze", Name: "Valorant · freeze fix (low-end PC)", Icon: "val.webp", Tweaks: []string{"game_dvr_off", "game_bar_off", "fse_off", "background_apps_off", "power_plan_high", "mm_games_priority", "hags_off", "mpo_off", "pagefile_fixed", "sysmain_off"},
		Tips: []Text{T("For the multi-second screen freezes since the Unreal Engine 5 update: this bundle turns HAGS and MPO off, fixes the page file and stops SysMain thrashing the disk. Restart Windows afterwards — three of them only take effect then.", "برای فریزهای چندثانیه‌ای بعد از آپدیت آنریل ۵: این بسته HAGS و MPO را خاموش می‌کند، فایل صفحه‌بندی را ثابت می‌کند و جلوی فشار SysMain به دیسک را می‌گیرد. بعدش ویندوز را ریستارت کنید — سه تای آن‌ها فقط بعد از ریستارت اثر می‌کنند."),
			T("Then run Tools → Clear shader caches once: a damaged DirectX/NVIDIA shader cache freezes the game at the same spot every time; Valorant rebuilds it on the next start.", "بعد یک بار Tools → پاک کردن کش شیدرها را بزنید: کش شیدر خراب، بازی را هر بار در همان نقطه فریز می‌کند؛ والورانت دفعهٔ بعد دوباره می‌سازد."),
			T("In-game: Fullscreen (not Borderless), VSync OFF, Material/Texture/Detail Low, Anti-aliasing None, Vignette/Bloom/Distortion OFF; Multithreaded Rendering ON (OFF only on 2-core CPUs); cap Limit FPS Always a little above your monitor's refresh rate.", "داخل بازی: Fullscreen (نه Borderless)، VSync خاموش، Material/Texture/Detail روی Low، Anti-aliasing روی None، Vignette/Bloom/Distortion خاموش؛ Multithreaded Rendering روشن (فقط روی CPU دو هسته‌ای خاموش)؛ Limit FPS Always را کمی بالاتر از رفرش‌ریت مانیتور بگذارید."),
			T("Restart (not Shut down) after driver or Vanguard updates — Fast Startup keeps the old Vanguard driver loaded, a common cause of freezes on the loading screen.", "بعد از آپدیت درایور یا Vanguard، Restart بزنید نه Shut down — Fast Startup درایور قدیمی Vanguard را نگه می‌دارد، دلیل رایج فریز در صفحهٔ لودینگ."),
			T("8 GB RAM or an HDD? Keep Discord and the browser closed while playing; the game alone needs about 6 GB since the engine update.", "رم ۸ گیگ یا هارد HDD دارید؟ دیسکورد و مرورگر را هنگام بازی ببندید؛ خود بازی بعد از آپدیت موتور حدود ۶ گیگ می‌خواهد.")},
		Exes: []string{"VALORANT-Win64-Shipping.exe"}},
	{ID: "cs2", Name: "Counter-Strike 2", Icon: "cs2.webp", Tweaks: join(base, []string{"fse_off", "mouse_accel_off"}, net),
		Tips: []Text{T("Steam launch options: -high -novid -nojoy", "گزینه‌های اجرا در استیم: -high -novid -nojoy"), T("NVIDIA Reflex: Enabled + Boost; Shader Detail Low; MSAA 2x or off.", "NVIDIA Reflex روی Enabled + Boost؛ Shader Detail روی Low؛ MSAA روی 2x یا خاموش.")},
		Exes: []string{"cs2.exe"}},
	{ID: "mc", Name: "Minecraft", Icon: "mc.webp", Tweaks: join(base, []string{"background_apps_off", "nagle_off", "dns_fast"}),
		Tips: []Text{T("Give Java 4–6 GB in the launcher (-Xmx4G … -Xmx6G), never all your RAM.", "در لانچر به جاوا ۴ تا ۶ گیگ بدهید (-Xmx4G تا -Xmx6G)، هیچ‌وقت همهٔ رم را نه."), T("Sodium + Lithium (Fabric) or Lunar/Badlion give the biggest FPS jump on weak PCs.", "Sodium + Lithium (Fabric) یا لانار/بدلاین بیشترین جهش FPS را روی سیستم ضعیف می‌دهند.")},
		Exes: []string{"javaw.exe", "java.exe", "Minecraft.Windows.exe", "LunarClient.exe", "Badlion Client.exe"}},
	{ID: "fn", Name: "Fortnite", Icon: "fn.webp", Tweaks: join(base, []string{"fse_off", "background_apps_off", "network_throttling_off", "qos_reserve_off", "nagle_off"}),
		Tips: []Text{T("Rendering Mode: Performance (low-end) or DirectX 12; Textures Low; disable Nanite / Lumen.", "Rendering Mode روی Performance (سیستم ضعیف) یا DirectX 12؛ Textures روی Low؛ Nanite / Lumen خاموش.")},
		Exes: []string{"FortniteClient-Win64-Shipping.exe"}},
	{ID: "apex", Name: "Apex Legends", Icon: "apex.webp", Tweaks: join(base, []string{"fse_off"}, net),
		Tips: []Text{T("Launch options: +fps_max unlimited -novid -high; Texture Streaming Budget one step below your VRAM.", "گزینه‌های اجرا: +fps_max unlimited -novid -high؛ Texture Streaming Budget یک پله زیر VRAM.")},
		Exes: []string{"r5apex.exe", "r5apex_dx12.exe"}},
	{ID: "wz", Name: "Call of Duty: Warzone", Icon: "wz.svg", Tweaks: join(base, []string{"fse_off", "background_apps_off"}, net),
		Tips: []Text{T("On-Demand Texture Streaming OFF; Shader preload done before ranked matches.", "On-Demand Texture Streaming خاموش؛ پیش‌بارگذاری شیدرها قبل از رنکد.")},
		Exes: []string{"cod.exe", "ModernWarfare.exe"}},
	{ID: "rbx", Name: "Roblox", Icon: "rbx.webp", Tweaks: join(base, []string{"background_apps_off", "nagle_off", "dns_fast"}),
		Tips: []Text{T("Graphics Mode Manual, quality 3–5; FPS unlockers are not needed — Roblox allows up to 240 FPS in settings now.", "Graphics Mode روی Manual، کیفیت ۳ تا ۵؛ آنلاکر FPS لازم نیست — روبلاکس تا ۲۴۰ FPS در تنظیمات دارد.")},
		Exes: []string{"RobloxPlayerBeta.exe", "Windows10Universal.exe"}},
	{ID: "gta", Name: "GTA V", Icon: "gta.webp", Tweaks: join(base, []string{"fse_off", "background_apps_off"}),
		Tips: []Text{T("Extended Distance Scaling and Grass are the two biggest FPS killers — keep both low.", "Extended Distance Scaling و Grass دو FPS‌کش اصلی هستند — هر دو را پایین نگه دارید.")},
		Exes: []string{"GTA5.exe", "GTA5_Enhanced.exe"}},
	{ID: "lol", Name: "League of Legends", Icon: "lol.webp", Tweaks: join(base, []string{"mouse_accel_off", "nagle_off", "network_throttling_off"}),
		Tips: []Text{T("Character Inking OFF, Shadows OFF, Anti-aliasing OFF — the client is CPU-bound on old PCs.", "Character Inking خاموش، Shadows خاموش، Anti-aliasing خاموش — کلاینت روی سیستم قدیمی به CPU وابسته است.")},
		Exes: []string{"League of Legends.exe"}},
	{ID: "rivals", Name: "Marvel Rivals", Icon: "rivals.webp", Tweaks: join(base, []string{"fse_off", "background_apps_off", "network_throttling_off", "nagle_off"}),
		Tips: []Text{T("Turn off Lumen global illumination and reflections; Model Detail Low — UE5 is heavy on weak GPUs.", "Lumen و انعکاس‌ها خاموش؛ Model Detail روی Low — آنریل ۵ برای GPU ضعیف سنگین است.")},
		Exes: []string{"Marvel-Win64-Shipping.exe"}},
}

// GameExes: every exe the Guard treats as a game — the presets' plus other popular titles.
var GameExes = func() map[string]string {
	m := map[string]string{}
	for _, p := range Presets {
		for _, e := range p.Exes {
			if _, seen := m[lower(e)]; !seen { // the first preset names the game (the Valorant freeze bundle shares its exe)
				m[lower(e)] = p.Name
			}
		}
	}
	for name, exes := range map[string][]string{
		"PUBG":                  {"TslGame.exe"},
		"Dota 2":                {"dota2.exe"},
		"Rainbow Six Siege":     {"RainbowSix.exe", "RainbowSix_DX11.exe", "RainbowSix_Vulkan.exe"},
		"Overwatch 2":           {"Overwatch.exe"},
		"Rust":                  {"RustClient.exe"},
		"Rocket League":         {"RocketLeague.exe"},
		"Escape from Tarkov":    {"EscapeFromTarkov.exe"},
		"The Finals":            {"Discovery.exe"},
		"Battlefield":           {"bf.exe", "bf2042.exe", "bfv.exe", "bf1.exe"},
		"Elden Ring":            {"eldenring.exe"},
		"Cyberpunk 2077":        {"Cyberpunk2077.exe"},
		"Hogwarts Legacy":       {"HogwartsLegacy.exe"},
		"Red Dead Redemption 2": {"RDR2.exe"},
		"Genshin Impact":        {"GenshinImpact.exe"},
		"Zenless Zone Zero":     {"ZenlessZoneZero.exe"},
		"Black Ops 6":           {"cod24-cod.exe"},
		"Deadlock":              {"deadlock.exe", "project8.exe"},
		"Palworld":              {"Palworld-Win64-Shipping.exe"},
		"Terraria":              {"Terraria.exe"},
		"FC 25":                 {"FC25.exe", "FC24.exe", "FC26.exe"},
		"PES / eFootball":       {"eFootball.exe"},
		"Forza Horizon 5":       {"ForzaHorizon5.exe"},
		"Assetto Corsa":         {"acs.exe", "AssettoCorsaCompetizione.exe"},
		"Hunt: Showdown":        {"HuntGame.exe"},
		"Dead by Daylight":      {"DeadByDaylight-Win64-Shipping.exe"},
		"Among Us":              {"Among Us.exe"},
		"Fall Guys":             {"FallGuys_client_game.exe"},
		"Sea of Thieves":        {"SoTGame.exe"},
		"Helldivers 2":          {"helldivers2.exe"},
		"Monster Hunter Wilds":  {"MonsterHunterWilds.exe"},
		"Satisfactory":          {"FactoryGame-Win64-Shipping.exe"},
		"ARK":                   {"ShooterGame.exe", "ArkAscended.exe"},
		"World of Warcraft":     {"Wow.exe"},
		"Diablo IV":             {"Diablo IV.exe"},
		"Path of Exile 2":       {"PathOfExile.exe", "PathOfExileSteam.exe"},
		"Naraka":                {"NarakaBladepoint.exe"},
		"War Thunder":           {"aces.exe"},
		"World of Tanks":        {"WorldOfTanks.exe"},
		"Starfield":             {"Starfield.exe"},
		"Stalker 2":             {"Stalker2-Win64-Shipping.exe"},
	} {
		for _, e := range exes {
			m[lower(e)] = name
		}
	}
	return m
}()

func lower(s string) string {
	b := []byte(s)
	for i, c := range b {
		if c >= 'A' && c <= 'Z' {
			b[i] = c + 32
		}
	}
	return string(b)
}

// PresetByID finds a preset.
func PresetByID(id string) *Preset {
	for i := range Presets {
		if Presets[i].ID == id {
			return &Presets[i]
		}
	}
	return nil
}
