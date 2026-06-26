#!/bin/bash
set -e

# npm atomic-rename fails with ENOTEMPTY on Replit's filesystem.
# A clean reinstall avoids the rename entirely.
rm -rf node_modules
npm install --no-audit --no-fund
