const { createApp } = require('./src/app');

const app = createApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌐 API Gateway ejecutándose en puerto ${PORT}`);
});
