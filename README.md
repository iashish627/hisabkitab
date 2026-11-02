# HisabKitab

A lightweight inventory, order and business-expense workspace for small sellers.

## Features in the first milestone

- Responsive seller dashboard with sales snapshot and channel overview
- Product catalogue with SKU, category, price, cost and stock
- Browser camera barcode scanning powered by ZXing
- Incoming and outgoing stock movements
- Order and expense entry
- Basic business reports and inventory health
- Local persistence using browser localStorage

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Stack

- React 18 + Vite
- React Router-ready single-page workspace
- Lucide icons
- @zxing/browser for barcode scanning

## Current limitations

This milestone is a front-end MVP with demo data. Records are saved in the current browser only. Authentication, shared database storage, marketplace sync, shipping integrations, and production accounting are not implemented yet. Camera scanning requires HTTPS or localhost and browser camera permission.
