import test from "node:test";
import assert from "node:assert/strict";
import {
  accessFailure,
  failureResponse,
} from "../../hosting/lib/agent-access-errors.mjs";
const owner = {
  userPresent: true,
  ownerConfigured: true,
  ownerMatches: true,
  sameOrigin: true,
  serviceAuthorized: false,
  credentialSupplied: false,
  isSetup: true,
  setupReady: true,
};
test("成功所有者请求不被诊断模块拦截；未登录、错误账号和机器调用仍拒绝配置下载", () => {
  assert.equal(accessFailure(owner), null);
  assert.equal(
    accessFailure({ ...owner, userPresent: false, ownerMatches: false }).code,
    "AUTH_REQUIRED",
  );
  assert.equal(
    accessFailure({ ...owner, ownerMatches: false }).code,
    "OWNER_MISMATCH",
  );
  assert.equal(
    accessFailure({
      ...owner,
      userPresent: false,
      ownerMatches: false,
      serviceAuthorized: true,
    }).code,
    "OWNER_REQUIRED",
  );
});
test("服务缺少配置与身份错误分开；跨站请求仍拒绝，机器上传不受下载检查影响", async () => {
  const failure = accessFailure({ ...owner, setupReady: false });
  assert.equal(failure.status, 503);
  assert.equal(
    accessFailure({ ...owner, ownerConfigured: false, ownerMatches: false })
      .code,
    "OWNER_CONFIG_MISSING",
  );
  assert.equal(accessFailure({ ...owner, sameOrigin: false }).status, 403);
  assert.equal(
    accessFailure({
      ...owner,
      userPresent: false,
      ownerMatches: false,
      serviceAuthorized: true,
      isSetup: false,
    }),
    null,
  );
  const r = failureResponse(failure);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.deepEqual(await r.json(), {
    code: "SETUP_NOT_CONFIGURED",
    error: failure.error,
  });
});
