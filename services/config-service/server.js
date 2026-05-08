const { createApp } = require('./src/app');

const app = createApp();
const PORT = Number(process.env.PORT || 3008);

app.listen(PORT, () => {
  console.log(`Config Service escuchando en puerto ${PORT}`);
});
