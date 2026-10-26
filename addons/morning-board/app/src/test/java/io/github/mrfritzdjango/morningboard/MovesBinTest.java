package io.github.mrfritzdjango.morningboard;

import io.github.mrfritzdjango.ink.Shows;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;

/** assets/moves.bin decodes with the app's own reader: every animal has both shows, a pass starts off screen, an outing at home. */
public class MovesBinTest {
    @Test
    public void everyAnimalHasBothShows() throws Exception {
        byte[] file = Files.readAllBytes(Paths.get("src/main/assets/moves.bin"));
        Shows shows = Shows.index(null, file, Math.min(file.length, 8192));
        assertNotNull("not a moves.bin", shows);
        String json = new String(Files.readAllBytes(Paths.get("src/main/assets/animals.json")), StandardCharsets.UTF_8);
        JSONArray animals = new JSONObject(json).getJSONArray("animals");
        for (int i = 0; i < animals.length(); i++) {
            String id = animals.getJSONObject(i).getString("id");
            assertTrue(id + " has no show", shows.has(id));
            Shows.Show pass = shows.show(file, id, true), outing = shows.show(file, id, false);
            assertTrue(id + " pass length", pass.seconds >= 3 && pass.seconds <= 5.01f);
            assertTrue(id + " outing length", outing.seconds >= 6 && outing.seconds <= 10.01f);
            assertEquals(id + " frames", Math.ceil(pass.seconds * pass.fps - 1e-3) + 1, pass.frames.length, 0);
            Shows.Frame first = pass.frames[0];
            boolean off = (first.flags & Shows.HIDDEN) != 0 || first.x < 0 || first.x > 1920;
            assertTrue(id + " pass starts on screen at x " + first.x, off);
            Shows.Frame home = outing.frames[0], last = outing.frames[outing.frames.length - 1];
            assertEquals(id + " outing starts at home x", 700, home.x, 2);
            assertEquals(id + " outing starts at home y", 480, home.y, 2);
            assertEquals(id + " outing ends at home x", 700, last.x, 2);
            assertEquals(id + " bend grid", (pass.cols + 1) * (pass.rows + 1) * 2, first.bend.length);
        }
    }
}
