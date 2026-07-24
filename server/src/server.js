import app from './app.js';
import { env } from './config/env.js';

// Vercel imports the app and handles listening itself.
if (!process.env.VERCEL) {
  app.listen(env.port, () => {
    console.log(`NAITA evaluation API listening on http://localhost:${env.port}`);
  });
}

export default app;
