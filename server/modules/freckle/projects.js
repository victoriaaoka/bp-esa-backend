import axios from 'axios';
import dotenv from 'dotenv';

import response from '../../helpers/response';

dotenv.config();

const freckleUrl = 'https://api.letsfreckle.com/v2';
const freckleToken = process.env.FRECKLE_ADMIN_TOKEN;

/**
 * @function
 * @desc - An asynchronous function to get all projects from freckle.
 * @returns {Array} - If freckle-api transaction success, it returns a list of project.
 * @returns {Object} - If freckle-api transaction fail, it returns the transaction error.
 */
export async function getAllProjects() {
  try {
    const projects = await axios.get(`${freckleUrl}/projects?freckle_token=${freckleToken}`);
    return projects.data;
  } catch (e) {
    return e.data;
  }
}

/**
 * @function
 * @desc - A function to check/verify if a project already exist in a list of freckle projects.
 * @param {Array} projects - The list of freckle projects.
 * @param {String} projectName - The name of the project to check.
 * @returns {Boolean} - A truthy value representing if the project exist or not.
 */
const verifyExistingProject = (projects, projectName) => {
  const project = projects.filter(eachProject => eachProject.name === projectName);
  if (!project.length) {
    return false;
  }
  return true;
};

/**
 * @function
 * @desc - An asynchronous function to create a new project on freckle.
 * @param {String} projectName The name of the project to be created.
 * @returns {Object} If freckle-api transaction success, it return a success response object.
 * @returns {Object} - If freckle-api transaction fail, it return an error response object.
 */
export const createProject = async (projectName) => {
  try {
    const projects = await getAllProjects();
    if (projects && projects.length > 0 && !verifyExistingProject(projects, projectName)) {
      await axios.post(`${freckleUrl}/projects?freckle_token=${freckleToken}`, {
        name: projectName,
      });
      return response(false, `${projectName} project successfully added`);
    }
    return response(false, `${projectName} project already created`);
  } catch (e) {
    return response(true, `Error occurred creating ${projectName} project`);
  }
};

/**
 * @desc Assign a user to a project on freckle
 *
 * @param {number} userId - Id of the user to be assigned to a project
 * @param {array} projectIds - Array of integer projectIds to be assigned to the user.
 *
 * @returns {promise} - Axios response for request to assign user to freckle project
 */
export const assignProject = (userId, projectIds) => {
  const url = `${freckleUrl}/users/${userId}/give_access_to_projects?freckle_token=${freckleToken}`;
  return axios
    .put(url, {
      project_ids: projectIds,
    })
    .then(() => response(false, 'Successfully added developer to the project'))
    .catch(error => response(true, error));
};
