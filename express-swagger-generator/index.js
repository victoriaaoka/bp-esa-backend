import express from 'express';
import Utils from './utils';
import app from '../server/app';

const httpMethods = [
  'get', 'post', 'patch',
  'delete', 'put',
  'options', 'head', 'trace',
  'connect', 'all', 'copy', 'link',
  'unlink', 'purge', 'lock', 'unlock',
  'propfind', 'view',
];

/**
 * Handles the addition of the given path to the app's swagger schema
 * @param {express} appInstance The express app
 * @param {string} path The path to add
 * @param {string} method The HTTP method,
 * could also be 'use' or 'all' in which case we default to 'get'
 * @param {Object} [options] Optional swagger definition that will descriptions of the given path.
 * @returns {void}
 */
const addToAppSchema = (appInstance, path, method, options) => {
  const otherOptions = options || {};
  /* eslint-disable-next-line no-param-reassign */
  appInstance.schema.paths[path] = {
    [httpMethods.includes(method) ? method : 'get']: {
      responses: {},
      ...otherOptions,
    },
    ...appInstance.schema.paths[path],
  };
};

/**
 * Checks whether the given instance is an instance of express.Router.
 * @param {*} instance The instance to perform the check against.
 * @return {boolean} true if instance is an instance of express.Router, otherwise false.
 */
const isRouter = instance => Object.getPrototypeOf(instance) === express.Router;

/**
 * Handles the case when an instance of express.Router is given as the last argument to an app's
 * method
 * @param {express} appInstance The express app
 * @param {string} definedPath The path for which this router should handle
 * @param {express.Router} router The router which was given
 * @param {Object} [options] Optional swagger definition that will descriptions of the given path.
 * @return {(void|*)} A Promise that resolves when the express Router has been handled
 */
const handleExpressRouter = (
  appInstance, definedPath, router, options,
) => Utils.loopSequentially(router.stack,
  (layer) => {
    // If the router was given a router,
    // get the path it handles from the regex expression as a string,
    // append it to the definedPath,
    // then call this function recursively with it as the first argument,
    // it's handle as the second argument, and the given options as the third
    if (layer.name === 'router') {
      const regexPath = layer.regexp.toString().split('\\')[1];
      return handleExpressRouter(appInstance, `${definedPath}${regexPath}`, layer.handle, options);
    }

    if (!layer.route) {
      // This means that .use() was used instead of a HTTP method and the last argument is
      // a request handler of signature (req, res, next) => {}
      // For documentation purposes, we will use the get method to add it to swagger
      // because we will not have access to any HTTP method
      const regexPath = layer.regexp.toString().split('\\')[1];
      const path = `${definedPath}${regexPath}`;
      return addToAppSchema(appInstance, path, 'get', options);
    }

    // This means HTTP methods were used on the router and therefore we have access
    // to them and the route that they handle, so we add this definition to the swagger
    // schema for each method
    return Utils.loopSequentially(Object.keys(layer.route.methods), (routerMethod) => {
      const path = `${definedPath}${layer.route.path}`;
      addToAppSchema(appInstance, path, routerMethod, options);
    });
  });

/**
 * Handles the last argument given to an express application instance method
 * given the method used is a HTTP method such as get, post, put, patch
 * or the method use is either use or all
 * @param {express} appInstance The express app
 * @param {(function|express.Router)} lastArg Can be an express router object or a function
 * @param {string} path The path with which the app method was called with
 * @param {string} method The app method that was called
 * @param {Object} [options] Options that may define the swagger schema for that route
 * @return {void}
 */
const handleLastArg = (appInstance, lastArg, path, method, options) => {
  if (isRouter(lastArg)) {
    // The last argument given is an express router which needs to be handled differently
    handleExpressRouter(appInstance, path, lastArg, options);
    return;
  }
  // The last argument given is an actual controller so just add it to the swagger schema
  addToAppSchema(appInstance, path, method, options);
};

/**
 * Handles the addition of paths with their HTTP method to the swagger schema
 * @param {express} appInstance The express application
 * @param {Object} newInstanceMethods The object that carries the references to the original
 * function definitions given by the express application
 * @param {string} method The method that the app was called with e.g use, all, get, post etc.
 * @param {Array} args An array of arguments that the app.[method] was called with.
 * It may include a path and must definitely include middleware
 * @return {*} It returns the return value of the app's method
 * as if it was called via the original function definition given by the express application
 */
const swaggerHandler = (appInstance, newInstanceMethods, method, ...args) => {
  let middlewareArgs = [...args];
  const [firstArg] = middlewareArgs;
  const [lastArg] = middlewareArgs.slice(-1);
  // The first argument is a string and does not equal the last argument and therefore
  // this is a path definition and it should be added to the app's schema
  if (typeof firstArg === 'string' && lastArg !== firstArg) {
    if (typeof lastArg === 'function') {
      // This means the options object was not given and therefore the
      // last argument should be considered as the controller for the given path
      handleLastArg(appInstance, lastArg, firstArg, method);
    } else if (typeof lastArg === 'object') {
      // This means the options object was given and therefore the second last argument should be
      // considered as the controller for the given path. This options argument is
      // therefore removed when sending it to the newInstanceMethods[method]
      // because the express application expects a function
      const [secondLastArg] = middlewareArgs.slice(-2);
      middlewareArgs = middlewareArgs.slice(0, middlewareArgs.length - 1);
      handleLastArg(appInstance, secondLastArg, firstArg, method, lastArg);
    }
  }
  // This needs to return the output of the bound method's function
  // Do not return before this stage
  return newInstanceMethods[method](...middlewareArgs);
};

/**
 * Replaces the methods of the given instance with that which will allow us to capture the route
 * definition and document it with swagger
 * The app methods being replaced include app.all, app.use, app.[HTTP method] e.g, app.get
 * @param {express} appInstance The express application instance whose methods need to be replaced
 * @returns {express} the express app instance having successfully replaced its methods */
const replaceMethods = (appInstance) => {
  // The new instance methods that point to the original function definitions for the app instance
  // Here we bind the appInstance, so that "this" refers to the
  // appInstance when the method is called
  const newInstanceMethods = {
    use: appInstance.use.bind(appInstance),
    all: appInstance.all.bind(appInstance),
  };

  // Loop one by one adding the original function definitions to the newInstanceMethods object
  // only if the appInstance exposes the said HTTP method
  Utils.loopSequentially(httpMethods, (method) => {
    newInstanceMethods[method] = appInstance[method] && appInstance[method].bind(appInstance);
  });

  // Loop one by one replacing the appInstance's methods found in the keys of the
  // newInstanceMethods with our own function that passes the arguments to our swagger
  // handler which will then handle the addition of the paths, if any, to the swagger schema
  Utils.loopSequentially(Object.keys(newInstanceMethods), (method) => {
    if (method) {
      /* eslint-disable-next-line no-param-reassign */
      appInstance[method] = (...args) => swaggerHandler(
        appInstance, newInstanceMethods, method, ...args,
      );
    }
  });

  return appInstance;
};
/**
 * Validates the OAS3 Object then replaces the app's methods
 * @param {express} appInstance The express application instance whose methods need to be replaced
 * @param {Object} basicOAS3Object The basic OAS3 object
 * @returns {express} the express app instance having successfully replaced its methods */
const generateSwagger = (appInstance, basicOAS3Object) => {
  /* eslint-disable-next-line no-param-reassign */
  appInstance.schema = basicOAS3Object;

  // TODO Validate the basicOAS3Object
  return replaceMethods(appInstance);
};


/**
 * This method generates a url from the server's address.
 * @param {Server} serverInstance The instance of the http server from which we will get the address
 * @param {express} appInstance The express application instance whose methods need to be replaced
 * @return {string} The full url from where the app can be reached
 */
export const addServer = (serverInstance, appInstance) => {
  // TODO Handle the different NODE_ENVS better.
  const addr = serverInstance.address();
  let url = `https://${addr.address}`;
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    url = `http://localhost:${addr.port}`;
  }
  appInstance.schema.servers.push({ url });
};

export default generateSwagger;
