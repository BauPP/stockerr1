const { createApp } = require('./src/app');

const app = createApp();
const PORT = Number(process.env.PORT || 3007);

app.listen(PORT, () => {
  console.log(`Barcode Service escuchando en puerto ${PORT}`);
});
