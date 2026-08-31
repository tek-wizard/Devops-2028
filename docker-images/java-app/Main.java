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
