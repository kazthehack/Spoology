# Makefile for FastAPI backend
# Usage:
#   make install   # create venv and install deps
#   make run       # run uvicorn with reload

SHELL := /bin/bash
PYTHON ?= python3
VENV := .venv
PIP := $(VENV)/bin/pip
UVICORN := $(VENV)/bin/uvicorn

$(VENV):
	$(PYTHON) -m venv $(VENV)

install: $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt

run: install
	$(UVICORN) main:app --reload --port 8000


fmt: install
	$(VENV)/bin/python -m black .


clean:
	rm -rf $(VENV) __pycache__ */__pycache__ *.pyc *.pyo


lint: install
	$(VENV)/bin/flake8 .


build: lint
	@echo "Backend build: lint passed (no binary artefacts to build)."
