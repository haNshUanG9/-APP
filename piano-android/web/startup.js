/* Must remain ES5: reports syntax failures before the app bundle initializes. */
(function () {
  window.PianoStartup={error:'',phase:'loading'};
  window.onerror=function(message,source,line){window.PianoStartup.error=String(message)+'（脚本行 '+line+'）';window.PianoStartup.phase='error';};
  window.addEventListener('unhandledrejection',function(event){window.PianoStartup.error=String(event.reason&&event.reason.message||event.reason||'异步启动失败');});
})();
