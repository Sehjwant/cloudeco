# Serve the prebuilt Vite static bundle on Cloud Run via nginx.
# Build locally first: `npm run build` (produces dist/).
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist /usr/share/nginx/html
EXPOSE 8080
