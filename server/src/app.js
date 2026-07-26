import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { env, isProd } from './config/env.js';
import { connectDatabase } from './config/db.js';
import cookieParser from 'cookie-parser';
const app = express();
app.set('etag', false);

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    // credentials: true + an explicit origin list (never '*') is required for
    // the browser to send/accept the httpOnly refresh-token cookie cross-site.
    origin: env.clientOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(morgan(isProd ? 'combined' : 'dev'));

// Serverless platforms cold-start per request; connect lazily and reuse the handle.
app.use(async (_req, _res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    next(error);
  }
});

app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
