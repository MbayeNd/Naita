import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { env, isProd } from './config/env.js';
import { connectDatabase } from './config/db.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: env.clientOrigin.split(',').map((o) => o.trim()),
    credentials: false,
  })
);
app.use(express.json({ limit: '256kb' }));
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
