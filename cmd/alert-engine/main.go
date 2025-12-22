package main

import (
    "context"
    "os"
    "os/signal"
    "sync"
    "syscall"
    "time"
    
    "github.com/rs/zerolog"
    "github.com/rs/zerolog/log"
)

type AlertRule struct {
    ID        string
    ProductID string
    Condition string
    Threshold float64
    IsActive  bool
}

type AlertMonitor struct {
    sync.RWMutex
    rules       []AlertRule
    priceCache  map[string]float64
    alertCh     chan AlertEvent
    shutdownCh  chan struct{}
}

type AlertEvent struct {
    RuleID    string
    ProductID string
    Message   string
    Price     float64
    Timestamp time.Time
}

func NewAlertMonitor() *AlertMonitor {
    return &AlertMonitor{
        rules: []AlertRule{
            {
                ID:        "alert_1",
                ProductID: "1",
                Condition: "below",
                Threshold: 40000000,
                IsActive:  true,
            },
        },
        priceCache: make(map[string]float64),
        alertCh:    make(chan AlertEvent, 100),
        shutdownCh: make(chan struct{}),
    }
}

func (m *AlertMonitor) Run(ctx context.Context) {
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()
    
    for {
        select {
        case <-ticker.C:
            m.evaluateRules()
        case <-m.shutdownCh:
            return
        case <-ctx.Done():
            return
        }
    }
}

func (m *AlertMonitor) evaluateRules() {
    m.RLock()
    rules := m.rules
    prices := m.priceCache
    m.RUnlock()
    
    for _, rule := range rules {
        if !rule.IsActive {
            continue
        }
        
        price, exists := prices[rule.ProductID]
        if !exists {
            continue
        }
        
        triggered := false
        var message string
        
        switch rule.Condition {
        case "below":
            if price < rule.Threshold {
                triggered = true
                message = "price dropped below threshold"
            }
        case "above":
            if price > rule.Threshold {
                triggered = true
                message = "price exceeded threshold"
            }
        }
        
        if triggered {
            event := AlertEvent{
                RuleID:    rule.ID,
                ProductID: rule.ProductID,
                Message:   message,
                Price:     price,
                Timestamp: time.Now(),
            }
            
            select {
            case m.alertCh <- event:
                log.Warn().
                    Str("rule_id", event.RuleID).
                    Str("product_id", event.ProductID).
                    Float64("price", event.Price).
                    Msg("alert triggered")
            default:
                log.Error().Msg("alert channel full, dropping event")
            }
        }
    }
}

func (m *AlertMonitor) UpdatePrice(productID string, price float64) {
    m.Lock()
    defer m.Unlock()
    m.priceCache[productID] = price
}

func (m *AlertMonitor) Stop() {
    close(m.shutdownCh)
}

func main() {
    zerolog.TimeFieldFormat = time.RFC3339Nano
    log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
    
    monitor := NewAlertMonitor()
    
    monitor.UpdatePrice("1", 45000000)
    monitor.UpdatePrice("2", 32000000)
    
    ctx, cancel := context.WithCancel(context.Background())
    
    go monitor.Run(ctx)
    go processAlerts(monitor.alertCh)
    
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit
    
    cancel()
    monitor.Stop()
    
    time.Sleep(100 * time.Millisecond)
    log.Info().Msg("alert engine stopped")
}

func processAlerts(ch <-chan AlertEvent) {
    for event := range ch {
        log.Info().
            Str("rule", event.RuleID).
            Str("product", event.ProductID).
            Float64("price", event.Price).
            Str("message", event.Message).
            Msg("processing alert")
    }
}