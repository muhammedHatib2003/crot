const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");
const url = require("url");

const APP_TITLE = "Restaurant POS Desktop";
const DEV_URL = process.env.ELECTRON_DEV_URL || "http://localhost:5173";
const LOCAL_SERVER_PORT = Number(process.env.ELECTRON_LOCAL_PORT) || 5174;
const LOCAL_SERVER_HOST = "127.0.0.1";

const isDev = !app.isPackaged;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

let mainWindow = null;
let localServer = null;

function getWebDistDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "web-dist");
  }
  return path.join(__dirname, "..", "web", "dist");
}

function safeJoin(rootDir, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0].split("#")[0]);
  const normalized = path.normalize(decoded).replace(/^([\\/])+/, "");
  const resolved = path.join(rootDir, normalized);
  const safeRoot = path.resolve(rootDir);
  if (!path.resolve(resolved).startsWith(safeRoot)) {
    return null;
  }
  return resolved;
}

function createLocalServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const parsedUrl = url.parse(req.url || "/");
        let pathname = parsedUrl.pathname || "/";
        if (pathname === "/") {
          pathname = "/index.html";
        }

        const filePath = safeJoin(rootDir, pathname);
        if (!filePath) {
          res.writeHead(403);
          res.end("Forbidden");
          return;
        }

        fs.stat(filePath, (statError, stat) => {
          const sendIndex = () => {
            const indexPath = path.join(rootDir, "index.html");
            fs.readFile(indexPath, (readError, indexContent) => {
              if (readError) {
                res.writeHead(500);
                res.end("Failed to read index.html");
                return;
              }
              res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
              res.end(indexContent);
            });
          };

          if (statError || !stat || !stat.isFile()) {
            sendIndex();
            return;
          }

          const ext = path.extname(filePath).toLowerCase();
          const contentType = MIME_TYPES[ext] || "application/octet-stream";
          res.writeHead(200, { "Content-Type": contentType });
          fs.createReadStream(filePath).pipe(res);
        });
      } catch (error) {
        res.writeHead(500);
        res.end("Internal server error");
      }
    });

    server.on("error", reject);
    server.listen(LOCAL_SERVER_PORT, LOCAL_SERVER_HOST, () => {
      resolve(server);
    });
  });
}

async function resolveStartUrl() {
  if (isDev) {
    return DEV_URL;
  }

  const rootDir = getWebDistDir();
  if (!fs.existsSync(path.join(rootDir, "index.html"))) {
    throw new Error(`Built web assets not found at: ${rootDir}`);
  }

  localServer = await createLocalServer(rootDir);
  return `http://${LOCAL_SERVER_HOST}:${LOCAL_SERVER_PORT}/`;
}

function createWindow(startUrl) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: APP_TITLE,
    backgroundColor: "#0f172a",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.setTitle(APP_TITLE);

  if (process.platform !== "darwin") {
    Menu.setApplicationMenu(null);
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (/^https?:\/\//i.test(targetUrl)) {
      shell.openExternal(targetUrl);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    const allowedPrefixes = [startUrl, DEV_URL];
    if (!allowedPrefixes.some((prefix) => targetUrl.startsWith(prefix))) {
      event.preventDefault();
      if (/^https?:\/\//i.test(targetUrl)) {
        shell.openExternal(targetUrl);
      }
    }
  });

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

app.setName(APP_TITLE);

app.whenReady().then(async () => {
  try {
    const startUrl = await resolveStartUrl();
    createWindow(startUrl);
  } catch (error) {
    console.error("[desktop] failed to start:", error);
    app.quit();
  }

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const startUrl = await resolveStartUrl();
      createWindow(startUrl);
    }
  });
});

app.on("window-all-closed", () => {
  if (localServer) {
    localServer.close();
    localServer = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
