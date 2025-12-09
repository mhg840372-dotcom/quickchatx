// babel.config.js
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // 👇 Reanimated SIEMPRE debe ir el último
      "react-native-reanimated/plugin"
    ],
  };
};
