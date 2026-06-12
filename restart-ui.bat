@echo off
set VERSION=%1
if "%VERSION%"=="" set VERSION=1.0.0

echo Building image joelearnning/wiremock-ui:%VERSION% ...
docker build --no-cache -t joelearnning/wiremock-ui:%VERSION% -t joelearnning/wiremock-ui:latest .

echo Stopping old container...
docker kill wiremock-ui 2>nul
docker rm wiremock-ui 2>nul

echo Starting new container...
docker run -d ^
  --name wiremock-ui ^
  -p 8081:80 ^
  -e WIREMOCK_HOST=host.docker.internal ^
  -e WIREMOCK_PORT=8080 ^
  joelearnning/wiremock-ui:latest

echo Done! Access at http://localhost:8081
