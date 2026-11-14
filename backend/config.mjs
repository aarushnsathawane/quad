import { resolve } from 'node:path';
export function readConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const origin = env.APP_ORIGIN || env.RENDER_EXTERNAL_URL || 'http://localhost:8080';
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin)
    throw new Error('APP_ORIGIN must be an origin without a path or trailing slash');
  const secret =
    env.AUTH_SECRET || (production ? '' : 'local-only-quad-development-secret-change-me');
  if (secret.length < 32) throw new Error('AUTH_SECRET must contain at least 32 characters');
  if (production && url.protocol !== 'https:')
    throw new Error('Production APP_ORIGIN must use HTTPS');
  const domains = (env.SCHOOL_EMAIL_DOMAINS || 'rutgers.edu,scarletmail.rutgers.edu')
    .split(',')
    .map((s) => s.trim().toLowerCase());
  if (!domains.every((s) => /^(?:[a-z0-9-]+\.)*rutgers\.edu$/.test(s)))
    throw new Error('Only Rutgers email domains are enabled for this pilot');
  const adminEmails = (env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const config = {
    production,
    origin,
    secret,
    domains,
    adminEmails,
    dbPath: env.QUAD_DB || resolve('data/production.sqlite'),
    webRoot: resolve(env.WEB_ROOT || 'apps/mobile/dist'),
    port: Number(env.PORT || 8080),
    host: env.HOST || '127.0.0.1',
    trustProxy: env.TRUST_PROXY === '1' ? 1 : false,
    supportEmail: env.SUPPORT_EMAIL || '',
    smtp: {
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT || 587),
      secure: env.SMTP_SECURE === 'true',
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      from: env.MAIL_FROM,
    },
    tiles: env.MAP_TILE_URL || '',
    tileAttribution: env.MAP_ATTRIBUTION || '',
    backup: {
      bucket: env.BACKUP_BUCKET,
      region: env.BACKUP_REGION || 'us-east-1',
      endpoint: env.BACKUP_ENDPOINT,
      accessKey: env.BACKUP_ACCESS_KEY,
      secretKey: env.BACKUP_SECRET_KEY,
      key: env.BACKUP_KEY,
    },
  };
  if (production) {
    for (const key of [
      'SMTP_HOST',
      'SMTP_USER',
      'SMTP_PASSWORD',
      'MAIL_FROM',
      'SUPPORT_EMAIL',
      'ADMIN_EMAILS',
      'MAP_TILE_URL',
      'MAP_ATTRIBUTION',
      'BACKUP_BUCKET',
      'BACKUP_ACCESS_KEY',
      'BACKUP_SECRET_KEY',
      'BACKUP_KEY',
    ])
      if (!env[key]) throw new Error(`${key} is required in production`);
    if (config.backup.key.length < 32)
      throw new Error('BACKUP_KEY must contain at least 32 characters');
    if (!resolve(config.dbPath).startsWith('/data/'))
      throw new Error('Production QUAD_DB must be on the persistent /data volume');
    if (!config.adminEmails.every((email) => domains.some((d) => email.endsWith('@' + d))))
      throw new Error('Admins must use approved Rutgers email addresses');
    if (!config.tiles.startsWith('https://')) throw new Error('Map tiles must use HTTPS');
  }
  return config;
}
