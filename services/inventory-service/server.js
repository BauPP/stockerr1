const { createApp } = require('./src/app');

const port = Number(process.env.PORT || 3004);
const app = createApp();

app.listen(port, () => {
  console.log(`inventory-service listening on port ${port}`);
});
