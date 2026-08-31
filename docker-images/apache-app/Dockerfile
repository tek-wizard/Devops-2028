FROM httpd:2.4

# The official Apache image serves whatever is in this folder, so the only
# thing needed is to drop my page in and replace the default one.
COPY index.html /usr/local/apache2/htdocs/index.html

EXPOSE 80
