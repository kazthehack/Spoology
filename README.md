
# Filament Spool Toolkit (React + FastAPI)

- `App/` – React + TS frontend (Vite).
- `Backend/` – FastAPI backend.

Spool JSON supports:

- `refillable: boolean` – controls visibility of the
  "Include refill spool core" checkbox in the calculator.


## Quick start with Make

Frontend:

```bash
cd App
make run
```

Backend:

```bash
cd Backend
make run
```

## Formatting

Frontend (Prettier):

```bash
cd App
make fmt
```

Backend (black):

```bash
cd Backend
make fmt
```

## Linters

Frontend (ESLint runs as part of build):

```bash
cd App
make build   # runs lint then vite build
```

Backend (flake8 via make build):

```bash
cd Backend
make build  # runs flake8
```
