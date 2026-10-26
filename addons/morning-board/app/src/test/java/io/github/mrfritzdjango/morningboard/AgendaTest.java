package io.github.mrfritzdjango.morningboard;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.json.JSONException;
import org.junit.Test;

public class AgendaTest {
    private static final String BODY = "{\"ok\":true,\"todayLong\":\"Sunday 25 October\",\"todayShort\":\"Sun 25 Oct\","
            + "\"tomorrowShort\":\"Mon 26 Oct\","
            + "\"events\":["
            + "{\"title\":\"Holiday\",\"where\":\"\",\"allDay\":true,\"time\":\"All day\",\"startMs\":0,\"endMs\":99999999},"
            + "{\"title\":\"Standup\",\"where\":\"video call\",\"allDay\":false,\"time\":\"9:00\",\"startMs\":1000,\"endMs\":2000},"
            + "{\"title\":\"Dentist\",\"where\":\"city clinic\",\"allDay\":false,\"time\":\"15:00\",\"startMs\":3000,\"endMs\":4000}],"
            + "\"tomorrow\":[{\"title\":\"Standup\",\"allDay\":false,\"time\":\"9:00\",\"startMs\":5000,\"endMs\":6000}],"
            + "\"tasks\":[{\"id\":\"t1\",\"list\":\"l1\",\"title\":\"Pay electricity\",\"due\":\"today\"},"
            + "{\"id\":\"t2\",\"list\":\"l1\",\"title\":\"Gym\",\"due\":\"\"}],"
            + "\"doneToday\":[{\"title\":\"Reply to landlord\"}]}";

    @Test
    public void parsesTheScriptsAnswer() throws JSONException {
        Agenda a = Agenda.parse(BODY);
        assertEquals("Sunday 25 October", a.todayLong);
        assertEquals(3, a.events.size());
        assertEquals("video call", a.events.get(1).where);
        assertEquals(1, a.tomorrow.size());
        assertEquals("today", a.tasks.get(0).due);
        assertEquals("Reply to landlord", a.doneToday.get(0));
    }

    @Test
    public void anEmptyDayCarriesTheNextDayWithSomethingOn() throws JSONException {
        Agenda a = Agenda.parse("{\"ok\":true,\"events\":[],\"tomorrow\":[],\"nextDay\":{\"label\":\"17th Dec 2026\","
                + "\"events\":[{\"title\":\"Flight\",\"allDay\":false,\"time\":\"7:00\",\"startMs\":1,\"endMs\":2}]}}");
        assertEquals("17th Dec 2026", a.nextDayLabel);
        assertEquals("Flight", a.nextDay.get(0).title);
        assertEquals("", Agenda.parse(BODY).nextDayLabel);   // the script sends null on a day with events
    }

    @Test(expected = JSONException.class)
    public void aWrongKeyIsAnError() throws JSONException {
        Agenda.parse("{\"ok\":false,\"error\":\"key\"}");
    }

    @Test
    public void nextSkipsAllDayAndFinishedEvents() throws JSONException {
        Agenda a = Agenda.parse(BODY);
        assertEquals(1, a.next(500));    // before standup
        assertEquals(1, a.next(1500));   // during standup
        assertEquals(2, a.next(2500));   // after standup
        assertEquals(-1, a.next(5000));  // the day is over
    }

    @Test
    public void markingDoneMovesTheTask() throws JSONException {
        Agenda a = Agenda.parse(BODY);
        a.markDone(a.tasks.get(0));
        assertEquals(1, a.tasks.size());
        assertEquals("Pay electricity", a.doneToday.get(0));
    }

    @Test
    public void theKeyIsAddedAndEncoded() {
        assertEquals("https://x/exec?key=a%2Bb&action=done",
                Agenda.url("https://x/exec", "a+b", "&action=done"));
        assertTrue(Agenda.url("https://x/exec?v=1", "k", "").endsWith("?v=1&key=k"));
    }
}
