import express from 'express';
const app = express();
const PORT = process.env.PORT || 8080;
app.get('/', (_, res) => {
    res.send('Webhook Event Processing Service running');
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
