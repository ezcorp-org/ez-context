package main

import (
	"fmt"
	"net/http"

	"github.com/example/bench-go-project/internal/handler"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", handler.HealthCheck)
	fmt.Println("Server starting on :8080")
	http.ListenAndServe(":8080", mux)
}
