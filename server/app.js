import express from 'express';
import logger from 'morgan';
import dotenv from 'dotenv';
import '@babel/polyfill';
import bodyParser from 'body-parser';
import ms from 'ms';
import swaggerUi from 'swagger-ui-express';
import validateEnvironmentVars from './validator';
import swaggerConfig from '../docs/swagger';
import routes from './routes';
import worker from './jobs/worker';
import generateSwagger from '../express-swagger-generator';

// Get env variables from .env
dotenv.config();

// Validate environment variables before anything else happens
validateEnvironmentVars();

const app = express();
// Important! needs to be called before any other app method.
generateSwagger(app, swaggerConfig);

// Log requests to the console.
app.use(logger('dev'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Register the routes
routes(app);

// Here set the swagger docs then handle 404s
// It shows an example of how you can add swagger doc specification using an options object.
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(app.schema), {
  description: 'The endpoint for viewing the Swagger API docs',
  summary: 'Home for this swagger documentation',
});

app.get('*', (req, res) => res.status(200).send({
  message: 'Welcome to the beginning of nothingness.',
}));

const port = parseInt(process.env.PORT, 10) || 8000;
app.set('port', port);
worker.init();
setInterval(() => worker.exec(), ms(process.env.TIMER_INTERVAL || '1d'));

export default app;
