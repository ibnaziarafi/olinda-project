// Example only: node integrations/examples/node-server.mjs
// Your localhost origin must be allowed by the backend before chat will work.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('./embed.html', import.meta.url));
createServer((request, response) => {
  if (request.url !== '/') {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end('Not found');
  }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(page);
}).listen(3000, '127.0.0.1', () => {
  console.log('Olinda embed example: http://127.0.0.1:3000');
});
