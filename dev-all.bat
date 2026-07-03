@echo off
REM Chay npm run dev cho ca 3 phan: BE, FE admin, FE client
REM Moi service mo trong 1 cua so console rieng

set ROOT=%~dp0

start "BE - be_maxv"   cmd /k "cd /d %ROOT%be_maxv && npm run dev"
start "FE admin - maxv" cmd /k "cd /d %ROOT%maxv && npm run dev"
start "FE client - fe_maxv" cmd /k "cd /d %ROOT%fe_maxv && npm run dev"

echo Da khoi chay ca 3 service trong 3 cua so rieng.
