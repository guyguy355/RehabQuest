import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import authRoutes from './routes/auth.routes.js';
import messageRoutes from './routes/messages.routes.js';
import patientRoutes from './routes/patient.routes.js';
import therapistRoutes from './routes/therapist.routes.js';

dotenv.config();

const app = express();
const port = process.env.PORT ?? 3000;
const corsOrigin = process.env.CORS_ORIGIN;

app.use(
  cors({
    origin: corsOrigin ?? true,
  }),
);
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/messages', messageRoutes);
app.use('/patient', patientRoutes);
app.use('/therapist', therapistRoutes);

app.get('/', (_request, response) => {
  response.json({
    message: 'Welcome to the RehabQuest API',
  });
});

app.get('/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'RehabQuest API',
  });
});

app.listen(port, () => {
  console.log(`RehabQuest API running on port ${port}`);
});
