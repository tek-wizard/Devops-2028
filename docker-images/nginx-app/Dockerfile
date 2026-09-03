FROM nginx:alpine

# nginx serves whatever is in this folder, so I only replace the default page
COPY index.html /usr/share/nginx/html/index.html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
