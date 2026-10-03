package dns_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"fpsboost.ir/app/internal/dns"
)

func fakeQuery(times map[string]time.Duration) dns.Query {
	return func(ctx context.Context, server, name string) (time.Duration, error) {
		d, ok := times[server]
		if !ok {
			return 0, errors.New("timeout")
		}
		return d, nil
	}
}

func TestScanSortsAnsweredFirstAndBestPrefersTheISP(t *testing.T) {
	q := fakeQuery(map[string]time.Duration{
		"85.15.1.14": 9 * time.Millisecond, "85.15.1.15": 11 * time.Millisecond, // Shatel answers
		"1.1.1.1": 40 * time.Millisecond, "1.0.0.1": 38 * time.Millisecond,
		"8.8.8.8": 60 * time.Millisecond,
		"1.1.1.3": 5 * time.Millisecond, // family filter: fastest, must never be chosen automatically
	})
	res := dns.Scan(context.Background(), []string{"shatel", "tci", "cloudflare", "google", "cloudflare_family"}, q, dns.Options{Rounds: 1})
	if len(res) != 5 || res[0].ID != "cloudflare_family" || res[1].ID != "shatel" || res[2].ID != "cloudflare" || res[3].ID != "google" || res[4].ID != "tci" {
		for _, r := range res {
			t.Logf("%s ms=%v answers=%d/%d", r.ID, r.Ms, r.Answers, r.Queries)
		}
		t.Fatal("unexpected order")
	}
	if res[4].Ms != nil || res[4].Reachable() {
		t.Fatal("tci never answered")
	}
	if res[3].Answers != 2 || res[3].Queries != 4 || !res[3].Reachable() {
		t.Fatalf("google answered on one server of two (%d/%d): half the queries still counts as reachable", res[3].Answers, res[3].Queries)
	}
	if got := dns.Best(res, "shatel"); got != "shatel" {
		t.Fatalf("on Shatel the ISP resolver wins, got %q", got)
	}
	if got := dns.Best(res, "tci"); got != "cloudflare" {
		t.Fatalf("on TCI with its resolver silent: fastest unfiltered public one, got %q", got)
	}
	// ISP unknown: an ISP resolver that answers (9 ms) is the best hint there is — it wins over Cloudflare (38 ms)
	if got := dns.Best(res, ""); got != "shatel" {
		t.Fatalf("unknown ISP: fastest answering unfiltered resolver, got %q", got)
	}
	// ISP known (Pishgaman, resolver silent): other ISPs' resolvers are skipped, public ones compete
	if got := dns.Best(res, "pishgaman"); got != "cloudflare" {
		t.Fatalf("known ISP: skip other ISPs' resolvers, got %q", got)
	}
}

func TestBestNothingAnswered(t *testing.T) {
	res := dns.Scan(context.Background(), []string{"shatel", "google"}, fakeQuery(nil), dns.Options{Rounds: 1})
	if got := dns.Best(res, "shatel"); got != "" {
		t.Fatalf("want empty, got %q", got)
	}
}

func TestISPDetection(t *testing.T) {
	if dns.ISPFromASN(31549) != "shatel" || dns.ISPFromASN(58224) != "tci" || dns.ISPFromASN(1) != "" {
		t.Fatal("asn map")
	}
	if dns.ISPFromOrg("Aria Shatel Company Ltd") != "shatel" || dns.ISPFromOrg("Iran Telecommunication Company PJS") != "tci" || dns.ISPFromOrg("Cloudflare") != "" {
		t.Fatal("org map")
	}
	if dns.ISPFromIPs([]string{"192.168.1.1", "85.15.1.14"}) != "shatel" || dns.ISPFromIPs([]string{"217.218.127.127"}) != "tci" || dns.ISPFromIPs([]string{"8.8.8.8"}) != "" {
		t.Fatal("ip ranges")
	}
	if dns.ForISP("shatel").Servers[0] != "85.15.1.14" || dns.ForISP("tci").Servers[1] != "217.218.155.155" || dns.ForISP("irancell") != nil {
		t.Fatal("isp resolvers")
	}
}

func TestProvidersAreWellFormed(t *testing.T) {
	seen := map[string]bool{}
	for _, p := range dns.Providers {
		if p.ID == "" || p.Label == "" || len(p.Servers) == 0 || seen[p.ID] {
			t.Fatalf("bad provider %+v", p)
		}
		seen[p.ID] = true
		if (p.Group == dns.GroupISP) != (p.ISP != "") {
			t.Fatalf("isp tag mismatch %+v", p)
		}
	}
	if dns.Find("cloudflare") == nil || dns.Find("nope") != nil || len(dns.IDs()) != len(dns.Providers) {
		t.Fatal("find / ids")
	}
}
