const semver = require('semver');

const versionCheck = ({ version } = {}) => {
  const minVersion = process.env.MIN_APP_VERSION || '1.0.0';
  const latestVersion = process.env.LATEST_APP_VERSION || minVersion;

  if (!version) {
    return { updateRequired: false, minimumVersion: minVersion, latestVersion };
  }

  const clean = semver.valid(semver.coerce(version));
  if (!clean) {
    return { updateRequired: true, minimumVersion: minVersion, latestVersion };
  }

  return {
    updateRequired: semver.lt(clean, minVersion),
    minimumVersion: minVersion,
    latestVersion,
  };
};

module.exports = { versionCheck };
