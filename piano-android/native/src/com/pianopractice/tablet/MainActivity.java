package com.pianopractice.tablet;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.database.Cursor;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.ConsoleMessage;
import android.webkit.WebResourceError;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.os.Build;
import android.content.pm.PackageInfo;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

/** Local-only HTML app. Native integration provides backups and USB MIDI input. */
public final class MainActivity extends Activity {
    private static final int EXPORT=210, IMPORT=211, IMPORT_SCORE=212, MAX_BYTES=5_000_000;
    private static final String ORIGIN="https://piano.offline.local/";
    private WebView web;
    private MidiController midi;
    private String pendingExport;
    private SharedPreferences preferences;
    private boolean leaving, startupDialogShown;
    private String consoleError="", loadError="";
    private int startupGeneration;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        preferences=getSharedPreferences("piano-records",MODE_PRIVATE);
        if(state!=null&&state.getBoolean("pendingExport"))pendingExport=preferences.getString("pendingExport",null);else preferences.edit().remove("pendingExport").apply();
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web=new WebView(this);
        setContentView(web);
        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setBlockNetworkLoads(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onConsoleMessage(ConsoleMessage message){
                if(message.messageLevel()==ConsoleMessage.MessageLevel.ERROR)consoleError=message.message()+"（脚本行 "+message.lineNumber()+"）";
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !isAppUrl(request.getUrl());}
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                Uri uri=request.getUrl();
                // Serve the packaged page explicitly. Never replace local/data content with HTTP 403.
                if(isAppUrl(uri)){
                    try{return new WebResourceResponse("text/html","UTF-8",200,"OK",Collections.singletonMap("Cache-Control","no-store"),getAssets().open("index.html"));}
                    catch(Exception e){return new WebResourceResponse("text/plain","UTF-8",500,"Asset unavailable",Collections.<String,String>emptyMap(),new ByteArrayInputStream("Local asset unavailable".getBytes(StandardCharsets.UTF_8)));}
                }
                String scheme=uri.getScheme();
                if("http".equals(scheme)||"https".equals(scheme))return new WebResourceResponse("text/plain","UTF-8",403,"Offline",Collections.<String,String>emptyMap(),new ByteArrayInputStream(new byte[0]));
                return null;
            }
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){startupGeneration++;consoleError="";loadError="";}
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())loadError=error.getDescription().toString();}
            @Override public void onPageFinished(WebView view,String url){probeStartup(startupGeneration,0);}
        });
        web.addJavascriptInterface(new LocalBridge(),"PianoAndroid");
        midi=new MidiController(this,web);
        try(InputStream in=getAssets().open("index.html")){
            readBounded(in,8_000_000);
            web.loadUrl(ORIGIN+"index.html");
        }catch(Exception e){new AlertDialog.Builder(this).setTitle("启动失败").setMessage("应用内容未能加载，请重新安装。").setPositiveButton("关闭",(d,w)->finish()).show();}
        immersive();
    }

    private static boolean isAppUrl(Uri uri){
        return "https".equals(uri.getScheme())&&"piano.offline.local".equals(uri.getHost())&&uri.getPort()==-1&&uri.getQuery()==null&&("/".equals(uri.getPath())||"/index.html".equals(uri.getPath()));
    }
    private void probeStartup(final int generation,final int attempt){
        if(web==null||isFinishing()||isDestroyed()||generation!=startupGeneration)return;
        web.postDelayed(()->{
            if(web==null||isFinishing()||isDestroyed()||generation!=startupGeneration)return;
            web.evaluateJavascript("window.PianoReady?'ready':((window.PianoStartup&&window.PianoStartup.error)||'页面脚本未完成初始化')",result->{
                if(isFinishing()||isDestroyed()||generation!=startupGeneration)return;
                String detail="页面脚本未完成初始化";
                try{Object value=new org.json.JSONTokener(result).nextValue();if(value instanceof String)detail=(String)value;}catch(Exception ignored){}
                if("ready".equals(detail)){if(midi!=null)midi.publish();return;}
                if(attempt<9){probeStartup(generation,attempt+1);return;}
                if(startupDialogShown)return;startupDialogShown=true;
                PackageInfo engine=WebView.getCurrentWebViewPackage();
                final String diagnostics="版本 1.5.7 · Android "+Build.VERSION.RELEASE+"\n网页引擎："+(engine==null?"未知":engine.versionName)+"\n原因："+(!loadError.isEmpty()?loadError:!consoleError.isEmpty()?consoleError:detail);
                new AlertDialog.Builder(MainActivity.this).setTitle("应用启动失败").setMessage(diagnostics+"\n\n可复制诊断信息用于排查。")
                    .setNeutralButton("复制诊断",(d,w)->{ClipboardManager clipboard=(ClipboardManager)getSystemService(CLIPBOARD_SERVICE);if(clipboard!=null)clipboard.setPrimaryClip(ClipData.newPlainText("识谱应用启动诊断",diagnostics));toast("诊断信息已复制。");})
                    .setPositiveButton("关闭",null).show();
            });
        },500);
    }

    private void immersive(){getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_STABLE);}
    @Override public void onWindowFocusChanged(boolean focus){super.onWindowFocusChanged(focus);if(focus)immersive();}
    @Override protected void onPause(){if(midi!=null)midi.foreground(false);if(web!=null){web.evaluateJavascript("window.PianoPause&&window.PianoPause()",null);web.onPause();}super.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();if(midi!=null)midi.foreground(true);immersive();}
    @Override protected void onSaveInstanceState(Bundle out){if(pendingExport!=null){preferences.edit().putString("pendingExport",pendingExport).apply();out.putBoolean("pendingExport",true);}super.onSaveInstanceState(out);}
    @Override protected void onDestroy(){if(midi!=null){midi.destroy();midi=null;}if(web!=null){web.removeJavascriptInterface("PianoAndroid");web.destroy();web=null;}super.onDestroy();}
    @Override public void onBackPressed(){
        if(web==null||leaving)return;
        web.evaluateJavascript("window.PianoBack?window.PianoBack():false",result->{
            if("true".equals(result)||isFinishing()||isDestroyed())return;
            new AlertDialog.Builder(this).setTitle("退出识谱练习？").setMessage("已保存的练习记录会保留。").setNegativeButton("继续练习",null).setPositiveButton("退出",(d,w)->{leaving=true;finish();}).show();
        });
    }
    private static byte[] readBounded(InputStream in,int limit)throws Exception{
        ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int n,total=0;
        while((n=in.read(buffer))!=-1){total+=n;if(total>limit)throw new IllegalArgumentException("Too large");out.write(buffer,0,n);}return out.toByteArray();
    }
    private void toast(String message){runOnUiThread(()->Toast.makeText(this,message,Toast.LENGTH_LONG).show());}
    private void nativeError(String message){if(web!=null)web.evaluateJavascript("window.alert("+JSONObject.quote(message)+")",null);}

    public final class LocalBridge {
        @JavascriptInterface public double midiClock(){return System.nanoTime()/1_000_000.0;}
        @JavascriptInterface public void midiRefresh(){runOnUiThread(()->{if(midi!=null)midi.refresh();});}
        @JavascriptInterface public void midiStatus(){runOnUiThread(()->{if(midi!=null)midi.publish();});}
        @JavascriptInterface public void midiConnect(int id,int port){runOnUiThread(()->{if(midi!=null)midi.connect(id,port);});}
        @JavascriptInterface public void midiDisconnect(){runOnUiThread(()->{if(midi!=null)midi.disconnect();});}

        @JavascriptInterface public String loadData(){return preferences.getString("data","");}
        @JavascriptInterface public void saveData(String json){if(json==null||json.length()>MAX_BYTES)return;try{new JSONObject(json);preferences.edit().putString("data",json).apply();}catch(Exception ignored){}}
        @JavascriptInterface public void exportData(String filename,String json){
            if(json==null||json.getBytes(StandardCharsets.UTF_8).length>MAX_BYTES){toast("数据文件过大，无法导出。");return;}
            runOnUiThread(()->{if(pendingExport!=null){toast("已有导出正在进行。");return;}pendingExport=json;String title=filename==null?"识谱练习数据.json":filename.replaceAll("[/\\\\]","_");Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE,title);try{startActivityForResult(intent,EXPORT);}catch(Exception e){pendingExport=null;nativeError("此设备没有可用的文件保存器。");}});
        }
        @JavascriptInterface public void importData(){runOnUiThread(()->{Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/json","text/plain","application/octet-stream"});try{startActivityForResult(intent,IMPORT);}catch(Exception e){nativeError("此设备没有可用的文件选择器。");}});}
        @JavascriptInterface public void importScore(){runOnUiThread(()->{Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");try{startActivityForResult(intent,IMPORT_SCORE);}catch(Exception e){nativeError("此设备没有可用的曲谱文件选择器。");}});}
    }

    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(result!=RESULT_OK||data==null||data.getData()==null){if(request==EXPORT){pendingExport=null;preferences.edit().remove("pendingExport").apply();}return;}
        Uri uri=data.getData();
        if(request==IMPORT_SCORE)new Thread(()->{
            try(InputStream in=getContentResolver().openInputStream(uri)){
                if(in==null)throw new IllegalStateException();
                String filename="导入曲谱";
                try(Cursor cursor=getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){
                    if(cursor!=null&&cursor.moveToFirst())filename=cursor.getString(0);
                }
                final String name=filename;
                final String encoded=Base64.encodeToString(readBounded(in,MAX_BYTES),Base64.NO_WRAP);
                runOnUiThread(()->{
                    if(web==null)return;
                    web.evaluateJavascript("window.PianoScoreTransfer={name:"+JSONObject.quote(name)+",chunks:[]}",null);
                    for(int offset=0;offset<encoded.length();offset+=65536){
                        String chunk=encoded.substring(offset,Math.min(encoded.length(),offset+65536));
                        web.evaluateJavascript("window.PianoScoreTransfer.chunks.push("+JSONObject.quote(chunk)+")",null);
                    }
                    web.evaluateJavascript("(function(){var x=window.PianoScoreTransfer;window.PianoScoreTransfer=null;if(window.PianoSongs)window.PianoSongs.nativeFile(x.name,x.chunks.join(''));})()",null);
                });
            }catch(Exception e){toast("导入失败，请选择5MB以内的 MIDI、MusicXML、MXL 或曲谱库备份。");}
        },"piano-score-import").start();
        if(request==EXPORT){final String json=pendingExport;pendingExport=null;preferences.edit().remove("pendingExport").apply();if(json==null){nativeError("导出已中断，请重试。");return;}new Thread(()->{try(OutputStream out=getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new IllegalStateException();out.write(json.getBytes(StandardCharsets.UTF_8));toast("数据已保存。");}catch(Exception e){toast("保存失败，请换一个位置后重试。");}},"piano-export").start();}
        if(request==IMPORT)new Thread(()->{try(InputStream in=getContentResolver().openInputStream(uri)){if(in==null)throw new IllegalStateException();final String json=new String(readBounded(in,MAX_BYTES),StandardCharsets.UTF_8);new JSONObject(json);runOnUiThread(()->{if(web!=null)web.evaluateJavascript("window.importPianoData("+JSONObject.quote(json)+")",null);});}catch(Exception e){toast("导入失败，请选择5MB以内的练习数据JSON文件。");}},"piano-import").start();
    }
}
