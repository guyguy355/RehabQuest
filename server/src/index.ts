import { createApp } from './app.js';
import { config, getJwtSecret } from './config.js';

// Fail fast on a missing or weak secret instead of failing on the first login.
getJwtSecret();

createApp().listen(config.port, () => {
  console.log(`RehabQuest API running on http://localhost:${config.port}`);
  console.log(`Summary drafts: ${config.ai.provider === 'anthropic' && process.env.ANTHROPIC_API_KEY ? `model ${config.ai.model}` : 'rule-based only (no AI provider configured)'}`);
});
