import com.pianopractice.tablet.MidiParser;
import java.util.ArrayList;
import java.util.List;
public final class MidiParserTest {
    static final List<String> events=new ArrayList<>();
    static final MidiParser p=new MidiParser((command,channel,a,b,time)->events.add(command+":"+channel+":"+a+":"+b+":"+time));
    static void send(int... data){byte[] bytes=new byte[data.length];for(int i=0;i<data.length;i++)bytes[i]=(byte)data[i];p.send(bytes,0,bytes.length,1234);}
    static void check(boolean value){if(!value)throw new AssertionError(events.toString());}
    public static void main(String[] args){
        send(0x90,60);check(events.isEmpty());send(80,61,0,0xf8,62,90);check(events.size()==3);
        check(events.get(0).equals("144:0:60:80:1234"));check(events.get(1).equals("144:0:61:0:1234"));
        send(0x82,60,0);check(events.get(3).startsWith("128:2:60:0:"));
        send(0xb0,64,127,0xf8,64,0);check(events.size()==6);
        send(0xf0,1,2,0xf8,3,0xf7,60,80);check(events.size()==6);
        send(0xc0,12,13,0x90,70,80);check(events.size()==7);
        send(0xff);check(events.size()==8);send(71,80);check(events.size()==8);
        send(0x90,72);p.reset();send(80);check(events.size()==8);
        System.out.println("MIDI parser: fragmented packets, running status, velocity-zero, realtime, SysEx, reset PASS");
    }
}
