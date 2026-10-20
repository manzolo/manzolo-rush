# MANZOLO RUSH: gioco statico servito da nginx.
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html style.css /usr/share/nginx/html/
COPY src /usr/share/nginx/html/src
COPY assets/sprites /usr/share/nginx/html/assets/sprites
COPY assets/audio /usr/share/nginx/html/assets/audio

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
