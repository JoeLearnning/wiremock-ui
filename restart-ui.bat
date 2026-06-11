@echo off
echo Building image...
docker build --no-cache -t joe/wiremock-ui .

echo Stopping old container...
docker kill wiremock-ui 2>nul
docker rm wiremock-ui 2>nul

echo Starting new container...
docker run -d --name wiremock-ui -p 8081:80 --add-host host.docker.internal:host-gateway joe/wiremock-ui

echo Done!