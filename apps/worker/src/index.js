const { createClient } = require('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6378';
const WORKER_QUEUE = 'todo_events';

const client = createClient({ url: REDIS_URL });
client.on('error', (err) => console.error('Redis Client Error', err));

async function processEvent(rawEvent) {
  try {
    const event = JSON.parse(rawEvent);
    switch (event.type) {
      case 'TODO_CREATED':
        console.log(`[worker] New todo created: "${event.todo.title}" (id: ${event.todo.id})`);
        break;
      case 'TODO_UPDATED':
        console.log(`[worker] Todo updated: "${event.todo.title}" (id: ${event.todo.id}, completed: ${event.todo.completed})`);
        break;
      case 'TODO_DELETED':
        console.log(`[worker] Todo deleted: "${event.todo.title}" (id: ${event.todo.id})`);
        break;
      default:
        console.log('[worker] Unknown event received:', event);
    }
    // This is where real work would happen, e.g:
    // - send an email/push notification
    // - update analytics
    // - sync to another system
  } catch (err) {
    console.error('[worker] Failed to process event', err, rawEvent);
  }
}

async function main() {
  await client.connect();
  console.log('[worker] Connected to Redis, waiting for todo events...');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // Blocking pop, waits up to 5s for an item before looping again
      const result = await client.brPop(WORKER_QUEUE, 5);
      if (result) {
        await processEvent(result.element);
      }
    } catch (err) {
      console.error('[worker] Error while polling queue', err);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

main();
