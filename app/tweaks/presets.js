// Game presets: a named bundle of tweak ids (all from manifest.js) plus a couple of tips the app shows on the card.
// "Optimize" applies every tweak of the bundle that is not applied yet; the card is "optimized" when all of them are.
const T = (en, fa) => ({ en, fa });
const BASE = ['game_dvr_off', 'game_bar_off', 'game_mode_on', 'mm_games_priority', 'power_plan_high'];
const NET = ['nagle_off', 'network_throttling_off', 'tcp_tuning'];
module.exports = [
  { id: 'val', name: 'Valorant', icon: 'val.webp', tweaks: [...BASE, 'fse_off', 'mouse_accel_off', 'background_apps_off', ...NET],
    tips: [T('In-game: Multithreaded Rendering ON, Material/Texture Quality Low, VSync OFF, Limit FPS Always OFF.', 'داخل بازی: Multithreaded Rendering روشن، Material/Texture روی Low، VSync خاموش، Limit FPS خاموش.'),
           T('Raw Input Buffer ON (Settings → General) for the lowest mouse latency.', 'Raw Input Buffer روشن (Settings → General) برای کمترین تأخیر ماوس.')] },
  { id: 'cs2', name: 'Counter-Strike 2', icon: 'cs2.webp', tweaks: [...BASE, 'fse_off', 'mouse_accel_off', ...NET],
    tips: [T('Steam launch options: -high -novid -nojoy', 'گزینه‌های اجرا در استیم: -high -novid -nojoy'), T('NVIDIA Reflex: Enabled + Boost; Shader Detail Low; MSAA 2x or off.', 'NVIDIA Reflex روی Enabled + Boost؛ Shader Detail روی Low؛ MSAA روی 2x یا خاموش.')] },
  { id: 'mc', name: 'Minecraft', icon: 'mc.webp', tweaks: [...BASE, 'background_apps_off', 'nagle_off', 'dns_fast'],
    tips: [T('Give Java 4–6 GB in the launcher (-Xmx4G … -Xmx6G), never all your RAM.', 'در لانچر به جاوا ۴ تا ۶ گیگ بدهید (-Xmx4G تا -Xmx6G)، هیچ‌وقت همهٔ رم را نه.'), T('Sodium + Lithium (Fabric) or Lunar/Badlion give the biggest FPS jump on weak PCs.', 'Sodium + Lithium (Fabric) یا لانار/بدلاین بیشترین جهش FPS را روی سیستم ضعیف می‌دهند.')] },
  { id: 'fn', name: 'Fortnite', icon: 'fn.webp', tweaks: [...BASE, 'fse_off', 'background_apps_off', 'network_throttling_off', 'qos_reserve_off', 'nagle_off'],
    tips: [T('Rendering Mode: Performance (low-end) or DirectX 12; Textures Low; disable Nanite / Lumen.', 'Rendering Mode روی Performance (سیستم ضعیف) یا DirectX 12؛ Textures روی Low؛ Nanite / Lumen خاموش.')] },
  { id: 'apex', name: 'Apex Legends', icon: 'apex.webp', tweaks: [...BASE, 'fse_off', ...NET],
    tips: [T('Launch options: +fps_max unlimited -novid -high; Texture Streaming Budget one step below your VRAM.', 'گزینه‌های اجرا: +fps_max unlimited -novid -high؛ Texture Streaming Budget یک پله زیر VRAM.')] },
  { id: 'wz', name: 'Call of Duty: Warzone', icon: 'wz.svg', tweaks: [...BASE, 'fse_off', 'background_apps_off', ...NET],
    tips: [T('On-Demand Texture Streaming OFF; Shader preload done before ranked matches.', 'On-Demand Texture Streaming خاموش؛ پیش‌بارگذاری شیدرها قبل از رنکد.')] },
  { id: 'rbx', name: 'Roblox', icon: 'rbx.webp', tweaks: [...BASE, 'background_apps_off', 'nagle_off', 'dns_fast'],
    tips: [T('Graphics Mode Manual, quality 3–5; Bloatless FPS unlockers are not needed — Roblox allows up to 240 FPS in settings now.', 'Graphics Mode روی Manual، کیفیت ۳ تا ۵؛ آنلاکر FPS لازم نیست — روبلاکس تا ۲۴۰ FPS در تنظیمات دارد.')] },
  { id: 'gta', name: 'GTA V', icon: 'gta.webp', tweaks: [...BASE, 'fse_off', 'background_apps_off'],
    tips: [T('Extended Distance Scaling and Grass are the two biggest FPS killers — keep both low.', 'Extended Distance Scaling و Grass دو FPS‌کش اصلی هستند — هر دو را پایین نگه دارید.')] },
  { id: 'lol', name: 'League of Legends', icon: 'lol.webp', tweaks: [...BASE, 'mouse_accel_off', 'nagle_off', 'network_throttling_off'],
    tips: [T('Character Inking OFF, Shadows OFF, Anti-aliasing OFF — the client is CPU-bound on old PCs.', 'Character Inking خاموش، Shadows خاموش، Anti-aliasing خاموش — کلاینت روی سیستم قدیمی به CPU وابسته است.')] },
  { id: 'rivals', name: 'Marvel Rivals', icon: 'rivals.webp', tweaks: [...BASE, 'fse_off', 'background_apps_off', 'network_throttling_off', 'nagle_off'],
    tips: [T('Turn off Lumen global illumination and reflections; Model Detail Low — UE5 is heavy on weak GPUs.', 'Lumen و انعکاس‌ها خاموش؛ Model Detail روی Low — آنریل ۵ برای GPU ضعیف سنگین است.')] },
];
