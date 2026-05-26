import { createServer } from 'node:http';
import { createApp } from './app.js';
import { attachRealtime } from './realtime.js';
import { startDemoSimulation } from './demoSimulator.js';
import { useDatabase } from './db.js';

const port = Number(process.env.PORT ?? 4000);
const app = createApp();
const server = createServer(app);

attachRealtime(server);

// Start demo realtime simulation when running with in-memory store
if (!useDatabase && process.env.DEMO_SIMULATION !== 'off') {
  startDemoSimulation();
}

server.listen(port, () => {
  console.log(`Deskora API listening on http://localhost:${port}`);
});
