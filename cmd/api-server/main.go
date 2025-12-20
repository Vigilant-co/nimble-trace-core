package main

import (
    "log"
    "net/http"
    "encoding/json"
    "github.com/gorilla/mux"
)

func main() {
    r := mux.NewRouter()
    
    r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
        json.NewEncoder(w).Encode(map[string]string{"status": "OK"})
    })
    
    r.HandleFunc("/api/products", getProducts).Methods("GET")
    
    log.Println("🚀 Server starting on port 8080...")
    log.Fatal(http.ListenAndServe(":8080", r))
}

func getProducts(w http.ResponseWriter, r *http.Request) {
	// we will change this function with DB integration later
	products := []map[string]interface{}{
		{"id": 1, "name": "Laptop", "price": 999.99},
		{"id": 2, "name": "Smartphone", "price": 499.99},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(products)
}