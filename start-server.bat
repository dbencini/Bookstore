@echo off
REM Start server with increased heap memory for large author cache
REM 8GB heap should handle 10M+ author records
node --max-old-space-size=8192 server.js
