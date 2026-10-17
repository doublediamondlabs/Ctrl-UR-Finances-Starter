@echo off
setlocal
pushd "%~dp0"
if errorlevel 1 goto path_error
where py >nul 2>nul
if not errorlevel 1 goto run_py
where python >nul 2>nul
if not errorlevel 1 goto run_python
echo Python was not found. Install Python 3.10 or newer.
set "APP_EXIT=1"
goto finish
:run_py
py -3 "%~dp0portable_copy.py"
set "APP_EXIT=%errorlevel%"
goto finish
:run_python
python "%~dp0portable_copy.py"
set "APP_EXIT=%errorlevel%"
:finish
popd
pause
exit /b %APP_EXIT%
:path_error
echo Cannot access the application folder. Check the shared drive connection and permissions.
pause
exit /b 1
