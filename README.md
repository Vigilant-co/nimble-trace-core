# Nimble Trace Core
* **project structure**:
```
    nimble-trace-core/
    ├── cmd/
    │   ├── api-server/
    │   ├── scraper-manager/
    │   └── alert-engine/
    ├── internal/
    │   ├── core/
    │   ├── service/
    │   ├── handler/
    │   ├── repository/
    │   ├── storage/
    │   ├── scraper/
    │   │   ├── python/
    │   │   └── bridge/
    │   └── pkg/
    ├── pkg/
    │   ├── models/
    │   └── utils/
    ├── web/
    │   ├── static/
    │   └── templates/
    ├── scripts/
    ├── deployments/
    │   ├── docker/
    │   └── kubernetes/
    ├── configs/
    ├── tests/
    │   ├── unit/
    │   └── integration/
    ├── docs/
    ├── go.mod
    ├── pyproject.toml
    ├── README.md
    ├── LICENSE
    └── .gitignore
```