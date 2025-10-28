import {
    DT_TENANT,
    DT_API_TOKEN
} from '$env/static/private';

(async () => {
  try {
    const oneAgent = await import('@dynatrace/oneagent');
    oneAgent.default({
        environmentid: DT_TENANT,
        apitoken: DT_API_TOKEN
    });
  } catch (err) {
    console.log('Failed to load OneAgent: ', err);
  }
})();
