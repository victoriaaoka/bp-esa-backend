import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import { resolve } from 'path';
import app from './app';
import { addServer } from '../express-swagger-generator';


const exportSwaggerDoc = () => process.env.NODE_ENV === 'development' && fs.writeFileSync(
  resolve(__dirname, '../swagger.json'),
  JSON.stringify(app.schema, null, 2),
);
// Get env variables

const port = app.get('port');
const server = app.listen(port, async () => {
  console.log(`App listening on port ${port}`);
  console.log(`Timer Interval is set to ${process.env.TIMER_INTERVAL}`);

  // Get the current host url and add to the app's schema
  addServer(server, app);
  // Here we serve the api-docs again because the app.schema has changed
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(app.schema));
  exportSwaggerDoc();
});
