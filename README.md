# Nimble Trace Core
* **project structure**:
```
nimble-trace-core/
├── README.md
├── LICENSE
├── .gitignore
├── requirements.txt       # requests like beautifulsoup4 and flask
├── src/                   # main codes
│   ├── scraper/
│   │   ├── __init__.py
│   │   ├── base_scraper.py
│   │   └── digikala_scraper.py
│   ├── api/
│   │   ├── __init__.py
│   │   └── app.py
│   ├── database/          
│   │   ├── __init__.py
│   │   └── models.py 
│   └── utils/
│       ├── __init__.py
│       └── csv_handler.py
├── data/                  
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── tests/                 # coming soon
└── docs/                  # coming soon
```