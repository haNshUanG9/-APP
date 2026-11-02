package com.pianopractice.tablet;

import android.app.Activity;
import android.content.pm.PackageManager;
import android.media.midi.MidiManager;
import android.media.midi.MidiDevice;
import android.media.midi.MidiDeviceInfo;
import android.media.midi.MidiOutputPort;
import android.media.midi.MidiReceiver;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import org.json.JSONObject;
import org.json.JSONArray;
import java.io.IOException;

/** Native USB MIDI discovery and reception. All connection transitions run on the UI thread. */
public final class MidiController {
    private final Activity activity;
    private final WebView web;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private MidiManager manager;
    private MidiDevice device;
    private MidiOutputPort port;
    private int deviceId=-1,portNumber=-1;
    private volatile int generation;
    private volatile boolean destroyed,foreground=true;
    private boolean autoConnect=true;
    private String state="disconnected",detail="连接琴的 USB TO HOST 到平板，然后弹一个音测试。";
    private final MidiManager.DeviceCallback callback=new MidiManager.DeviceCallback(){
        @Override public void onDeviceAdded(MidiDeviceInfo info){scan();}
        @Override public void onDeviceRemoved(MidiDeviceInfo info){
            if(info.getId()==deviceId){closeConnection();state="disconnected";detail="实体琴已断开，训练已暂停。";publish();}
            scan();
        }
    };
    public MidiController(Activity activity,WebView web) {
        this.activity=activity;this.web=web;
        if(!activity.getPackageManager().hasSystemFeature(PackageManager.FEATURE_MIDI)){
            state="unsupported";detail="此平板未提供 Android MIDI 功能，可以继续触屏练习。";return;
        }
        manager=(MidiManager)activity.getSystemService(Activity.MIDI_SERVICE);
        if(manager==null){state="unsupported";detail="此设备没有可用的 MIDI 服务。";return;}
        manager.registerDeviceCallback(callback,handler);scan();
    }
    private String name(MidiDeviceInfo info) {
        String n=info.getProperties().getString(MidiDeviceInfo.PROPERTY_NAME);
        if(n==null||n.trim().isEmpty())n=info.getProperties().getString(MidiDeviceInfo.PROPERTY_PRODUCT);
        return n==null||n.trim().isEmpty()?"USB MIDI "+info.getId():n;
    }
    public void scan() {
        if(destroyed)return;
        if(manager!=null&&deviceId<0&&autoConnect){
            for(MidiDeviceInfo info:manager.getDevices())if(info.getType()==MidiDeviceInfo.TYPE_USB&&info.getOutputPortCount()>0){
                for(MidiDeviceInfo.PortInfo p:info.getPorts())if(p.getType()==MidiDeviceInfo.PortInfo.TYPE_OUTPUT){connect(info.getId(),p.getPortNumber());return;}
            }
        }
        publish();
    }
    public void connect(int id,int number) {
        if(destroyed||manager==null)return;
        MidiDeviceInfo chosen=null;
        for(MidiDeviceInfo info:manager.getDevices())if(info.getId()==id&&info.getType()==MidiDeviceInfo.TYPE_USB){
            for(MidiDeviceInfo.PortInfo p:info.getPorts())if(p.getType()==MidiDeviceInfo.PortInfo.TYPE_OUTPUT&&p.getPortNumber()==number)chosen=info;
        }
        if(chosen==null){detail="未找到所选 USB MIDI 输入端口，请刷新设备。";publish();return;}
        if(device!=null&&deviceId==id&&portNumber==number){publish();return;}
        closeConnection();autoConnect=true;deviceId=id;portNumber=number;state="connecting";detail="正在连接实体琴…";publish();
        final int token=generation;final MidiDeviceInfo info=chosen;
        manager.openDevice(info,opened->{
            if(destroyed||token!=generation){if(opened!=null)try{opened.close();}catch(IOException ignored){}return;}
            if(opened==null){closeConnection();autoConnect=false;state="error";detail="设备打开失败，请重新插接转接头后刷新设备。";publish();return;}
            MidiOutputPort output=opened.openOutputPort(number);
            if(output==null){try{opened.close();}catch(IOException ignored){}closeConnection();autoConnect=false;state="error";detail="MIDI 端口不可用，可能被其他应用占用。";publish();return;}
            device=opened;port=output;
            MidiReceiver receiver=new MidiReceiver(){
                private JSONArray messages=new JSONArray();
                private final MidiParser parser=new MidiParser((command,channel,a,b,timestamp)->{
                    try{
                        JSONObject event=new JSONObject();event.put("channel",channel);
                        if(command==0x90||command==0x80){event.put("type",command==0x90&&b>0?"on":"off");event.put("note",a);event.put("velocity",b);}
                        else if(command==0xb0&&a==64){event.put("type","pedal");event.put("value",b);}
                        else if(command==0xff||command==0xb0&&(a==120||a==123)){event.put("type","reset");event.put("all",command==0xff);}
                        else return;
                        long now=System.nanoTime();long at=timestamp>0&&timestamp<=now+10_000_000L&&now-timestamp<2_000_000_000L?timestamp:now;
                        event.put("timeMs",at/1_000_000.0);messages.put(event);
                    }catch(Exception ignored){}
                });
                @Override public synchronized void onSend(byte[] bytes,int offset,int count,long timestamp){
                    if(destroyed||token!=generation)return;
                    messages=new JSONArray();parser.send(bytes,offset,count,timestamp);
                    if(!foreground)return;
                    final String json=messages.toString();if(messages.length()==0)return;
                    handler.post(()->{if(!destroyed&&foreground&&token==generation)web.evaluateJavascript("window.PianoInput&&window.PianoInput.receive("+json+")",null);});
                }
                @Override public synchronized void onFlush(){parser.reset();handler.post(()->{if(!destroyed&&token==generation)web.evaluateJavascript("window.PianoInput&&window.PianoInput.reset()",null);});}
            };
            output.connect(receiver);state="connected";detail="已连接，弹一个音确认输入。";publish();
        },handler);
    }
    private void closeConnection(){
        generation++;if(port!=null)try{port.close();}catch(IOException ignored){}if(device!=null)try{device.close();}catch(IOException ignored){}
        port=null;device=null;deviceId=-1;portNumber=-1;
    }
    public void disconnect(){autoConnect=false;closeConnection();state="disconnected";detail="已断开，可切换触屏练习或重新连接设备。";publish();}
    public void refresh(){if(deviceId<0)autoConnect=true;scan();}
    public void publish(){
        if(destroyed)return;
        try{
            JSONObject data=new JSONObject();JSONArray devices=new JSONArray();
            if(manager!=null)for(MidiDeviceInfo info:manager.getDevices())if(info.getType()==MidiDeviceInfo.TYPE_USB){
                for(MidiDeviceInfo.PortInfo p:info.getPorts())if(p.getType()==MidiDeviceInfo.PortInfo.TYPE_OUTPUT){
                    JSONObject d=new JSONObject();d.put("id",info.getId());d.put("port",p.getPortNumber());d.put("name",name(info));d.put("portName",p.getName());devices.put(d);
                }
            }
            data.put("state",state);data.put("detail",detail);data.put("devices",devices);data.put("deviceId",deviceId);data.put("port",portNumber);data.put("generation",generation);
            web.evaluateJavascript("window.PianoInput&&window.PianoInput.status("+data.toString()+")",null);
        }catch(Exception ignored){}
    }
    public void foreground(boolean value){foreground=value;if(value){web.evaluateJavascript("window.PianoInput&&window.PianoInput.reset()",null);scan();}}
    public void destroy(){destroyed=true;closeConnection();handler.removeCallbacksAndMessages(null);if(manager!=null)manager.unregisterDeviceCallback(callback);}
}
