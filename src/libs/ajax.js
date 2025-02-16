import fileDownload from 'js-file-download';
import * as fp from 'lodash/fp';
import {cloneDeep, flow, getOr, isNil, uniq, unset} from 'lodash/fp';
import {Config} from './config';
import {spinnerService} from './spinner-service';
import {StackdriverReporter} from './stackdriverReporter';
import {Storage} from './storage';
import axios from 'axios';
import {isFileEmpty} from './utils';

//define axios interceptor
//to log out user and redirect to home when response has 401 status
//return responses with statuses in the 200s and reject the rest
const redirectOnLogout = () => {
  Storage.clearStorage();
  window.location.href = `/home?redirectTo=${window.location.pathname}`;
};

axios.interceptors.response.use(function (response) {
  return response;
}, function (error) {
  // Default to a 502 when we can't get a real response object.
  const status = getOr(502)('response.status')(error);
  if (status === 401) {
    redirectOnLogout();
  }

  const reportUrl = getOr(null)('response.config.url')(error);
  if (!isNil(reportUrl) && status >= 500) {
    reportError(reportUrl, status);
  }

  return Promise.reject(error);
});

export const getApiUrl = async(baseUrl = '') => {
  const env = await Config.getEnv();
  return env === 'local' ? baseUrl : await Config.getApiUrl();
};

export const getBardApiUrl = async() => {
  return await Config.getBardApiUrl();
};

export const getOntologyUrl = async(baseUrl = '') => {
  const env = await Config.getEnv();
  return env === 'local' ? baseUrl : await Config.getOntologyApiUrl();
};

export const DAC = {

  list: async (withUsers) => {
    const url = `${await getApiUrl()}/api/dac` + (fp.isEmpty(withUsers) ? '' : `?withUsers=${withUsers}`);
    const res = await fetchOk(url, Config.authOpts());
    return res.json();
  },

  create: async (name, description, email) => {
    const url = `${await getApiUrl()}/api/dac`;
    const dac = { name, description, email };
    const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), Config.jsonBody(dac), { method: 'POST' }]));
    return res.json();
  },

  update: async (dacId, name, description, email) => {
    const url = `${await getApiUrl()}/api/dac`;
    const dac = { dacId, name, description, email };
    const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), Config.jsonBody(dac), { method: 'PUT' }]));
    return res.json();
  },

  delete: async (dacId) => {
    const url = `${await getApiUrl()}/api/dac/${dacId}`;
    const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), { method: 'DELETE' }]));
    //we do not call .json() on res because the response has no body
    return res;
  },

  get: async (dacId) => {
    const url = `${await getApiUrl()}/api/dac/${dacId}`;
    const res = await fetchOk(url, Config.authOpts());
    return res.json();
  },

  datasets: async (dacId) => {
    const url = `${await getApiUrl()}/api/dac/${dacId}/datasets`;
    const res = await fetchOk(url, Config.authOpts());
    return res.json();
  },

  autocompleteUsers: async (term) => {
    const url = `${await getApiUrl()}/api/dac/users/${term}`;
    const res = await fetchOk(url, Config.authOpts());
    return res.json();
  },

  addDacChair: async (dacId, userId) => {
    const url = `${await getApiUrl()}/api/dac/${dacId}/chair/${userId}`;
    const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), { method: 'POST' }]));
    return res.status;
  },

  removeDacChair: async (dacId, userId) => {
    const url = `${await getApiUrl()}/api/dac/${dacId}/chair/${userId}`;
    const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), { method: 'DELETE' }]));
    return res.status;
  },

  updateApprovalStatus: async (dacId, datasetId, approvalStatus) => {
    const url = `${await getApiUrl()}/api/dac/${dacId}/dataset/${datasetId}`;
    const approval = { 'approval': approvalStatus };
    const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), Config.jsonBody(approval), { method: 'PUT' }]));
    return res.json();
  },

  addDacMember: async (dacId, userId) => {
    const url = `${await getApiUrl()}/api/dac/${dacId}/member/${userId}`;
    const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), { method: 'POST' }]));
    return res.status;
  },

  removeDacMember: async (dacId, userId) => {
    const url = `${await getApiUrl()}/api/dac/${dacId}/member/${userId}`;
    const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), { method: 'DELETE' }]));
    return res.status;
  }
};

export const Collections = {
  cancelCollection: async(id, roleName) => {
    const url = `${await getApiUrl()}/api/collections/${id}/cancel`;
    const config = Object.assign({params: {roleName}}, Config.authOpts());
    const res = await axios.put(url, {}, config);
    return res.data;
  },
  reviseCollection: async(id) => {
    const url = `${await getApiUrl()}/api/collections/${id}/resubmit`;
    const res = await axios.put(url, {}, Config.authOpts());
    return res.data;
  },
  getCollectionById: async(id) => {
    const url = `${await getApiUrl()}/api/collections/${id}`;
    const res = await axios.get(url, Config.authOpts());
    return res.data;
  },
  getCollectionSummariesByRoleName: async(roleName) => {
    const url = `${await getApiUrl()}/api/collections/role/${roleName}/summary`;
    const res = await axios.get(url, Config.authOpts());
    return res.data;
  },
  getCollectionSummaryByRoleNameAndId: async({roleName, id}) => {
    const url = `${await getApiUrl()}/api/collections/role/${roleName}/summary/${id}`;
    const res = await axios.get(url, Config.authOpts());
    return res.data;
  },
  openElectionsById: async(id) => {
    const url = `${await getApiUrl()}/api/collections/${id}/election`;
    const res = await axios.post(url, {}, Config.authOpts());
    return res.data;
  }
};

export const DAR = {

  //v2 get for DARs
  getPartialDarRequest: async darId => {
    const url = `${await getApiUrl()}/api/dar/v2/${darId}`;
    const res = await fetchOk(url, Config.authOpts());
    return await res.json();
  },

  //v2 update for dar partials
  updateDarDraft: async (dar, referenceId) => {
    const url = `${await getApiUrl()}/api/dar/v2/draft/${referenceId}`;
    const res = await axios.put(url, dar, Config.authOpts());
    return res.data;
  },

  //api endpoint for v2 draft submission
  postDarDraft: async(dar) => {
    const url = `${await getApiUrl()}/api/dar/v2/draft/`;
    const res = await axios.post(url, dar, Config.authOpts());
    return res.data;
  },

  //v2 delete dar
  deleteDar: async (darId) => {
    const url = `${await getApiUrl()}/api/dar/v2/${darId}`;
    const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), { method: 'DELETE' }]));
    return await res;
  },

  //v2 endpoint for DAR POST
  postDar: async (dar) => {
    const filteredDar = fp.omit(['createDate', 'sortDate', 'data_access_request_id'])(dar);
    const url = `${await getApiUrl()}/api/dar/v2`;
    const res = axios.post(url, filteredDar, Config.authOpts());
    return await res.data;
  },

  getAutoCompleteOT: async partial => {
    const url = `${await getOntologyUrl()}/autocomplete?q=${partial}`;
    const res = await fetchOk(url, Config.authOpts());
    return await res.json();
  },

  searchOntologyIdList: async ids => {
    if (isNil(ids) || ids.length === 0) {
      return [];
    }
    const url = `${await getOntologyUrl()}/search?id=${ids}`;
    const res = await fetchAny(url, Config.authOpts());
    if (res.status >= 400) {
      return [];
    }
    return await res.json();
  },

  downloadDARDocument: async (referenceId, fileType, fileName) => {
    const authOpts = Object.assign(Config.authOpts(), {responseType: 'blob'});
    authOpts.headers = Object.assign(authOpts.headers, {
      'Content-Type': 'application/octet-stream',
      'Accept': 'application/octet-stream'
    });
    const url = `${await getApiUrl()}/api/dar/v2/${referenceId}/${fileType}`;
    axios.get(url, authOpts).then((response) =>{
      fileDownload(response.data, fileName);
    });
  },

  //NOTE: endpoints requires a dar id
  uploadDARDocument: async(file, darId, fileType) => {
    if(isFileEmpty(file)) {
      return Promise.resolve({data: null});
    } else {
      let authOpts = Config.authOpts();
      authOpts.headers['Content-Type'] = 'multipart/form-data';
      let formData = new FormData();
      formData.append('file', file);
      const url = `${await getApiUrl()}/api/dar/v2/${darId}/${fileType}`;
      return axios.post(url, formData, authOpts);
    }
  }
};

export const DataSet = {

  getDatasetNames: async () => {
    const url = `${await getApiUrl()}/api/dataset/datasetNames`;
    const res = await axios.get(url, Config.authOpts());
    return await res.data;
  },

  getRegistrationSchema: async () => {
    const url = `${await getApiUrl()}/schemas/dataset-registration/v1`;
    const res = await axios.get(url, Config.authOpts());
    return await res.data;
  },

  postDatasetForm: async (form) => {
    const url = `${await getApiUrl()}/api/dataset/v2`;
    const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), Config.jsonBody(form), { method: 'POST' }]));
    return await res.json();
  },

  registerDataset: async (registration) => {
    const url = `${await getApiUrl()}/api/dataset/v3`;
    const res = await axios.post(url, registration, Config.multiPartOpts());
    return res.data;
  },

  getDatasets: async () => {
    const url = `${await getApiUrl()}/api/dataset/v2`;
    const res = await fetchOk(url, Config.authOpts());
    return await res.json();
  },

  getDatasetsByIds: async (ids) => {
    const url = `${await getApiUrl()}/api/dataset/batch?ids=${ids.join('&ids=')}`;
    const res = await fetchOk(url, Config.authOpts());
    return await res.json();
  },

  autocompleteDatasets: async (query) => {
    const url = `${await getApiUrl()}/api/dataset/autocomplete?query=${query}`;
    const res = await fetchOk(url, Config.authOpts());
    return await res.json();
  },

  searchDatasetIndex: async (query) => {
    const url = `${await getApiUrl()}/api/dataset/search/index`;
    const res = await axios.post(url, query, Config.authOpts());
    return res.data;
  },

  getDataSetsByDatasetId: async dataSetId => {
    const url = `${await getApiUrl()}/api/dataset/v2/${dataSetId}`;
    const res = await fetchOk(url, Config.authOpts());
    return await res.json();
  },

  downloadDataSets: async (objectIdList, fileName) => {
    const url = `${await getApiUrl()}/api/dataset/download`;
    const res = await fetchOk(url, fp.mergeAll([Config.jsonBody(objectIdList), Config.fileOpts(), { method: 'POST' }]));

    fileName = fileName === null ? getFileNameFromHttpResponse(res) : fileName;
    const responseObj = await res.json();

    let blob = new Blob([responseObj.datasets], { type: 'text/plain' });
    const urlBlob = window.URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = urlBlob;
    a.download = fileName;
    a.click();
  },

  deleteDataset: async (datasetObjectId) => {
    const url = `${await getApiUrl()}/api/dataset/${datasetObjectId}`;
    const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), { method: 'DELETE' }]));
    return await res;
  },

  updateDataset: async (datasetId, dataSetObject) => {
    const url = `${await getApiUrl()}/api/dataset/${datasetId}`;
    return await fetchOk(url, fp.mergeAll([Config.authOpts(), Config.jsonBody(dataSetObject), {method: 'PUT'}]));
  },

  updateDatasetV3: async (datasetId, datasetAndFiles) => {
    const url = `${await getApiUrl()}/api/dataset/v3/${datasetId}`;
    const res = await axios.put(url, datasetAndFiles, Config.multiPartOpts());
    return res.data;
  },

  validateDatasetName: async (name) => {
    const url = `${await getApiUrl()}/api/dataset/validate?name=${name}`;
    try {
      // We expect a 404 in the case where the dataset name does not exist
      const res = await fetchAny(url, fp.mergeAll([Config.authOpts(), {method: 'GET'}]));
      if (res.status === 404) {
        return -1;
      }
      return await res.json();
    }
    catch (err) {
      return -1;
    }
  },

  getStudyById: async studyId => {
    const url = `${await getApiUrl()}/api/dataset/study/${studyId}`;
    const res = await fetchOk(url, Config.authOpts());
    return await res.json();
  },

  updateStudy: async (studyId, studyObject) => {
    const url = `${await getApiUrl()}/api/dataset/study/${studyId}`;
    return await axios.put(url, studyObject, Config.multiPartOpts());
  },

  getDatasetByDatasetIdentifier: async datasetIdentifier => {
    const url = `${await getApiUrl()}/api/tdr/${datasetIdentifier}`;
    const res = await axios.get(url, Config.authOpts());
    return res.data;
  }
};

export const Study = {

  getStudyNames: async () => {
    const url = `${await getApiUrl()}/api/dataset/studyNames`;
    const res = await fetchOk(url, Config.authOpts());
    return await res.json();
  }

};

export const Email = {
  sendReminderEmail: async (voteId) => {
    const url = `${await getApiUrl()}/api/emailNotifier/reminderMessage/${voteId}`;
    const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), { method: 'POST' }]));
    return res;
  }
};

export const Metrics = {

  getDatasetStats: async (datasetId) => {
    const url = `${await getApiUrl()}/metrics/dataset/${datasetId}`;
    const res = await fetchOk(url, Config.authOpts());
    return await res.json();
  }
};

export const Support = {

  createTicket: (name, type, email, subject, description, attachmentToken, url) => {
    const ticket = {};

    ticket.request = {
      requester: { name: name, email: email },
      subject: subject,
      // BEWARE changing the following ids or values! If you change them then you must thoroughly test.
      custom_fields: [
        { id: 360012744452, value: type},
        { id: 360007369412, value: description},
        { id: 360012744292, value: name},
        { id: 360012782111, value: email },
        { id: 360018545031, value: email }
      ],
      comment: {
        body: description + '\n\n------------------\nSubmitted from: ' + url,
        uploads: attachmentToken
      },
      ticket_form_id: 360000669472
    };

    return ticket;

  },
  createSupportRequest: async (ticket) => {
    const res = await fetchAny('https://broadinstitute.zendesk.com/api/v2/requests.json', fp.mergeAll([Config.jsonBody(ticket), { method: 'POST' }]));
    return await res;
  },

  uploadAttachment: async (file) => {
    const res = await fetchAny('https://broadinstitute.zendesk.com/api/v2/uploads?filename=Attachment', fp.mergeAll([Config.attachmentBody(file), { method: 'POST' }]));
    return (await res.json()).upload;
  },
};

export const Match = {

  findMatchBatch: async (purposeIdsArr = []) => {
    const purposeIds = uniq(purposeIdsArr).join(',');
    const url = `${await getApiUrl()}/api/match/purpose/batch`;
    const config = Object.assign({}, Config.authOpts(), {params: { purposeIds}});
    const res = await axios.get(url, config);
    return res.data;
  }
};

export const User = {

  getMe: async () => {
    const url = `${await getApiUrl()}/api/user/me`;
    const res = await axios.get(url, Config.authOpts());
    return res.data;
  },

  getById: async id => {
    const url = `${await getApiUrl()}/api/user/${id}`;
    const res = await axios.get(url, Config.authOpts());
    return res.data;
  },

  list: async roleName => {
    const url = `${await getApiUrl()}/api/user/role/${roleName}`;
    const res = await fetchOk(url, Config.authOpts());
    return res.json();
  },

  create: async user => {
    const url = `${await getApiUrl()}/api/dacuser`;
    try {
      const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), Config.jsonBody(user), { method: 'POST' }]));
      if (res.ok) {
        return res.json;
      }
    } catch (err) {
      return false;
    }
  },

  updateSelf: async (payload) => {
    const url = `${await getApiUrl()}/api/user`;
    // We should not be updating the user's create date, associated institution, or library cards
    try {
      const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), Config.jsonBody(payload), { method: 'PUT' }]));
      if (res.ok) {
        return res.json();
      }
    } catch (err) {
      return false;
    }
  },

  update: async (user, userId) => {
    const url = `${await getApiUrl()}/api/user/${userId}`;
    // We should not be updating the user's create date, associated institution, or library cards
    let filteredUser = flow(
      cloneDeep,
      unset('updatedUser.createDate'),
      unset('updatedUser.institution'),
      unset('updatedUser.libraryCards')
    )(user);
    try {
      const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), Config.jsonBody(filteredUser), { method: 'PUT' }]));
      if (res.ok) {
        return res.json();
      }
    } catch (err) {
      return false;
    }
  },

  registerUser: async () => {
    const url = `${await getApiUrl()}/api/user`;
    const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), { method: 'POST' }]));
    return res.json();
  },

  getSOsForCurrentUser: async () => {
    const url = `${await getApiUrl()}/api/user/signing-officials`;
    const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), { method: 'GET' }]));
    return res.json();
  },

  getUnassignedUsers: async () => {
    const url = `${await getApiUrl()}/api/user/institution/unassigned`;
    const res = await axios.get(url, Config.authOpts());
    return res.data;
  },

  addRoleToUser: async (userId, roleId) => {
    const url = `${await getApiUrl()}/api/user/${userId}/${roleId}`;
    const res = await fetchAny(url, fp.mergeAll([Config.authOpts(), { method: 'PUT' }]));
    return res.json();
  },

  deleteRoleFromUser: async (userId, roleId) => {
    const url = `${await getApiUrl()}/api/user/${userId}/${roleId}`;
    const res = await fetchAny(url, fp.mergeAll([Config.authOpts(), { method: 'DELETE' }]));
    return res.json();
  },
  getUserRelevantDatasets: async() => {
    const url = `${await getApiUrl()}/api/user/me/dac/datasets`;
    const res = await axios.get(url, Config.authOpts());
    return res.data;
  },
  getAcknowledgements: async () => {
    const url = `${await getApiUrl()}/api/user/acknowledgements`;
    const res = await axios.get(url, Config.authOpts());
    return res.data;
  },
  acceptAcknowledgments: async (...keys) => {
    if (keys.length === 0) {
      return {};
    }

    const url = `${await getApiUrl()}/api/user/acknowledgements`;
    const res = await axios.post(url, keys, Config.authOpts());
    return res.data;
  },
  getApprovedDatasets: async () => {
    const url = `${await getApiUrl()}/api/user/me/researcher/datasets`;
    const res = await axios.get(url, Config.authOpts());
    return res.data;
  }
};

export const Votes = {

  updateVotesByIds: async (voteIds, vote) => {
    const voteUpdate = {};
    voteUpdate.vote = vote.vote;
    voteUpdate.rationale = vote.rationale;
    voteUpdate.voteIds = voteIds;

    let url = `${await getApiUrl()}/api/votes`;
    const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), Config.jsonBody(voteUpdate), { method: 'PUT' }]));
    return await res.json();
  },

  updateRationaleByIds: async (voteIds, rationale) => {
    const rationaleUpdate = {};
    rationaleUpdate.rationale = rationale;
    rationaleUpdate.voteIds = voteIds;

    let url = `${await getApiUrl()}/api/votes/rationale`;
    const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), Config.jsonBody(rationaleUpdate), { method: 'PUT' }]));
    return await res.json();
  }
};

export const AuthenticateNIH = {

  saveNihUsr: async (decodedData) => {
    const url = `${await getApiUrl()}/api/nih`;
    const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), Config.jsonBody(decodedData), { method: 'POST' }]));
    return await res.json();
  },

  deleteAccountLinkage: async () => {
    const url = `${await getApiUrl()}/api/nih`;
    const res = await fetchOk(url, fp.mergeAll([Config.authOpts(), { method: 'DELETE' }]));
    return await res;
  },

};

export const Institution = {
  list: async () => {
    const url = `${await getApiUrl()}/api/institutions`;
    const res = await fetchOk(url, Config.authOpts());
    return res.json();
  },

  getById: async (id) => {
    const url = `${await getApiUrl()}/api/institutions/${id}`;
    const res = await fetchOk(url, Config.authOpts());
    return res.json();
  },

  postInstitution: async (institution) => {
    const url = `${await getApiUrl()}/api/institutions`;
    const res = await axios.post(url, institution, Config.authOpts());
    return res.data;
  },

  putInstitution: async (id, institution) => {
    const url = `${await getApiUrl()}/api/institutions/${id}`;
    const res = await axios.put(url, institution, Config.authOpts());
    return res.data;
  },

  deleteInstitution: async (id) => {
    const url = `${await getApiUrl()}/api/institutions/${id}`;
    return await fetchOk(url, fp.mergeAll([Config.authOpts(), { method: 'DELETE' }]));
  }
};

export const Schema = {
  datasetRegistrationV1: async () => {
    const url = `${await getApiUrl()}/schemas/dataset-registration/v1`;
    const res = await axios.get(url, Config.authOpts());
    return res.data;
  }
};

export const LibraryCard = {
  getAllLibraryCards: async () => {
    const url = `${await getApiUrl()}/api/libraryCards`;
    const res = await axios.get(url, Config.authOpts());
    return res.data;
  },
  createLibraryCard: async (card) => {
    const url = `${await getApiUrl()}/api/libraryCards`;
    const res = await axios.post(url, card, Config.authOpts());
    return res.data;
  },
  updateLibraryCard: async (card) => {
    const url = `${await getApiUrl()}/api/libraryCards/${card.id}`;
    const res = await axios.put(url, card, Config.authOpts());
    return res.data;
  },
  deleteLibraryCard: async (id) => {
    const url = `${await getApiUrl()}/api/libraryCards/${id}`;
    return await axios.delete(url, Config.authOpts());
  }
};

export const ToS = {
  getDUOSText: async () => {
    const env = await Config.getEnv();
    // When running locally, '/api' urls are rewritten in `setupProxy.js` so they're forwarded properly to the back end
    const baseUrl = env === 'local' ? '/api' : '';
    const url = `${await getApiUrl(baseUrl)}/tos/text/duos`;
    const res = await axios.get(url, Config.textPlain());
    return res.data;
  },
  /**
   * Returns a json structure of various statuses for an authenticated user.
   * See https://consent.dsde-prod.broadinstitute.org/#/Sam/get_api_sam_register_self_diagnostics
   * for more info.
   * {
   *   'adminEnabled': false,
   *   'enabled': false,
   *   'inAllUsersGroup': true,
   *   'inGoogleProxyGroup': false,
   *   'tosAccepted': true
   * }
   * @returns {Promise<any>}
   */
  getStatus: async () => {
    const url = `${await getApiUrl()}/api/sam/register/self/diagnostics`;
    const res = await axios.get(url, Config.authOpts());
    return res.data;
  },
  acceptToS: async () => {
    const url = `${await getApiUrl()}/api/sam/register/self/tos`;
    const res = await axios.post(url, {}, Config.authOpts());
    return res.data;
  },
  rejectToS: async () => {
    const url = `${await getApiUrl()}/api/sam/register/self/tos`;
    const res = await axios.delete(url, Config.authOpts());
    return res.data;
  }
};

export const Translate = {
  translate: async (body) => {
    const url = `${await getOntologyUrl()}/translate/paragraph`;
    const res = await axios.post(url, body, Config.authOpts());
    return res.data;
  },
};

const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const TerraDataRepo = {
  listSnapshotsByDatasetIds: async (identifiers) => {
    // Note that TDR is expecting dataset identifiers, not dataset ids
    const url = `${await Config.getTdrApiUrl()}/api/repository/v1/snapshots?duosDatasetIds=${identifiers.join('&duosDatasetIds=')}`;
    const res = await axios.get(url, Config.authOpts());
    return res.data;
  },

  prepareExport: async (snapshotId) => {
    const url = `${await Config.getTdrApiUrl()}/api/repository/v1/snapshots/${snapshotId}/export`;
    const res = await axios.get(url, Config.authOpts());
    return res.data;
  },

  waitForJob: async (jobId) => {
    const url = `${await Config.getTdrApiUrl()}/api/repository/v1/jobs/${jobId}`;
    const resultsUrl = `${await Config.getTdrApiUrl()}/api/repository/v1/jobs/${jobId}/result`;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await axios.get(url, Config.authOpts());
      if (res.data.job_status === 'running') {
        await sleep(1000);
      } else if (res.data.job_status === 'succeeded') {
        const finalResult = await axios.get(resultsUrl, Config.authOpts());
        // Add the URL to link to
        finalResult.data.terraImportLink =
        `${await Config.getTerraUrl()}/#import-data?url=${window.location.origin}&snapshotId=${finalResult.data.snapshot.id}&format=tdrexport&snapshotName=${finalResult.data.snapshot.name}&tdrmanifest=${encodeURIComponent(finalResult.data.format.parquet.manifest)}&tdrSyncPermissions=false`;
        return finalResult.data;
      } else if (res.data.job_status === 'failed') {
        return reportError(url, res.data.status_code);
      }
    }
  },
};

const fetchOk = async (...args) => {
  //TODO: Remove spinnerService calls
  spinnerService.showAll();
  const res = await fetch(...args);
  if (!res.ok && res.status === 401) {
    redirectOnLogout();
  }
  if (res.status >= 400) {
    await reportError(args[0], res.status);
  }
  spinnerService.hideAll();
  return res.ok ? res : Promise.reject(res);
};

const fetchAny = async (...args) => {
  //TODO: Remove spinnerService calls
  spinnerService.showAll();
  const res = await fetch(...args);
  if (!res.ok && res.status === 401) {
    redirectOnLogout();
  }
  if (res.status >= 500) {
    await reportError(args[0], res.status);
  }
  spinnerService.hideAll();
  return res;
};

const getFileNameFromHttpResponse = (response) => {
  const respHeaders = response.headers;
  return respHeaders.get('Content-Disposition').split(';')[1].trim().split('=')[1];
};

const reportError = async (url, status) => {
  const msg = 'Error fetching response: '
    .concat(JSON.stringify(url))
    .concat('Status: ')
    .concat(status);
  await StackdriverReporter.report(msg);
};
