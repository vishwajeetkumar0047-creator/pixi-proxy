import http from 'node:http';

const TARGET = process.env.TARGET || 'http://matrix.nexifyhost.fun:19104';
const PORT = process.env.PORT || 3000;
const SKIP = new Set(['host', 'connection', 'content-length', 'content-encoding', 'transfer-encoding']);

http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;

    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (!SKIP.has(key)) headers[key] = value;
    }
    headers['x-forwarded-proto'] = 'https';

    const upstream = await fetch(TARGET + req.url, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
    });

    const outHeaders = {};
    upstream.headers.forEach((value, key) => {
      if (!SKIP.has(key) && key !== 'set-cookie') outHeaders[key] = value;
    });
    if (upstream.headers.getSetCookie) {
      const cookies = upstream.headers.getSetCookie();
      if (cookies.length) outHeaders['set-cookie'] = cookies;
    }

    const data = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, outHeaders);
    res.end(data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bot is not reachable right now. Try again in a minute.');
  }
}).listen(PORT, () => console.log(`Proxy running on ${PORT} -> ${TARGET}`));
