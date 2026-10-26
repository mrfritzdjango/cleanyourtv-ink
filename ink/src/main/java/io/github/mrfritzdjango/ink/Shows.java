package io.github.mrfritzdjango.ink;

import android.content.res.AssetManager;

import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.GZIPInputStream;

/**
 * Each animal's two shows, baked into assets/moves.bin by the Ink Menagerie tools: the pass (it crosses Home) and
 * the outing (on the screensaver it goes out and comes back). A show is keyframes, twelve a second, each with the
 * pose, the bend of the drawing on a grid and the ink marks around it; ShowView blends between them. The format is
 * described in the tools' bake.js.
 */
public final class Shows {
    public static final int HIDDEN = 1;
    public static final int BURST = 8;
    public static final int MIRROR = 16;
    public static final int OWN_PROP = 32;
    public static final int PROP_HIDDEN = 64;
    public static final int PROP_MIRROR = 128;
    public static final int CUT = 256;
    public static final int SHOUT = 512;

    public static final int CIRCLE = 0;
    public static final int LINE = 1;
    public static final int ELLIPSE = 2;
    public static final int ARC = 3;
    public static final int DOTS = 4;
    public static final int PATH = 5;

    /** An ink mark around the animal, in design pixels (a 1920 x 1080 screen), left to right. */
    public static final class Mark {
        public int kind;
        public boolean behind;
        public boolean closed;
        /** PATH: 0 none, 1 ink, 2 paper, 3 halftone dots. */
        public int fill;
        public float width;
        /** DOTS and a dotted PATH fill: the dot size, 0..1. */
        public float level;
        public float[] v;
    }

    public static final class Frame {
        public int flags;
        public float x;
        public float y;
        public float scale;
        public float sx;
        public float sy;
        public float angle;
        public float shakeX;
        public float shakeY;
        public float shout = -1;
        public float shoutScale = 1;
        public float[] prop;
        /** The bend at each grid point, in drawing units: u, v pairs, (cols + 1) x (rows + 1). */
        public float[] bend;
        public Mark[] marks;

        public int screen() {
            return (flags >> 1) & 3;
        }
    }

    public static final class Show {
        public int fps;
        /** The bend grid: cols x rows cells. */
        public int cols;
        public int rows;
        /** Design pixels per drawing unit at scale 1. */
        public float fit;
        public float homeScale;
        public float seconds;
        public Frame[] frames;
    }

    public static final class Entry {
        public final int[] props;
        public final int[] at = new int[4];

        public Entry(int[] props) {
            this.props = props;
        }
    }

    public final int fps;
    public final int cols;
    public final int rows;
    private final Map<String, Entry> entries = new HashMap<>();
    private final AssetManager assets;

    private Shows(AssetManager assets, ByteBuffer b) {
        this.assets = assets;
        b.position(6);
        fps = b.get() & 0xFF;
        cols = b.get() & 0xFF;
        rows = b.get() & 0xFF;
        int count = b.getShort() & 0xFFFF;
        for (int i = 0; i < count; i++) {
            byte[] id = new byte[b.get() & 0xFF];
            b.get(id);
            int[] props = new int[b.get() & 0xFF];
            for (int j = 0; j < props.length; j++) props[j] = b.get() & 0xFF;
            Entry e = new Entry(props);
            for (int j = 0; j < 4; j++) e.at[j] = b.getInt();
            entries.put(new String(id, StandardCharsets.UTF_8), e);
        }
    }

    /** The index of moves.bin, or null when it is missing or not ours. */
    public static Shows open(AssetManager assets) {
        try (InputStream in = assets.open("moves.bin")) {
            byte[] head = new byte[8192];
            int n = 0;
            for (int r; n < head.length && (r = in.read(head, n, head.length - n)) > 0; ) n += r;
            return index(assets, head, n);
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }

    /** The index from the first n bytes of moves.bin; assets may be null when only show() is used (the tests). */
    public static Shows index(AssetManager assets, byte[] head, int n) {
        ByteBuffer b = ByteBuffer.wrap(head, 0, n).order(ByteOrder.LITTLE_ENDIAN);
        if (n < 11 || b.get(0) != 'I' || b.get(1) != 'N' || b.get(2) != 'K' || b.get(3) != 'M' || b.getShort(4) != 1) return null;
        return new Shows(assets, b);
    }

    /** One show cut from the whole file already in memory. */
    public Show show(byte[] file, String id, boolean pass) throws IOException {
        Entry e = entries.get(id);
        if (e == null) return null;
        int offset = e.at[pass ? 0 : 2], length = e.at[pass ? 1 : 3];
        byte[] blob = new byte[length];
        System.arraycopy(file, offset, blob, 0, length);
        return parse(unzip(blob));
    }

    public boolean has(String id) {
        return entries.containsKey(id);
    }

    public int[] props(String id) {
        Entry e = entries.get(id);
        return e == null ? new int[0] : e.props;
    }

    /** One show, read and unpacked; null if it is missing or broken. Reads a few hundred kilobytes: not on the main thread. */
    public Show load(String id, boolean pass) {
        Entry e = entries.get(id);
        if (e == null) return null;
        int offset = e.at[pass ? 0 : 2], length = e.at[pass ? 1 : 3];
        try (InputStream in = assets.open("moves.bin")) {
            DataInputStream data = new DataInputStream(in);
            for (long left = offset; left > 0; ) {
                long skipped = data.skip(left);
                if (skipped <= 0) throw new IOException("moves.bin ends early");
                left -= skipped;
            }
            byte[] blob = new byte[length];
            data.readFully(blob);
            return parse(unzip(blob));
        } catch (IOException | RuntimeException ex) {
            return null;
        }
    }

    private static byte[] unzip(byte[] blob) throws IOException {
        try (GZIPInputStream in = new GZIPInputStream(new java.io.ByteArrayInputStream(blob))) {
            ByteArrayOutputStream out = new ByteArrayOutputStream(blob.length * 8);
            byte[] buf = new byte[16384];
            for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }

    private Show parse(byte[] bytes) {
        ByteBuffer b = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
        Show s = new Show();
        s.fps = fps;
        s.cols = cols;
        s.rows = rows;
        s.fit = b.getFloat();
        s.homeScale = b.getFloat();
        s.seconds = b.getFloat();
        s.frames = new Frame[b.getShort() & 0xFFFF];
        int points = (cols + 1) * (rows + 1) * 2;
        int[] bend = new int[points];
        for (int i = 0; i < s.frames.length; i++) {
            Frame f = new Frame();
            f.flags = b.getShort() & 0xFFFF;
            f.x = b.getFloat();
            f.y = b.getFloat();
            f.scale = b.getFloat();
            f.sx = b.getFloat();
            f.sy = b.getFloat();
            f.angle = b.getFloat();
            f.shakeX = b.getFloat();
            f.shakeY = b.getFloat();
            if ((f.flags & SHOUT) != 0) {
                f.shout = b.getFloat();
                f.shoutScale = b.getFloat();
            }
            if ((f.flags & OWN_PROP) != 0 && (f.flags & PROP_HIDDEN) == 0) {
                f.prop = new float[6];
                for (int j = 0; j < 6; j++) f.prop[j] = b.getFloat();
            }
            f.bend = new float[points];
            for (int j = 0; j < points; j++) {
                bend[j] += b.getShort();   // stored as the change from the frame before
                f.bend[j] = bend[j] / 65534f;
            }
            f.marks = new Mark[b.getShort() & 0xFFFF];
            for (int j = 0; j < f.marks.length; j++) {
                Mark m = new Mark();
                m.kind = b.get() & 0xFF;
                int flags = b.get() & 0xFF;
                m.behind = (flags & 1) != 0;
                m.closed = (flags & 2) != 0;
                m.fill = flags >> 2;
                m.width = (b.get() & 0xFF) / 4f;
                int n;
                if (m.kind == PATH) {
                    n = (b.getShort() & 0xFFFF) * 2;
                    m.level = (b.get() & 0xFF) / 255f;
                } else {
                    n = m.kind == CIRCLE ? 3 : m.kind == LINE || m.kind == DOTS ? 4 : 5;
                }
                m.v = new float[n];
                for (int k = 0; k < n; k++) m.v[k] = b.getShort() / 2f;
                if (m.kind == DOTS) {
                    m.level = m.v[3] * 2 / 1000f;   // the level is stored whole, not doubled
                }
                f.marks[j] = m;
            }
            s.frames[i] = f;
        }
        return s;
    }
}
