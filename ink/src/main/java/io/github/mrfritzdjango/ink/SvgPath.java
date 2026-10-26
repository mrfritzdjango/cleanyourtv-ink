package io.github.mrfritzdjango.ink;

/**
 * The small slice of SVG path data the animal drawings use (assets/animals.json): absolute M, L, C, Q and Z, with
 * numbers separated by spaces or commas. Anything else is an error, so a bad drawing fails loudly in the tests.
 */
public final class SvgPath {
    /** Where the commands go: an android.graphics.Path on the TV, a recorder in the tests. */
    public interface Sink {
        void moveTo(float x, float y);

        void lineTo(float x, float y);

        void cubicTo(float x1, float y1, float x2, float y2, float x3, float y3);

        void quadTo(float x1, float y1, float x2, float y2);

        void close();
    }

    private SvgPath() {
    }

    public static void parse(String d, Sink sink) {
        String[] t = d.trim().replace(',', ' ').split("\\s+|(?<=[MLCQZ])|(?=[MLCQZ])");
        int i = 0;
        char cmd = 0;
        while (i < t.length) {
            String s = t[i];
            if (s.isEmpty()) {
                i++;
                continue;
            }
            char c = s.charAt(0);
            if (Character.isLetter(c)) {
                cmd = c;
                i++;
                if (cmd == 'Z') sink.close();
                else if ("MLCQ".indexOf(cmd) < 0) throw new IllegalArgumentException("unsupported command " + cmd);
                continue;
            }
            switch (cmd) {
                case 'M':
                    sink.moveTo(f(t, i), f(t, i + 1));
                    i += 2;
                    cmd = 'L';   // further pairs after M are lines, as in SVG
                    break;
                case 'L':
                    sink.lineTo(f(t, i), f(t, i + 1));
                    i += 2;
                    break;
                case 'C':
                    sink.cubicTo(f(t, i), f(t, i + 1), f(t, i + 2), f(t, i + 3), f(t, i + 4), f(t, i + 5));
                    i += 6;
                    break;
                case 'Q':
                    sink.quadTo(f(t, i), f(t, i + 1), f(t, i + 2), f(t, i + 3));
                    i += 4;
                    break;
                default:
                    throw new IllegalArgumentException("number without a command at " + i);
            }
        }
    }

    private static float f(String[] t, int i) {
        if (i >= t.length) throw new IllegalArgumentException("path ends inside a command");
        return Float.parseFloat(t[i]);
    }
}
