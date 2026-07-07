// const { withNativeWind } = require("nativewind/metro");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// Temporarily disable NativeWind to fix loading issue
// module.exports = withNativeWind(config, { input: "./global.css" });
module.exports = config;
