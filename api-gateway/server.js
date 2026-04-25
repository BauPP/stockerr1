const { createApp } = require('./src/app');

const port = Number(process.env.PORT || 3000);
const app = createApp();

app.listen(port, () => {
  console.log(`api-gateway listening on port ${port}`);
});
