import * as GoogleCloudTasks from '@google-cloud/tasks';

const cloudTasksClient = new GoogleCloudTasks.CloudTasksClient();

const project = process.env.NODE_ENV as string === 'production' ? 'kios-master' : 'project-arya-280418';
const location = 'us-central1';

export async function createHttpTask(queue: string, url: string, payload: string) {
  // Construct the fully qualified queue name.
  const parent = cloudTasksClient.queuePath(project, location, queue);
  const task: GoogleCloudTasks.protos.google.cloud.tasks.v2.ITask = {
    httpRequest: {
      httpMethod: 'POST',
      url,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(payload).toString('base64'),
    },
  };

  const request = { parent, task };
  await cloudTasksClient.createTask(request);
}
