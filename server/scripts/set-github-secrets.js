import sodium from 'libsodium-wrappers';

const token = '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';
const repo = 'ableuse3251/neon-orbit';

const secrets = {
  TELEGRAM_BOT_TOKEN: '8611883429:AAEvNHuFSO5De5LMXuIcHoVBRACQMqlP70Y',
  BOT_USERNAME: 'Neon_orbitbot',
  ADMIN_TELEGRAM_IDS: '1673315676',
  WEBHOOK_SECRET: 'AMGLCWQY',
  JWT_SECRET: 'AMGLCWQY',
  METRICS_SECRET: 'AMGLCWQY',
  DATABASE_URL: 'https://zqymhgfwqtqjqqcqfeie.supabase.co/rest/v1/',
  REDIS_URL: 'rediss://default:gQAAAAAAAsn9AAIgcDFhNTdmOWI1OWIyZDg0ZGRhYjM3OGY0ZDlmNTIwNmFiNg@romantic-griffon-182781.upstash.io:6379',
  GEMINI_API_KEY: 'AQ.Ab8RN6ICYTfJ4AUL0ZBU3YtQZnNgtLg_YvFq9_qhQMiDk1EvTA',
  NODE_ENV: 'production',
  DEV_AUTH_BYPASS: 'false',
};

async function main() {
  await sodium.ready;

  // 1. Fetch public key
  const pkRes = await fetch(`https://api.github.com/repos/${repo}/actions/secrets/public-key`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'NodeScript',
    },
  });

  if (!pkRes.ok) {
    throw new Error(`Failed to fetch public key: ${pkRes.status} ${await pkRes.text()}`);
  }

  const { key_id, key } = await pkRes.json();
  const publicKeyBytes = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);

  for (const [secretName, secretValue] of Object.entries(secrets)) {
    const messageBytes = sodium.from_string(secretValue);
    const encryptedBytes = sodium.crypto_box_seal(messageBytes, publicKeyBytes);
    const encryptedBase64 = sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);

    const putRes = await fetch(`https://api.github.com/repos/${repo}/actions/secrets/${secretName}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'NodeScript',
      },
      body: JSON.stringify({
        encrypted_value: encryptedBase64,
        key_id,
      }),
    });

    if (putRes.status === 201 || putRes.status === 204) {
      console.log(`Successfully updated GitHub Secret: ${secretName}`);
    } else {
      console.error(`Failed to update GitHub Secret ${secretName}: ${putRes.status} ${await putRes.text()}`);
    }
  }
}

main().catch((err) => {
  console.error('Error setting GitHub Secrets:', err);
  process.exit(1);
});
