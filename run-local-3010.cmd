@echo off
cd /d "%~dp0"
set WRANGLER_LOG_PATH=.wrangler\local.log
node_modules\.bin\vinext.cmd dev --port 3010 > .wrangler\vinext-dev-3010.log 2>&1
