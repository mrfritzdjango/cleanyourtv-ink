package io.github.mrfritzdjango.morningboard;

import io.github.mrfritzdjango.ink.SvgPath;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.HashSet;
import java.util.Set;

/** Every drawing in assets/animals.json parses with the app's own path reader and stays inside its box. */
public class AnimalsJsonTest {
    @Test
    public void everyAnimalParsesAndFitsItsBox() throws Exception {
        String json = new String(Files.readAllBytes(Paths.get("src/main/assets/animals.json")), StandardCharsets.UTF_8);
        JSONArray animals = new JSONObject(json).getJSONArray("animals");
        assertTrue("expected the full set", animals.length() >= 40);
        Set<String> ids = new HashSet<>();
        for (int i = 0; i < animals.length(); i++) {
            JSONObject a = animals.getJSONObject(i);
            String id = a.getString("id");
            assertTrue("duplicate " + id, ids.add(id));
            assertFalse(id + " has no name", a.getString("name").isEmpty());
            String[] box = a.getString("viewBox").split("\\s+");
            assertEquals(4, box.length);
            float w = Float.parseFloat(box[2]), h = Float.parseFloat(box[3]);
            JSONArray layers = a.getJSONArray("layers");
            assertTrue(id + " layers", layers.length() >= 1 && layers.length() <= 10);
            for (int j = 0; j < layers.length(); j++) {
                JSONObject l = layers.getJSONObject(j);
                assertTrue(id + " fill", Set.of("dots", "ink", "paper", "none").contains(l.optString("fill", "none")));
                float[] bounds = {Float.MAX_VALUE, Float.MAX_VALUE, -Float.MAX_VALUE, -Float.MAX_VALUE};
                SvgPath.parse(l.getString("d"), new SvgPath.Sink() {
                    void at(float x, float y) {
                        bounds[0] = Math.min(bounds[0], x);
                        bounds[1] = Math.min(bounds[1], y);
                        bounds[2] = Math.max(bounds[2], x);
                        bounds[3] = Math.max(bounds[3], y);
                    }

                    @Override public void moveTo(float x, float y) { at(x, y); }
                    @Override public void lineTo(float x, float y) { at(x, y); }
                    @Override public void cubicTo(float x1, float y1, float x2, float y2, float x3, float y3) { at(x1, y1); at(x2, y2); at(x3, y3); }
                    @Override public void quadTo(float x1, float y1, float x2, float y2) { at(x1, y1); at(x2, y2); }
                    @Override public void close() { }
                });
                assertTrue(id + " layer " + j + " leaves its box",
                        bounds[0] >= 0 && bounds[1] >= 0 && bounds[2] <= w && bounds[3] <= h);
            }
        }
    }
}
