//go:build !windows

package main

import "fmt"

func main() {
	fmt.Println("FPS Boost runs on Windows only — build with GOOS=windows (see scripts/build.sh)")
}
