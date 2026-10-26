package io.github.mrfritzdjango.ink;

import android.content.Context;
import android.graphics.Path;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/** The screensaver's animals, drawn as ink paths (assets/animals.json): outline, halftone body, solid marks, knock-outs. */
public final class Animals {
    public static final int NONE = 0;
    public static final int DOTS = 1;
    public static final int INK = 2;
    public static final int PAPER = 3;

    public static final class Layer {
        public final Path path = new Path();
        public final int fill;
        public final boolean stroke;
        public final float width;
        /** A paper frame with the animal cut out of it: it erases what lies outside the animal. */
        public final boolean cut;

        public Layer(JSONObject o, float w, float h) {
            String f = o.optString("fill", "none");
            fill = "dots".equals(f) ? DOTS : "ink".equals(f) ? INK : "paper".equals(f) ? PAPER : NONE;
            stroke = o.optBoolean("stroke");
            width = (float) o.optDouble("width", 2.5);
            String d = o.optString("d");
            cut = fill == PAPER && d.startsWith("M0 0 L" + num(w) + " 0 L" + num(w) + " " + num(h) + " L0 " + num(h) + " Z");
            SvgPath.parse(d, new SvgPath.Sink() {
                @Override public void moveTo(float x, float y) { path.moveTo(x, y); }
                @Override public void lineTo(float x, float y) { path.lineTo(x, y); }
                @Override public void cubicTo(float x1, float y1, float x2, float y2, float x3, float y3) { path.cubicTo(x1, y1, x2, y2, x3, y3); }
                @Override public void quadTo(float x1, float y1, float x2, float y2) { path.quadTo(x1, y1, x2, y2); }
                @Override public void close() { path.close(); }
            });
        }
    }

    /** 600, not 600.0, as the drawings write their numbers. */
    private static String num(float v) {
        return v == (int) v ? Integer.toString((int) v) : Float.toString(v);
    }

    public static final class Animal {
        public final String id;
        public final String group;
        public final String name;
        public final String latin;
        /** What it is called locally in Malaysia; the caption shows this instead of the Latin name. */
        public final String malay;
        public final float width;
        public final float height;
        public final List<Layer> layers = new ArrayList<>();

        public Animal(JSONObject o) {
            id = o.optString("id");
            group = o.optString("group");
            name = o.optString("name");
            latin = o.optString("latin");
            malay = o.optString("malay");
            String[] box = o.optString("viewBox", "0 0 600 400").trim().split("\\s+");
            width = Float.parseFloat(box[2]);
            height = Float.parseFloat(box[3]);
            JSONArray a = o.optJSONArray("layers");
            for (int i = 0; a != null && i < a.length(); i++) layers.add(new Layer(a.optJSONObject(i), width, height));
        }
    }

    private Animals() {
    }

    /** Every animal, land and sea mixed in a fixed shuffled order, so the hours don't walk the alphabet. */
    public static List<Animal> load(Context context) {
        List<Animal> out = new ArrayList<>();
        try (InputStream in = context.getAssets().open("animals.json")) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            for (int n; (n = in.read(buf)) > 0; ) bytes.write(buf, 0, n);
            JSONArray a = new JSONObject(bytes.toString(StandardCharsets.UTF_8.name())).getJSONArray("animals");
            for (int i = 0; i < a.length(); i++) {
                try {
                    out.add(new Animal(a.getJSONObject(i)));
                } catch (RuntimeException e) {
                    // a broken drawing is left out rather than taking the screensaver down
                }
            }
        } catch (IOException | JSONException e) {
            return out;
        }
        Collections.shuffle(out, new Random(25));
        return out;
    }
}
