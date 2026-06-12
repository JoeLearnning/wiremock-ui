@echo off
set VERSION=%1
if "%VERSION%"=="" set VERSION=1.0.0

echo Building image joelearnning/wiremock-ui:%VERSION% ...
docker build --no-cache -t joelearnning/wiremock-ui:%VERSION% -t joelearnning/wiremock-ui:latest .


