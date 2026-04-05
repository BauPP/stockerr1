const { createApp } = require('./src/app');

const app = createApp();
const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`🔐 Auth Service ejecutándose en puerto ${PORT}`);
});
