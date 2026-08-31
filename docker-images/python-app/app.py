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
