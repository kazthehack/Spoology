# Makefile for React + Vite frontend
# Usage:
#   make install   # npm install
#   make build     # npm run build
#   make run       # npm run dev

SHELL := /bin/bash

install:
	npm install

build: install lint
	npm run build

run: install
	npm run dev


fmt: install
	npx prettier --write "src/**/*.{ts,tsx,js,jsx,css,md}" "public/**/*.json"


clean:
	rm -rf node_modules dist .turbo .vite


lint: install
	npm run lint
