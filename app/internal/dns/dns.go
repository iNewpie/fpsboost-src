// Package dns is the resolver list (Iranian ISP / anti-sanction / gaming resolvers plus the public ones DNS Jumper
// ships with), a fast concurrent benchmark of them, ISP detection and the "auto" choice: the user's own ISP resolver
// when it answers (Shatel, TCI …), otherwise the fastest public one that answered.
package dns

import (
	"context"
	"net"
	"sort"
	"strings"
	"sync"
	"time"

	"fpsboost.ir/app/internal/engine"
)

// Group of a provider: isp (bound to one Iranian ISP), iran (anti-sanction / gaming resolvers inside Iran), global,
// family (adult filter), secure (malware filter).
const (
	GroupISP    = "isp"
	GroupIran   = "iran"
	GroupGlobal = "global"
	GroupFamily = "family"
	GroupSecure = "secure"
)

// Provider is one resolver pair.
type Provider struct {
	ID      string   `json:"id"`
	Label   string   `json:"label"`
	Servers []string `json:"servers"`
	Group   string   `json:"group"`
	ISP     string   `json:"isp,omitempty"` // GroupISP: the ISP id this resolver belongs to
}

// Auto is the option id for "best for my network".
const Auto = "auto"

// Providers in display order. The Iranian ISP resolvers and the anti-sanction ones first, then the DNS Jumper default
// list (v2.2 DnsJumper.ini, defunct Norton ConnectSafe entries dropped), then its Family and Secure lists.
var Providers = []Provider{
	// ISP resolvers — only answer (fast) from inside that ISP
	{"shatel", "Shatel (شاتل — ISP)", []string{"85.15.1.14", "85.15.1.15"}, GroupISP, "shatel"},
	{"tci", "TCI / Mokhabrat (مخابرات — ISP)", []string{"217.218.127.127", "217.218.155.155"}, GroupISP, "tci"},
	{"pishgaman", "Pishgaman (پیشگامان — ISP)", []string{"5.202.100.100", "5.202.100.101"}, GroupISP, "pishgaman"},
	// Iranian public resolvers
	{"shecan", "Shecan (شکن — anti-sanction)", []string{"178.22.122.100", "185.51.200.2"}, GroupIran, ""},
	{"electro", "Electro (الکترو — anti-sanction)", []string{"78.157.42.100", "78.157.42.101"}, GroupIran, ""},
	{"begzar", "Begzar (بگذر — anti-sanction)", []string{"185.55.226.26", "185.55.225.25"}, GroupIran, ""},
	{"radar", "Radar Game (رادار — gaming)", []string{"10.202.10.10", "10.202.10.11"}, GroupIran, ""},
	{"403", "403.online (anti-sanction)", []string{"10.202.10.202", "10.202.10.102"}, GroupIran, ""},
	{"shelter", "Shelter (شلتر — anti-sanction)", []string{"94.103.125.157", "94.103.125.158"}, GroupIran, ""},
	{"hostiran", "HostIran (هاست‌ایران — anti-sanction)", []string{"172.29.0.100", "172.29.2.100"}, GroupIran, ""},
	// DNS Jumper — default list
	{"cloudflare", "Cloudflare 1.1.1.1", []string{"1.1.1.1", "1.0.0.1"}, GroupGlobal, ""},
	{"google", "Google 8.8.8.8", []string{"8.8.8.8", "8.8.4.4"}, GroupGlobal, ""},
	{"quad9", "Quad9 Security", []string{"9.9.9.9", "149.112.112.112"}, GroupGlobal, ""},
	{"quad9_nosec", "Quad9 No Security", []string{"9.9.9.10", "149.112.112.10"}, GroupGlobal, ""},
	{"opendns", "OpenDNS", []string{"208.67.222.222", "208.67.220.220"}, GroupGlobal, ""},
	{"opendns2", "OpenDNS 2", []string{"208.67.222.220", "208.67.220.222"}, GroupGlobal, ""},
	{"yandex", "Yandex", []string{"77.88.8.1", "77.88.8.8"}, GroupGlobal, ""},
	{"level3a", "Level 3 A", []string{"209.244.0.3", "209.244.0.4"}, GroupGlobal, ""},
	{"level3b", "Level 3 B (4.2.2.1)", []string{"4.2.2.1", "4.2.2.2"}, GroupGlobal, ""},
	{"level3c", "Level 3 C (4.2.2.3)", []string{"4.2.2.3", "4.2.2.4"}, GroupGlobal, ""},
	{"level3d", "Level 3 D (4.2.2.5)", []string{"4.2.2.5", "4.2.2.6"}, GroupGlobal, ""},
	{"comodo", "Comodo Secure", []string{"8.26.56.26", "8.20.247.20"}, GroupGlobal, ""},
	{"dyn", "Dyn", []string{"216.146.35.35", "216.146.36.36"}, GroupGlobal, ""},
	{"verisign", "VeriSign Public DNS", []string{"64.6.64.6", "64.6.65.6"}, GroupGlobal, ""},
	{"qwest", "Qwest", []string{"205.171.3.65", "205.171.2.65"}, GroupGlobal, ""},
	{"sprint", "Sprint", []string{"204.97.212.10", "204.117.214.10"}, GroupGlobal, ""},
	{"censurfridns", "Censurfridns (DK)", []string{"89.233.43.71", "91.239.100.100"}, GroupGlobal, ""},
	{"safedns", "SafeDNS (RU)", []string{"195.46.39.39", "195.46.39.40"}, GroupGlobal, ""},
	{"dnswatch", "DNS.WATCH (DE)", []string{"84.200.69.80", "84.200.70.40"}, GroupGlobal, ""},
	{"freedns", "FreeDNS (AT)", []string{"37.235.1.174", "37.235.1.177"}, GroupGlobal, ""},
	{"sprintlink", "Sprintlink", []string{"199.2.252.10", "204.97.212.10"}, GroupGlobal, ""},
	{"ultradns", "UltraDNS", []string{"204.69.234.1", "204.74.101.1"}, GroupGlobal, ""},
	{"zen", "Zen Internet (GB)", []string{"212.23.8.1", "212.23.3.1"}, GroupGlobal, ""},
	{"orange", "Orange DNS (GB)", []string{"195.92.195.94", "195.92.195.95"}, GroupGlobal, ""},
	{"he", "Hurricane Electric", []string{"74.82.42.42"}, GroupGlobal, ""},
	{"puntcat", "puntCAT (ES)", []string{"109.69.8.51"}, GroupGlobal, ""},
	{"freenom", "Freenom World (NL)", []string{"80.80.80.80", "80.80.81.81"}, GroupGlobal, ""},
	{"fdn", "FDN (FR)", []string{"80.67.169.12", "80.67.169.40"}, GroupGlobal, ""},
	{"neustar1", "Neustar 1", []string{"156.154.70.1", "156.154.71.1"}, GroupGlobal, ""},
	{"neustar2", "Neustar 2", []string{"156.154.70.5", "156.154.71.5"}, GroupGlobal, ""},
	{"adguard", "AdGuard", []string{"94.140.14.14", "94.140.15.15"}, GroupGlobal, ""},
	{"megalan", "MegaLan (BG)", []string{"95.111.55.251", "95.111.55.250"}, GroupGlobal, ""},
	// DNS Jumper — family list
	{"opendns_family", "OpenDNS Family", []string{"208.67.222.123", "208.67.220.123"}, GroupFamily, ""},
	{"yandex_family", "Yandex Family", []string{"77.88.8.7", "77.88.8.3"}, GroupFamily, ""},
	{"cloudflare_family", "Cloudflare Malware + Adult Blocking", []string{"1.1.1.3", "1.0.0.3"}, GroupFamily, ""},
	{"cleanbrowsing_family", "CleanBrowsing Family", []string{"185.228.168.168", "185.228.169.168"}, GroupFamily, ""},
	{"cleanbrowsing_adult", "CleanBrowsing Adult Filter", []string{"185.228.168.10", "185.228.169.11"}, GroupFamily, ""},
	{"neustar_family", "Neustar Family Secure", []string{"156.154.70.3", "156.154.71.3"}, GroupFamily, ""},
	{"neustar_business", "Neustar Business Secure", []string{"156.154.70.4", "156.154.71.4"}, GroupFamily, ""},
	{"adguard_family", "AdGuard Family", []string{"94.140.14.15", "94.140.15.16"}, GroupFamily, ""},
	// DNS Jumper — secure list
	{"yandex_safe", "Yandex Safe", []string{"77.88.8.88", "77.88.8.2"}, GroupSecure, ""},
	{"cloudflare_malware", "Cloudflare Malware Blocking", []string{"1.1.1.2", "1.0.0.2"}, GroupSecure, ""},
	{"cleanbrowsing_secure", "CleanBrowsing Secure", []string{"185.228.168.9", "185.228.169.9"}, GroupSecure, ""},
	{"neustar_threat", "Neustar Threat Protection", []string{"156.154.70.2", "156.154.71.2"}, GroupSecure, ""},
}

// Find a provider by id (nil when unknown).
func Find(id string) *Provider {
	for i := range Providers {
		if Providers[i].ID == id {
			return &Providers[i]
		}
	}
	return nil
}

// ForISP is the ISP's own resolver (nil when we have none for it).
func ForISP(isp string) *Provider {
	if isp == "" {
		return nil
	}
	for i := range Providers {
		if Providers[i].Group == GroupISP && Providers[i].ISP == isp {
			return &Providers[i]
		}
	}
	return nil
}

// IDs in display order.
func IDs() []string {
	out := make([]string, 0, len(Providers)+1)
	for _, p := range Providers {
		out = append(out, p.ID)
	}
	return out
}

/* ---- ISP detection ---- */

// ISPNames: id → label.
var ISPNames = map[string]string{"shatel": "Shatel", "tci": "TCI (Mokhabrat)", "pishgaman": "Pishgaman", "irancell": "Irancell", "mci": "MCI (Hamrah-e Aval)", "rightel": "Rightel", "asiatech": "Asiatech", "parsonline": "ParsOnline", "mobinnet": "MobinNet", "hiweb": "HiWeb", "respina": "Respina", "afranet": "Afranet"}

// aSNs of Iranian ISPs (BGP) — what the site worker reports from Cloudflare's request.cf.asn.
var asnISP = map[int]string{
	31549: "shatel",
	58224: "tci", 12880: "tci", 48159: "tci", // TCI, DCI backbone, TIC
	39501:  "pishgaman",
	44244:  "irancell",
	197207: "mci",
	57218:  "rightel",
	43754:  "asiatech",
	16322:  "parsonline",
	50810:  "mobinnet",
	56402:  "hiweb",
	42337:  "respina",
	25184:  "afranet",
}

// ISPFromASN maps an autonomous system number to an ISP id ("" when unknown).
func ISPFromASN(asn int) string { return asnISP[asn] }

// ISPFromOrg guesses from Cloudflare's asOrganization text.
func ISPFromOrg(org string) string {
	o := strings.ToLower(org)
	switch {
	case strings.Contains(o, "shatel"):
		return "shatel"
	case strings.Contains(o, "telecommunication company of iran"), strings.Contains(o, "iran telecommunication"), strings.Contains(o, "tci"):
		return "tci"
	case strings.Contains(o, "pishgaman"):
		return "pishgaman"
	case strings.Contains(o, "irancell"), strings.Contains(o, "mtn"):
		return "irancell"
	case strings.Contains(o, "mobile communication company of iran"), strings.Contains(o, "hamrah"):
		return "mci"
	case strings.Contains(o, "rightel"):
		return "rightel"
	case strings.Contains(o, "asiatech"):
		return "asiatech"
	case strings.Contains(o, "pars online"), strings.Contains(o, "parsonline"):
		return "parsonline"
	case strings.Contains(o, "mobin"):
		return "mobinnet"
	case strings.Contains(o, "hiweb"):
		return "hiweb"
	case strings.Contains(o, "respina"):
		return "respina"
	case strings.Contains(o, "afranet"):
		return "afranet"
	}
	return ""
}

// ispNets: the resolver / DHCP ranges an ISP hands out — the offline fallback when the server cannot be asked.
var ispNets = []struct {
	cidr string
	isp  string
}{
	{"85.15.0.0/16", "shatel"},
	{"217.218.0.0/15", "tci"},
	{"5.202.0.0/16", "pishgaman"},
}

var ispNetsParsed = func() []struct {
	n   *net.IPNet
	isp string
} {
	var out []struct {
		n   *net.IPNet
		isp string
	}
	for _, e := range ispNets {
		if _, n, err := net.ParseCIDR(e.cidr); err == nil {
			out = append(out, struct {
				n   *net.IPNet
				isp string
			}{n, e.isp})
		}
	}
	return out
}()

// ISPFromIPs: the first IP that falls in a known ISP range decides (DHCP-assigned name servers, the public address).
func ISPFromIPs(ips []string) string {
	for _, s := range ips {
		ip := net.ParseIP(strings.TrimSpace(s))
		if ip == nil {
			continue
		}
		for _, e := range ispNetsParsed {
			if e.n.Contains(ip) {
				return e.isp
			}
		}
	}
	return ""
}

const ifaces = `HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces`

// DHCPNameServers reads the resolvers the ISP's DHCP handed to every live adapter (unchanged by our static setting,
// so it still tells the ISP after the tweak is on). Registry only — microseconds.
func DHCPNameServers(s engine.Sys) []string {
	keys, err := s.RegSubkeys(ifaces)
	if err != nil {
		return nil
	}
	var out []string
	for _, k := range keys {
		for _, name := range []string{"DhcpNameServer", "DhcpDefaultGateway", "DhcpIPAddress"} {
			v, _ := s.RegGet(k, name)
			if v == nil {
				continue
			}
			for _, w := range strings.FieldsFunc(strings.Trim(strings.ReplaceAll(strings.ReplaceAll(fmtAny(v.Value), "[", ""), "]", ""), `"`), func(r rune) bool { return r == ' ' || r == ',' || r == '\n' }) {
				if ip := net.ParseIP(w); ip != nil && !ip.IsPrivate() && !ip.IsLoopback() && !ip.IsUnspecified() {
					out = append(out, w)
				}
			}
		}
	}
	return out
}

func fmtAny(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case []string:
		return strings.Join(x, " ")
	case []any:
		parts := make([]string, 0, len(x))
		for _, e := range x {
			parts = append(parts, fmtAny(e))
		}
		return strings.Join(parts, " ")
	}
	return ""
}

/* ---- benchmark ---- */

// Result of one provider in a scan.
type Result struct {
	ID      string   `json:"id"`
	Label   string   `json:"label"`
	Group   string   `json:"group"`
	Servers []string `json:"servers"`
	Ms      *int     `json:"ms"`      // best answer time, nil = no answer
	Answers int      `json:"answers"` // answered queries (of Queries)
	Queries int      `json:"queries"`
}

// Names resolved during the scan — a popular one (cached everywhere) and a game CDN (tests the recursive path).
var Names = []string{"www.google.com.", "store.steampowered.com."}

// Options of a scan.
type Options struct {
	Timeout time.Duration // per query (default 1.2 s)
	Rounds  int           // queries per server per name (default 2)
	Names   []string
}

// Query resolves one name at one server over UDP/53 and returns the round-trip time.
type Query func(ctx context.Context, server, name string) (time.Duration, error)

// UDPQuery is the real resolver: Go's DNS client pointed at exactly that server.
func UDPQuery(ctx context.Context, server, name string) (time.Duration, error) {
	r := &net.Resolver{PreferGo: true, Dial: func(ctx context.Context, _, _ string) (net.Conn, error) {
		var d net.Dialer
		return d.DialContext(ctx, "udp", net.JoinHostPort(server, "53"))
	}}
	t0 := time.Now()
	_, err := r.LookupIPAddr(ctx, name)
	return time.Since(t0), err
}

// Scan benchmarks the providers (all of them when ids is empty): every server of every provider in parallel, Rounds
// queries per name, best time wins. ~2–3 s for the whole list. Results come back sorted: answered ones by time, then
// the silent ones in list order.
func Scan(ctx context.Context, ids []string, q Query, o Options) []Result {
	if q == nil {
		q = UDPQuery
	}
	if o.Timeout <= 0 {
		o.Timeout = 1200 * time.Millisecond
	}
	if o.Rounds <= 0 {
		o.Rounds = 2
	}
	if len(o.Names) == 0 {
		o.Names = Names
	}
	want := map[string]bool{}
	for _, id := range ids {
		want[id] = true
	}
	var list []Provider
	for _, p := range Providers {
		if len(want) == 0 || want[p.ID] {
			list = append(list, p)
		}
	}
	out := make([]Result, len(list))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 48) // sockets in flight
	for i, p := range list {
		out[i] = Result{ID: p.ID, Label: p.Label, Group: p.Group, Servers: p.Servers, Queries: len(p.Servers) * len(o.Names) * o.Rounds}
		var mu sync.Mutex
		for _, srv := range p.Servers {
			for _, name := range o.Names {
				wg.Add(1)
				go func(i int, srv, name string) {
					defer wg.Done()
					sem <- struct{}{}
					defer func() { <-sem }()
					for r := 0; r < o.Rounds; r++ {
						qctx, cancel := context.WithTimeout(ctx, o.Timeout)
						d, err := q(qctx, srv, name)
						cancel()
						if err != nil {
							if ctx.Err() != nil {
								return
							}
							continue
						}
						ms := int(d / time.Millisecond)
						if ms < 1 {
							ms = 1
						}
						mu.Lock()
						out[i].Answers++
						if out[i].Ms == nil || ms < *out[i].Ms {
							out[i].Ms = &ms
						}
						mu.Unlock()
					}
				}(i, srv, name)
			}
		}
	}
	wg.Wait()
	sort.SliceStable(out, func(a, b int) bool {
		ra, rb := out[a], out[b]
		if (ra.Ms == nil) != (rb.Ms == nil) {
			return ra.Ms != nil
		}
		if ra.Ms == nil {
			return false
		}
		if *ra.Ms != *rb.Ms {
			return *ra.Ms < *rb.Ms
		}
		return ra.Answers > rb.Answers
	})
	return out
}

// Reachable: the provider answered at least half of its queries (a resolver that drops every other packet is no
// candidate for gaming).
func (r Result) Reachable() bool { return r.Ms != nil && r.Answers*2 >= r.Queries }

// Best picks the provider to apply: the detected ISP's own resolver when it answered, otherwise the fastest reachable
// one that does not filter. With the ISP known, other ISPs' resolvers are skipped (they are not meant for this
// network); with it unknown, an ISP resolver that answers fastest is the best hint we have. "" when nothing answered.
func Best(results []Result, isp string) string {
	if p := ForISP(isp); p != nil {
		for _, r := range results {
			if r.ID == p.ID && r.Reachable() {
				return r.ID
			}
		}
	}
	for _, r := range results {
		if r.Group == GroupFamily || r.Group == GroupSecure || !r.Reachable() {
			continue
		}
		if isp != "" && r.Group == GroupISP {
			if p := Find(r.ID); p != nil && p.ISP != isp {
				continue
			}
		}
		return r.ID
	}
	return ""
}
