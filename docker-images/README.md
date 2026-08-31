# Docker Images and Dockerfiles (Sessions 6 and 7)

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

## Homework that was given

**Session 6:** make a simple Hello World web application for each of these and run it with
Docker, each in its own folder with its own Dockerfile.

1. Node.js application, preferably React
2. Python application
3. Java application
4. Apache web server

**Session 7:** clone the repo with the multi-stage Dockerfile from class, build the image,
run a container from it, access the application, and write an MD file with my name, my
enrollment number and the output showing the app running plus `docker ps` showing the
container on port 8080.

Everything below is done and there are browser screenshots of all five applications.

## What is in this folder

| Folder | Application | Base image | Port I used |
|---|---|---|---|
| [`nodejs-app`](nodejs-app) | React app built with Vite, served by nginx | `node:22-alpine` then `nginx:alpine` | 8081 |
| [`python-app`](python-app) | Flask web app | `python:3.12-slim` | 8082 |
| [`java-app`](java-app) | Java HTTP server, no framework | `eclipse-temurin:21-jdk-alpine` then `21-jre-alpine` | 8083 |
| [`apache-app`](apache-app) | Static page on Apache httpd | `httpd:2.4` | 8084 |
| [`multi-stage-app`](multi-stage-app) | Session 7 task, the class multi-stage Dockerfile | `node:24-alpine` | 8080 |

## All five running at the same time

```bash
$ docker ps
CONTAINER ID   IMAGE              COMMAND                  CREATED         STATUS         PORTS                                         NAMES
0406f8e7c7a4   nginx:alpine       "/docker-entrypoint.…"   2 minutes ago   Up 2 minutes   0.0.0.0:8085->80/tcp, [::]:8085->80/tcp       nginx-bind
b40798e47ea8   multistage-hello   "docker-entrypoint.s…"   5 minutes ago   Up 5 minutes   0.0.0.0:8080->3000/tcp, [::]:8080->3000/tcp   multistage-app
d871ca3e6bd0   hello-apache       "httpd-foreground"       7 minutes ago   Up 7 minutes   0.0.0.0:8084->80/tcp, [::]:8084->80/tcp       apache-web
e6f91aef3c22   hello-java         "/__cacert_entrypoin…"   7 minutes ago   Up 7 minutes   0.0.0.0:8083->8080/tcp, [::]:8083->8080/tcp   java-web
785ba03e42ef   hello-python       "python app.py"          7 minutes ago   Up 7 minutes   0.0.0.0:8082->5000/tcp, [::]:8082->5000/tcp   python-web
1015bdddd95f   hello-nodejs       "/docker-entrypoint.…"   7 minutes ago   Up 7 minutes   0.0.0.0:8081->80/tcp, [::]:8081->80/tcp       react-app
```

```bash
$ docker images | grep hello-
hello-java      latest    286MB
hello-apache    latest    205MB
hello-python    latest    223MB
hello-nodejs    latest    92.9MB
```

---

# 1. Node.js application with React, `nodejs-app`

I went with React since that was the preferred option. It is built with Vite.

## Files

```
nodejs-app/
├── Dockerfile
├── Dockerfile.single-stage   (only kept for the size comparison further down)
├── .dockerignore
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── App.jsx
    └── main.jsx
```

`src/App.jsx`:

```jsx
function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', marginTop: '80px' }}>
      <h1>Hello World from React running in Docker</h1>
      <p>Session 7 homework by Prateek Singh</p>
    </div>
  )
}

export default App
```

## Dockerfile

A React app is not something a browser can run directly. The JSX has to be compiled into
plain JavaScript first, and once that is done the browser only needs the finished static
files. Node is needed to do the build but it is not needed to serve the result. That is
exactly the situation multi-stage builds are for, so I wrote this one with two stages.

```dockerfile
# ------------------------------------------------------------------
# Stage 1: build the React app
# The whole toolchain (node, npm, vite, all the dev dependencies)
# is only needed here to turn the JSX into plain files.
# ------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# package.json is copied on its own first so that Docker can cache the
# npm install layer. If only my source code changes, the install is not
# repeated on the next build.
COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# ------------------------------------------------------------------
# Stage 2: serve the built files
# Nothing from stage 1 comes across except the finished dist folder,
# so node and node_modules are not in the final image at all.
# ------------------------------------------------------------------
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

I also added a `.dockerignore` so `node_modules` from my laptop never gets sent into the
build. Without it the build context is huge and, worse, my Mac's `node_modules` would
overwrite the Linux ones installed inside the image.

```
node_modules
dist
```

## Build

```bash
$ docker build -t hello-nodejs .
#1 [internal] load build definition from Dockerfile
#1 transferring dockerfile: 1.03kB done
#2 [internal] load metadata for docker.io/library/node:22-alpine
#3 [internal] load metadata for docker.io/library/nginx:alpine
#4 [internal] load .dockerignore
#4 transferring context: 58B done
#5 [internal] load build context
#5 transferring context: 2.54kB done
#6 [stage-1 1/2] FROM docker.io/library/nginx:alpine@sha256:db35bfc6b2951e7f8a72db5db1202...
#6 DONE 0.1s
#7 [build 1/6] FROM docker.io/library/node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3c...
#8 [build 2/6] WORKDIR /app
#9 [build 3/6] COPY package.json ./
#10 [build 4/6] RUN npm install
#10 DONE 13.2s
#11 [build 5/6] COPY . .
#12 [build 6/6] RUN npm run build
#12 DONE 0.6s
#13 [stage-1 2/2] COPY --from=build /app/dist /usr/share/nginx/html
#13 DONE 0.0s
#14 naming to docker.io/library/hello-nodejs:latest done
```

Two things I noticed in the log. The step numbers say `[build 4/6]` and `[stage-1 1/2]`,
so Docker really is treating them as two separate images. And `transferring context: 2.54kB`
is tiny, which is the `.dockerignore` doing its job.

## Run

```bash
$ docker run -d --name react-app -p 8081:80 hello-nodejs
$ docker ps --filter name=react-app
CONTAINER ID   IMAGE          COMMAND                  CREATED         STATUS         PORTS                                     NAMES
1015bdddd95f   hello-nodejs   "/docker-entrypoint.…"   7 seconds ago   Up 6 seconds   0.0.0.0:8081->80/tcp, [::]:8081->80/tcp   react-app
```

```bash
$ curl -i http://localhost:8081
HTTP/1.1 200 OK
Server: nginx/1.31.4
Date: Mon, 31 Aug 2026 11:41:58 GMT
Content-Type: text/html
Content-Length: 328
Last-Modified: Mon, 31 Aug 2026 11:41:13 GMT
Connection: keep-alive
ETag: "6a956859-148"
Accept-Ranges: bytes

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React Hello World</title>
    <script type="module" crossorigin src="/assets/index-DEnvGsv7.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

`curl` shows an empty page with just a script tag, because that is how a React app works.
The HTML is only a shell and React fills in `<div id="root">` once the JavaScript runs.
`curl` does not run JavaScript, a browser does. Notice that Vite has already rewritten the
script tag to point at the built bundle `/assets/index-DEnvGsv7.js`.

I checked that the text really is inside that bundle:

```bash
$ docker exec react-app ls -la /usr/share/nginx/html /usr/share/nginx/html/assets
-rw-r--r--    1 root     root           497 Aug 11 23:21 50x.html
drwxr-xr-x    2 root     root          4096 Aug 31 11:41 assets
-rw-r--r--    1 root     root           328 Aug 31 11:41 index.html

-rw-r--r--    1 root     root        142692 Aug 31 11:41 index-DEnvGsv7.js

$ docker exec react-app grep -o "Hello World from React running in Docker" /usr/share/nginx/html/assets/*.js
Hello World from React running in Docker
```

And that the final image really has no node in it:

```bash
$ docker exec react-app sh -c 'which node; ls /app'
node is not installed in the final image
/app does not exist in the final image
```

## In the browser

![React app running in Docker on port 8081](screenshots/nodejs-react-app-8081.jpg)

`http://localhost:8081`

---

# 2. Python application, `python-app`

The homework asks for a web application, so a `print("Hello World")` script is not enough.
I used Flask so it actually serves a page.

## `app.py`

```python
from flask import Flask

app = Flask(__name__)


@app.route("/")
def hello():
    return """
    <html>
      <head><title>Python Hello World</title></head>
      <body style="font-family: sans-serif; text-align: center; margin-top: 80px;">
        <h1>Hello World from Python running in Docker</h1>
        <p>Session 7 homework by Prateek Singh</p>
      </body>
    </html>
    """


if __name__ == "__main__":
    # 0.0.0.0 and not 127.0.0.1, otherwise the app only listens inside the
    # container and the port mapping from the host cannot reach it.
    app.run(host="0.0.0.0", port=5000)
```

That `0.0.0.0` is the mistake that catches people out. Flask defaults to `127.0.0.1`, which
inside a container means "only this container". The port mapping arrives from outside, so
the app has to listen on all interfaces or `curl` from the host just gets a refused
connection even though the container is running fine.

## Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# requirements.txt is copied by itself first so the pip install layer gets
# cached. Copying all the code first would make pip run again on every
# small code change.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 5000

CMD ["python", "app.py"]
```

Choices I made and why:

- `python:3.12-slim` instead of plain `python:3.12`, because slim leaves out things a
  container does not need. The full image is about three times bigger.
- `--no-cache-dir` on pip, because the download cache would be baked into the image layer
  and never used again.
- Two separate `COPY` steps, so a code change does not throw away the pip install layer.
  There is proof of that in the docker-fundamentals notes.

I did not copy the teacher's version of the python Dockerfile, which has
`RUN apt update && apt install -y pip3 python3` in it. That line is not needed, because the
`python:3.12-slim` image already contains Python and pip, and installing them again just
makes the image bigger.

## Run

```bash
$ docker build -t hello-python .
$ docker run -d --name python-web -p 8082:5000 hello-python

$ curl -i http://localhost:8082
HTTP/1.1 200 OK
Server: Werkzeug/3.1.8 Python/3.12.14
Date: Mon, 31 Aug 2026 11:41:58 GMT
Content-Type: text/html; charset=utf-8
Content-Length: 289
Connection: close

    <html>
      <head><title>Python Hello World</title></head>
      <body style="font-family: sans-serif; text-align: center; margin-top: 80px;">
        <h1>Hello World from Python running in Docker</h1>
        <p>Session 7 homework by Prateek Singh</p>
      </body>
    </html>
```

The port mapping is `8082:5000`, so 8082 on my laptop goes to 5000 inside the container.
The container port had to be 5000 because that is the port Flask was told to listen on.

## In the browser

![Python Flask app running in Docker on port 8082](screenshots/python-app-8082.jpg)

`http://localhost:8082`

---

# 3. Java application, `java-app`

Java usually comes with Maven or Gradle and a big pile of dependencies. For a Hello World
page none of that is needed, because the JDK already ships an HTTP server in
`com.sun.net.httpserver`. So this is one source file and no build tool.

## `Main.java`

```java
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;

public class Main {

    public static void main(String[] args) throws IOException {
        int port = 8080;

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        server.createContext("/", exchange -> {
            String html = """
                    <html>
                      <head><title>Java Hello World</title></head>
                      <body style="font-family: sans-serif; text-align: center; margin-top: 80px;">
                        <h1>Hello World from Java running in Docker</h1>
                        <p>Session 7 homework by Prateek Singh</p>
                      </body>
                    </html>
                    """;

            byte[] body = html.getBytes();
            exchange.getResponseHeaders().set("Content-Type", "text/html");
            exchange.sendResponseHeaders(200, body.length);

            try (OutputStream out = exchange.getResponseBody()) {
                out.write(body);
            }
        });

        server.start();
        System.out.println("Java web server started on port " + port);
    }
}
```

## Dockerfile

Java is the clearest example of why multi-stage builds exist. Compiling needs `javac`,
which only comes in the JDK. Running only needs `java`, which is in the much smaller JRE.
So stage 1 uses the JDK and stage 2 uses the JRE.

```dockerfile
# ------------------------------------------------------------------
# Stage 1: compile the Java source into a class file.
# This needs the full JDK because javac lives in the JDK.
# ------------------------------------------------------------------
FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /app

COPY Main.java .
RUN javac Main.java

# ------------------------------------------------------------------
# Stage 2: run it.
# Only the compiled Main.class is copied across, and the JRE image is
# used instead of the JDK because running does not need the compiler.
# ------------------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY --from=build /app/Main.class .

EXPOSE 8080

CMD ["java", "Main"]
```

The `.java` source file never reaches the final image either, only the compiled
`Main.class`. That is a nice side effect: the source code is not shipped.

## Run

```bash
$ docker build -t hello-java .
$ docker run -d --name java-web -p 8083:8080 hello-java

$ curl -i http://localhost:8083
HTTP/1.1 200 OK
Date: Mon, 31 Aug 2026 11:41:58 GMT
Content-type: text/html
Content-length: 252

<html>
  <head><title>Java Hello World</title></head>
  <body style="font-family: sans-serif; text-align: center; margin-top: 80px;">
    <h1>Hello World from Java running in Docker</h1>
    <p>Session 7 homework by Prateek Singh</p>
  </body>
</html>
```

The app listens on 8080 inside the container, but I mapped it to 8083 on my laptop because
8080 was already taken by the multi-stage app from session 7. That is the useful part of
port mapping: the container port is fixed by the app, the host port is my choice.

## In the browser

![Java app running in Docker on port 8083](screenshots/java-app-8083.jpg)

`http://localhost:8083`

---

# 4. Apache web server, `apache-app`

This one is the shortest, because the official `httpd` image is already a working web
server. All it needs is my page dropped in the right folder.

## Dockerfile

```dockerfile
FROM httpd:2.4

# The official Apache image serves whatever is in this folder, so the only
# thing needed is to drop my page in and replace the default one.
COPY index.html /usr/local/apache2/htdocs/index.html

EXPOSE 80
```

The path matters and it is different from nginx. Apache in this image serves
`/usr/local/apache2/htdocs`, while nginx serves `/usr/share/nginx/html`. Using the nginx
path here would build fine and then show the default "It works!" page, which would be
confusing to debug.

There is no `CMD` in this Dockerfile on purpose. The base image already has
`CMD ["httpd-foreground"]` and it works, so repeating it would only be noise. It shows up
in `docker ps` as the command:

```bash
$ docker ps --filter name=apache-web
CONTAINER ID   IMAGE          COMMAND              CREATED         STATUS         PORTS                                     NAMES
d871ca3e6bd0   hello-apache   "httpd-foreground"   7 seconds ago   Up 6 seconds   0.0.0.0:8084->80/tcp, [::]:8084->80/tcp   apache-web
```

## Run

```bash
$ docker build -t hello-apache .
$ docker run -d --name apache-web -p 8084:80 hello-apache

$ curl -i http://localhost:8084
HTTP/1.1 200 OK
Date: Mon, 31 Aug 2026 11:41:50 GMT
Server: Apache/2.4.68 (Unix)
Last-Modified: Mon, 31 Aug 2026 11:40:51 GMT
ETag: "13f-65a56462856c0"
Accept-Ranges: bytes
Content-Length: 319
Content-Type: text/html

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Apache Hello World</title>
  </head>
  <body style="font-family: sans-serif; text-align: center; margin-top: 80px;">
    <h1>Hello World from Apache running in Docker</h1>
    <p>Session 7 homework by Prateek Singh</p>
  </body>
</html>
```

## In the browser

![Apache app running in Docker on port 8084](screenshots/apache-app-8084.jpg)

`http://localhost:8084`

---

# 5. Session 7 task: the multi-stage Dockerfile from class

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

The task was to clone the class repo, build the multi-stage Dockerfile that is in it, run a
container from that image, access the app, and show `docker ps` with the container on
port 8080.

## Clone the repo

```bash
$ git clone https://github.com/Nency-Ravaliya/devops-heros.git
Cloning into 'devops-heros'...
```

The Dockerfile is at `devops-heros/session6-docker/multi-stage-dockerfile/Dockerfile`:

```dockerfile
# -------------------------
# Stage 1: Build
# -------------------------
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# -------------------------
# Stage 2: Production
# -------------------------
FROM node:24-alpine AS production

WORKDIR /app

COPY --from=builder /app/package*.json ./

RUN npm install --omit=dev

COPY --from=builder /app/server.js ./

EXPOSE 3000

CMD ["npm", "start"]
```

Reading it before building it, this is a different flavour of multi-stage from mine. Both
stages use the same `node:24-alpine` image. What changes is that stage 1 runs a plain
`npm install`, which pulls in the dev dependencies too, and stage 2 runs
`npm install --omit=dev`, which installs only what is needed at runtime. So the thing being
left behind here is the dev dependencies, not the whole toolchain.

## Build

```bash
$ cd devops-heros/session6-docker/multi-stage-dockerfile
$ docker build -t multistage-hello .
...
#12 [production 5/5] COPY --from=builder /app/server.js ./
#12 DONE 0.0s
#13 exporting to image
#13 exporting layers 0.1s done
#13 naming to docker.io/library/multistage-hello:latest done
#13 unpacking to docker.io/library/multistage-hello:latest 0.1s done
#13 DONE 0.2s
```

## Run the container on port 8080

```bash
$ docker run -d --name multistage-app -p 8080:3000 multistage-hello
b40798e47ea8...
```

## `docker ps` showing the container on port 8080

```bash
$ docker ps --filter name=multistage-app
CONTAINER ID   IMAGE              COMMAND                  CREATED         STATUS         PORTS                                         NAMES
b40798e47ea8   multistage-hello   "docker-entrypoint.s…"   4 seconds ago   Up 4 seconds   0.0.0.0:8080->3000/tcp, [::]:8080->3000/tcp   multistage-app
```

## Accessing the application

```bash
$ curl -i http://localhost:8080
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: text/html; charset=utf-8
Content-Length: 51
ETag: W/"33-gCAsBJJtlso/BVPWoV3U/pWC3Ak"
Date: Mon, 31 Aug 2026 11:43:23 GMT
Connection: keep-alive
Keep-Alive: timeout=5

<h1>Hello World from Docker Multi-Stage Build!</h1>
```

That is the exact text the task asked for.

## Container logs

```bash
$ docker logs multistage-app

> docker-hello-world@1.0.0 start
> node server.js

Server running on port 3000
```

The app itself says port 3000, and `docker ps` says `0.0.0.0:8080->3000/tcp`. Both are
correct at the same time: 3000 is inside the container and 8080 is the door on my laptop
that leads to it.

## In the browser

![Multi-stage build app running on port 8080](screenshots/multi-stage-app-8080.jpg)

`http://localhost:8080`

## Note on the folder

The clone is left out of this repo through `.gitignore`, because a git repo inside another
git repo makes a mess of the commits. The commands above are enough to reproduce it from
scratch.

---

# What multi-stage builds actually save

I did not want to just repeat that multi-stage builds make images smaller, so I built the
same two apps the naive single stage way and measured it. Both single stage Dockerfiles are
kept in the folders as `Dockerfile.single-stage`.

The React one, single stage, has to keep node and `node_modules` to serve the app:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 4173
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "4173"]
```

The Java one, single stage, keeps the entire JDK just to run one class file:

```dockerfile
FROM eclipse-temurin:21-jdk-alpine
WORKDIR /app
COPY Main.java .
RUN javac Main.java
EXPOSE 8080
CMD ["java", "Main"]
```

Then I measured both versions:

```bash
$ docker images | grep hello-
hello-nodejs-single    449MB
hello-java-single      555MB
hello-java             286MB
hello-apache           205MB
hello-python           223MB
hello-nodejs           92.9MB
```

| App | Single stage | Multi-stage | Saved |
|---|---|---|---|
| React | 449 MB | 92.9 MB | 356 MB, about 79% smaller |
| Java | 555 MB | 286 MB | 269 MB, about 48% smaller |

The React one drops the most because the whole node runtime plus `node_modules` gets left
behind and only static files survive. The Java one still needs a JVM to run, so the saving
is the compiler and the rest of the JDK.

The size is not the only benefit. The final React image has no node, no npm and no
`node_modules`, so none of the security problems in those packages can be exploited in
production, because they are not in the image at all. The Java image has no compiler and
not even the source file. A smaller image also pulls faster, which matters on every
deployment and every CI run.

**The rule I took from this:** anything needed only to produce the build output belongs in
an earlier stage. Compilers, package managers, test tools, dev dependencies. Only the
finished artifact and whatever runs it belong in the last stage.

---

# Things that went wrong while doing this

| Problem | What was happening | Fix |
|---|---|---|
| Flask container ran, but `curl` from the host got connection refused | Flask was listening on `127.0.0.1`, which inside a container means only that container | `app.run(host="0.0.0.0")` |
| Apache built fine but served the default "It works!" page | I first copied `index.html` to the nginx path `/usr/share/nginx/html` | Apache in this image serves `/usr/local/apache2/htdocs` |
| `docker run -p 8080:80` failed with "port is already allocated" | The multi-stage app from session 7 already had 8080 | Used 8081 to 8084 for the other apps |
| The React build was slow every single time | I was copying all the code before `npm install`, so any code edit invalidated the install layer | Copy `package.json` first, install, then copy the code |
| Build context was several hundred MB | My local `node_modules` was being uploaded to the daemon | Added `.dockerignore` |

# How to run everything in this folder

```bash
# React on 8081
cd nodejs-app && docker build -t hello-nodejs . && \
  docker run -d --name react-app -p 8081:80 hello-nodejs && cd ..

# Python on 8082
cd python-app && docker build -t hello-python . && \
  docker run -d --name python-web -p 8082:5000 hello-python && cd ..

# Java on 8083
cd java-app && docker build -t hello-java . && \
  docker run -d --name java-web -p 8083:8080 hello-java && cd ..

# Apache on 8084
cd apache-app && docker build -t hello-apache . && \
  docker run -d --name apache-web -p 8084:80 hello-apache && cd ..

# The class multi-stage app on 8080
cd multi-stage-app && git clone https://github.com/Nency-Ravaliya/devops-heros.git && \
  cd devops-heros/session6-docker/multi-stage-dockerfile && \
  docker build -t multistage-hello . && \
  docker run -d --name multistage-app -p 8080:3000 multistage-hello

# Clean up when done
docker rm -f react-app python-web java-web apache-web multistage-app
```
