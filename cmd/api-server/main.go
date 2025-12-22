// cmd/api-server/main.go
package main

import (
    "context"
    "encoding/json"
    "net/http"
    "os"
    "os/signal"
    "sync"
    "syscall"
    "time"
    
    "github.com/gorilla/mux"
    "github.com/rs/zerolog"
    "github.com/rs/zerolog/log"
)

type Product struct {
    ID           string    `json:"id"`
    Name         string    `json:"name"`
    CurrentPrice float64   `json:"current_price"`
    LastUpdated  time.Time `json:"last_updated"`
}

type productStore struct {
    sync.RWMutex
    items map[string]Product
}

var store = &productStore{
    items: make(map[string]Product),
}

func initStore() {
    store.Lock()
    defer store.Unlock()
    
    now := time.Now()
    store.items["1"] = Product{
        ID:           "1",
        Name:         "ASUS ROG Laptop",
        CurrentPrice: 45000000,
        LastUpdated:  now,
    }
    store.items["2"] = Product{
        ID:           "2",
        Name:         "Samsung S24",
        CurrentPrice: 32000000,
        LastUpdated:  now,
    }
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
    respondJSON(w, http.StatusOK, map[string]string{"status": "operational"})
}

func listProducts(w http.ResponseWriter, r *http.Request) {
    store.RLock()
    defer store.RUnlock()
    
    products := make([]Product, 0, len(store.items))
    for _, p := range store.items {
        products = append(products, p)
    }
    
    respondJSON(w, http.StatusOK, products)
}

func getProduct(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    id := vars["id"]
    
    store.RLock()
    product, exists := store.items[id]
    store.RUnlock()
    
    if !exists {
        respondError(w, http.StatusNotFound, "product not found")
        return
    }
    
    respondJSON(w, http.StatusOK, product)
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    if err := json.NewEncoder(w).Encode(data); err != nil {
        log.Error().Err(err).Msg("failed to encode response")
    }
}

func respondError(w http.ResponseWriter, status int, message string) {
    respondJSON(w, status, map[string]string{"error": message})
}

func main() {
    zerolog.TimeFieldFormat = time.RFC3339Nano
    log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
    
    initStore()
    
    router := mux.NewRouter()
    router.HandleFunc("/health", healthCheck).Methods("GET")
    router.HandleFunc("/api/products", listProducts).Methods("GET")
    router.HandleFunc("/api/products/{id}", getProduct).Methods("GET")
    
    router.Use(loggingMiddleware)
    
    server := &http.Server{
        Addr:         ":8080",
        Handler:      router,
        ReadTimeout:  15 * time.Second,
        WriteTimeout: 15 * time.Second,
        IdleTimeout:  60 * time.Second,
    }
    
    go func() {
        log.Info().Str("port", "8080").Msg("API server starting")
        if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatal().Err(err).Msg("server failed")
        }
    }()
    
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit
    
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    
    if err := server.Shutdown(ctx); err != nil {
        log.Error().Err(err).Msg("forced shutdown")
    }
    
    log.Info().Msg("server stopped")
}

func loggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        
        rw := &responseWriter{w, http.StatusOK}
        next.ServeHTTP(rw, r)
        
        log.Info().
            Str("method", r.Method).
            Str("path", r.URL.Path).
            Int("status", rw.status).
            Dur("duration", time.Since(start)).
            Msg("request")
    })
}

type responseWriter struct {
    http.ResponseWriter
    status int
}

func (rw *responseWriter) WriteHeader(code int) {
    rw.status = code
    rw.ResponseWriter.WriteHeader(code)
}