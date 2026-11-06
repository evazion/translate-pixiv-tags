import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";

const hostname = "127.0.0.1";
const port = 1919;

const server = createServer((req, res) => {
    const name = req.url?.slice(1)?.split("?")?.[0];
    const path = `./src/adapters/${name}.js`;
    if (!name || !existsSync(path)) {
        res.statusCode = 404;
        res.end();
        return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain");
    res.end(readFileSync(path));
});

server.listen(port, hostname, () => {
    console.log(`Server for adapters running at http://${hostname}:${port}/`);
});
