package com.pianopractice.tablet;

/** MIDI 1.0 byte stream parser; independent of Android for regression tests. */
public final class MidiParser {
    public interface Listener { void message(int command, int channel, int a, int b, long timestamp); }
    private final Listener listener;
    private int status, needed, count, first;
    private boolean sysex;
    public MidiParser(Listener listener) { this.listener=listener; }
    public void reset() { status=needed=count=first=0; sysex=false; }
    public void send(byte[] bytes,int offset,int length,long timestamp) {
        for(int i=offset;i<offset+length;i++) {
            int x=bytes[i]&255;
            if(x>=0xf8) { if(x==0xff){reset();listener.message(0xff,0,0,0,timestamp);} continue; }
            if((x&128)!=0) {
                count=0;
                if(x>=0xf0) { status=needed=0;sysex=x==0xf0;continue; }
                sysex=false;status=x;needed=((x&0xf0)==0xc0||(x&0xf0)==0xd0)?1:2;continue;
            }
            if(sysex||status==0||needed==0)continue;
            if(count==0)first=x;
            count++;
            if(count==needed) {
                int op=status&0xf0;
                if(op==0x90||op==0x80||op==0xb0)listener.message(op,status&15,first,needed==2?x:0,timestamp);
                count=0;
            }
        }
    }
}
