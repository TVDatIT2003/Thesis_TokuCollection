\
@echo off
REM Windows quickstart for the chat service
python -m venv .venv
call .venv\Scripts\activate
pip install -U pip
pip install -r requirements.txt
IF EXIST .env (
  for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    set %%a=%%b
  )
)
uvicorn main:app --host %HOST% --port %PORT%