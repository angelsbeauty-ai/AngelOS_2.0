const staticConfig = require('./app.json');

const appEnv = process.env.EXPO_PUBLIC_APP_ENV || 'development';
const isProduction = appEnv === 'production';
const isStaging = appEnv === 'staging';
const suffix = isProduction ? '' : isStaging ? '.staging' : '.dev';
const label = isProduction ? '' : isStaging ? ' Staging' : ' Dev';
const scheme = isProduction ? 'angelos' : isStaging ? 'angelos-staging' : 'angelos-dev';

// Expo passes the static app.json "expo" object as `config`; fall back to
// requiring app.json directly so tools that call this without args still work.
module.exports = ({ config } = {}) => {
  const base = config && config.ios ? config : staticConfig.expo;

  return {
    ...base,
    name: `AngelOS${label}`,
    scheme,
    ios: {
      ...base.ios,
      bundleIdentifier: `${base.ios.bundleIdentifier}${suffix}`
    },
    android: {
      ...base.android,
      package: `${base.android.package}${suffix}`
    },
    extra: {
      ...(base.extra || {}),
      appEnv
    }
  };
};