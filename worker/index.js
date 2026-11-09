// Placeholder so the test file's import resolves; real handler lands next commit.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
