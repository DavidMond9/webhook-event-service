import express from 'express';
import webhookRouter from './routes/webhooks.js';
const app = express();
const PORT = process.env.PORT || 8080;
app.get('/', (_, res) => {
    res.send('Webhook Event Processing Service running');
});
app.use('/webhooks', webhookRouter);
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
