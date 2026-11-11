// Diagnostics only. This module cannot grant access; authorization remains in agent-api.ts.
export function accessFailure({
  userPresent,
  ownerConfigured,
  ownerMatches,
  sameOrigin,
  serviceAuthorized,
  credentialSupplied,
  isSetup,
  setupReady,
}) {
  if (!sameOrigin && !serviceAuthorized)
    return {
      status: 403,
      code: "ORIGIN_MISMATCH",
      error: "请求来源与工作台地址不一致，请在独立窗口打开工作台后重试。",
    };
  if (!ownerMatches && !serviceAuthorized) {
    if (credentialSupplied)
      return {
        status: 401,
        code: "INVALID_AGENT_CREDENTIAL",
        error: "采集凭据无效，请重新检查连接配置。",
      };
    if (!userPresent)
      return {
        status: 401,
        code: "AUTH_REQUIRED",
        error: "下载接口未识别到登录状态，请在独立窗口登录工作台后重试。",
      };
    if (!ownerConfigured)
      return {
        status: 503,
        code: "OWNER_CONFIG_MISSING",
        error: "工作台的所有者校验配置尚未就绪，请联系维护者。",
      };
    return {
      status: 403,
      code: "OWNER_MISMATCH",
      error: "当前登录账号与工作台配置的所有者不匹配，请切换所有者账号后重试。",
    };
  }
  if (isSetup) {
    if (!ownerMatches)
      return {
        status: 403,
        code: "OWNER_REQUIRED",
        error: "机器采集凭据不能下载连接配置，请通过所有者登录会话下载。",
      };
    if (!setupReady)
      return {
        status: 503,
        code: "SETUP_NOT_CONFIGURED",
        error: "连接配置尚未就绪，服务端缺少采集或私有服务凭据，请联系维护者。",
      };
  }
  return null;
}
export function failureResponse(failure) {
  const { status, ...body } = failure;
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
