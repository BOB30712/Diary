// common.js
(function (window) {
  function decodeObfuscated(str) {
    const reversed = str.split('').reverse().join('');
    return atob(reversed);
  }
  const OBF_API_BASE = 'jVGel9SU0I1ctpkbFFWcNVzR0Q1NQlnb2MWaKhzVoNWUnFlaWdEc3J0aJpVbFZnWwwGdtMnatNzaypVMClHStcWQNpkMxUkV6J2Y5Z2SB9ycvM3byNWYt9SbvNmLlx2Zv92ZuQHcpJ3Yz9yL6MHc0RHa';
  const OBF_SC = '==wd3d3d3d3d3d3d3d3d';

  // 共用設定
  const config = {
    API_BASE: decodeObfuscated(OBF_API_BASE),
    SC: decodeObfuscated(OBF_SC),
  };

  // 統一掛在 window 底下，給各頁面使用 ----------------------------
  window.App = {
    config,
  };
})(window);
